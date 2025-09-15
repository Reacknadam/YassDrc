module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Si vous avez d'autres plugins, assurez-vous qu'ils ne ciblent pas node_modules.
    ],
    // Ajouter une règle d'exclusion pour node_modules peut aider si un plugin le cible par erreur
    // bien que ce ne soit généralement pas nécessaire avec babel-preset-expo.
    ignore: [
      './node_modules',
      './node_modules/**'
    ]
  };
};