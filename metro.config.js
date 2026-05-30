// Metro config that adds `.csv` to bundled asset extensions so we can
// `require('./assets/hvac_sensor_data.csv')` and resolve it through expo-asset.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [...config.resolver.assetExts, 'csv'];

module.exports = config;
