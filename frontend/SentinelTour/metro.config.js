const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('bin');
config.resolver.sourceExts.push('mjs', 'cjs');

module.exports = config;