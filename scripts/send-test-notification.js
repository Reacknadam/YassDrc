/**
 * Script Node.js pour tester l'envoi de notifications via le worker Cloudflare.
 *
 * Utilisation :
 * node scripts/send-test-notification.js <userId | "all"> <title> <body>
 *
 * Exemples :
 * 1. Envoyer à un utilisateur spécifique :
 *    node scripts/send-test-notification.js "l'ID_de_l_utilisateur_ici" "Salut !" "Ceci est un test."
 *
 * 2. Envoyer à tout le monde :
 *    node scripts/send-test-notification.js "all" "Annonce" "Nouvelle fonctionnalité disponible !"
 */

const https = require('https');

// L'URL de votre worker.
const WORKER_URL = 'https://notif.israelntalu328.workers.dev/send-notification';

function sendNotification(userId, title, body, data = {}) {
  const payload = {
    userId,
    title,
    body,
    data,
  };

  const postData = JSON.stringify(payload);

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(WORKER_URL, options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        console.log(`Réponse du serveur (${res.statusCode}):`);
        try {
          console.log(JSON.parse(responseBody));
        } catch {
          console.log(responseBody);
        }
        resolve(responseBody);
      });
    });

    req.on('error', (e) => {
      console.error(`Erreur lors de la requête: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// --- Exécution du script ---
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('Utilisation: node scripts/send-test-notification.js <userId | "all"> <title> <body>');
  process.exit(1);
}

const [userId, title, body] = args;

console.log(`Envoi de la notification...`);
console.log(`  Destinataire: ${userId}`);
console.log(`  Titre: ${title}`);
console.log(`  Corps: ${body}`);
console.log('---');

sendNotification(userId, title, body)
  .then(() => console.log('\nScript terminé.'))
  .catch(() => console.error('\nLe script a échoué.'));