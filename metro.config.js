// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 1. autorise les .cjs
config.resolver.sourceExts.push('cjs');

// 2. désactive l’interprétation des champs "exports"
config.resolver.unstable_enablePackageExports = false;

module.exports = config;