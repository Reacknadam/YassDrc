// firebase/config.ts
/* single-file hardening: obfuscation, tamper checks, ai-abuse detector
   - ne crée pas d'autres fichiers
   - garde les mêmes exports : storage, db, auth
   - limitations : ceci augmente la barrière mais n'est pas inviolable côté client
*/

import { initializeApp, FirebaseOptions, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';

/* ---------------------------
   1) CONFIG ENCODED (BASE64)
   -> Remplace ici par le JSON encodé base64 de ta config actuelle
   (le contenu ci-dessous correspond à ta config publique encodée)
   --------------------------- */

// encode offline (exemple node):
// Buffer.from(JSON.stringify(cfg)).toString('base64')

const ENCODED_CONFIG = `
eyJhcGlLZXkiOiAiQUl6YVN5QWlSVE96ZDI2Z09FRV
o3V3JhMkFES1R0aXY3NTNjeDciLCAiYXV0aERvbWFp
biI6ICJ5YXNzLWRyYy5maXJlYmFzZWFwcC5jb20iLCAi
cHJvamVjdElkIjogInlhc3MtZHJjIiwgInN0b3JhZ2VC
dWNrZXQiOiAieWFzcy1kcmMudmhlbmN0b3JhZ2UuYXBw
IiwgIm1lc3NhZ2luZ1NlbmRlcklkIjogIjk0NjQ0MjU0
MDUxNSIsICJhcHBJZCI6ICIxOjk0NjQ0MjU0MDUxNTo6
d2ViOnAxZGNmZGIxMzA4YWIzMTVlMTg1YmNkNiJ9
`.replace(/\s+/g, ''); // safe: remove whitespace/newlines

/* ---------------------------
   2) util: base64 decode (fallback safe)
   --------------------------- */
function base64DecodeSafe(b64: string): string {
  // try global atob (RN webview env), otherwise Buffer
  try {
    if (typeof atob === 'function') return atob(b64);
  } catch (_) {}
  try {
    // @ts-ignore Buffer global in some RN bundlers
    if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
  } catch (_) {}
  // fallback simple decoder (limited)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = '';
  let c1 = 0, c2 = 0, c3 = 0, e1 = 0, e2 = 0, e3 = 0, e4 = 0;
  let i = 0;
  b64 = b64.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  while (i < b64.length) {
    e1 = chars.indexOf(b64.charAt(i++));
    e2 = chars.indexOf(b64.charAt(i++));
    e3 = chars.indexOf(b64.charAt(i++));
    e4 = chars.indexOf(b64.charAt(i++));
    c1 = (e1 << 2) | (e2 >> 4);
    c2 = ((e2 & 15) << 4) | (e3 >> 2);
    c3 = ((e3 & 3) << 6) | e4;
    str += String.fromCharCode(c1);
    if (e3 !== 64) str += String.fromCharCode(c2);
    if (e4 !== 64) str += String.fromCharCode(c3);
  }
  return decodeURIComponent(escape(str));
}

/* ---------------------------
   3) decode config and defensive checks
   --------------------------- */
function safeParseConfig(enc: string): FirebaseOptions | null {
  try {
    const json = base64DecodeSafe(enc);
    const cfg = JSON.parse(json) as FirebaseOptions;
    return cfg;
  } catch (e) {
    console.warn('[cfg] decode error', e);
    return null;
  }
}

/* ---------------------------
   4) Tamper / emulator / debug detection (heuristics — not perfect)
   - runs synchronously before init
   --------------------------- */
function isRunningInEmulatorOrTampered(): { tampered: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // 1. Expo Constants: isDevice false => probable emulator
  try {
    // Constants.isDevice may be undefined on some SDKs
    // @ts-ignore
    if (Constants && typeof (Constants as any).isDevice !== 'undefined' && !(Constants as any).isDevice) {
      reasons.push('device_not_physical');
    }
    // deviceName contains emulator hints
    const devName = (Constants as any).deviceName || (Constants as any).manifest?.name || '';
    if (typeof devName === 'string') {
      const dn = devName.toLowerCase();
      if (dn.includes('emulator') || dn.includes('sdk') || dn.includes('simulator')) reasons.push('device_name_emulator');
    }
  } catch (e) {
    // ignore
  }

  // 2. __DEV__ (debug bundle) — attacker could run debug build
  // NOTE: __DEV__ is set by bundler; in production it should be false
  try {
    // @ts-ignore
    if (typeof __DEV__ !== 'undefined' && __DEV__) reasons.push('dev_mode_enabled');
  } catch (e) {}

  // 3. Platform checks: android typical emulator fingerprints (heuristic)
  try {
    if (Platform.OS === 'android') {
      const brand = (Constants as any).deviceYearClass || '';
      // can't rely on this, but keep placeholder if you want expand
      // reasons.push('android_check_placeholder');
    }
  } catch (e) {}

  return { tampered: reasons.length > 0, reasons };
}

/* ---------------------------
   5) Optional protective behavior:
   - si tampered => on peut choisir de refuser init (throw) ou d'initialiser en "safe mode".
   - ici on initialise mais expose flag `SECURE_INIT_OK`.
   --------------------------- */
const tamper = isRunningInEmulatorOrTampered();
if (tamper.tampered) {
  console.warn('[SECURITY] tamper/emulator hints:', tamper.reasons.join(', '));
  // important : on n'interrompt pas le runtime brutalement mais on prévient
  // si tu veux refuser l'init totally, uncomment la ligne suivante :
  // throw new Error('App integrity check failed');
}

/* ---------------------------
   6) initialize firebase using the decoded config
   --------------------------- */
const decoded = safeParseConfig(ENCODED_CONFIG);
if (!decoded) {
  console.error('[cfg] impossible de décoder la config Firebase — check ENCODED_CONFIG');
  // fallback minimal config to avoid crash; mais Firebase ne marchera pas.
}
let app: FirebaseApp;
try {
  app = initializeApp(decoded as FirebaseOptions);
} catch (e) {
  console.warn('[cfg] initializeApp warning', e);
  // if the app was already initialized, reuse existing
  // @ts-ignore
  app = (global as any).___firebase_app___ || initializeApp(decoded as FirebaseOptions);
  // store for reuse
  // @ts-ignore
  (global as any).___firebase_app___ = app;
}

/* exports expected elsewhere in your app */
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export const auth: Auth = getAuth(app);

/* ---------------------------
   7) Anti-AI / abuse detector (single-file)
   - usage: import { detectAiAbuse } from '../firebase/config'
   - call detectAiAbuse(prompt) avant d'appeler n'importe quel endpoint AI
   - retourne true si bloqué (et affiche Alert)
   --------------------------- */

const AI_BLOCK_WORDS = [
  'chatgpt', 'gpt', 'openai', 'ask-ai', 'ai-tool', 'help me hack', 'exploit', 'crack',
  'decompile', 'reverse engineer', 'bypass rules'
];

export function detectAiAbuse(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();
  const found = AI_BLOCK_WORDS.find(w => t.includes(w));
  if (found) {
    // message visible à l'utilisateur — personnalisé, ferme et dissuasif
    Alert.alert(
      'Action refusée',
      "L'utilisation d'outils d'IA pour cette opération est interdite par Yass DRC. Si vous pensez que c'est une erreur, contactez le support.",
      [{ text: 'OK' }]
    );
    console.warn(`[SECURITY][AI_BLOCK] prompt blocked because contains "${found}"`);
    // optionally write a lightweight flag in local storage or analytics...
    return true;
  }
  return false;
}

/* ---------------------------
   8) helper to know if secure init looks OK
   --------------------------- */
export const SECURE_INIT_OK = !tamper.tampered && !!decoded;

/* ---------------------------
   9) runtime helper: call before sensitive actions
   Example usage in your app:
     import { detectAiAbuse, SECURE_INIT_OK } from '../firebase/config';
     if (!SECURE_INIT_OK) { Alert.alert('App non sécurisée'); return; }
     if (detectAiAbuse(prompt)) return; // blocked
   --------------------------- */

export function isAppLikelyTampered(): boolean {
  return tamper.tampered;
}

/* ---------------------------
   10) NOTE (ne pas supprimer) :
   - Cette protection est **défensive** : elle augmente la difficulté pour un attaquant occasionnel.
   - Pour une sécurité robuste, il faut combiner :
     * Firestore Rules (interdire l'écriture de champs sensibles depuis le client)
     * Firebase App Check (Play Integrity / DeviceCheck)
     * Toutes les mises à jour critiques (isSellerVerified) exécutées côté serveur avec admin SDK
   --------------------------- */

