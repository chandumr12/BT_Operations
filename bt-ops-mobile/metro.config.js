const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The Firebase JS SDK (firebase/app, firebase/auth, etc.) ships a "exports"
// map in its package.json for different environments. When Metro resolves
// packages through that exports map, firebase/app and firebase/auth can end
// up loaded as two separate module instances that don't share the same
// internal component registry, causing:
//   "Component auth has not been registered yet"
// Disabling package-exports resolution makes Metro fall back to the
// traditional single-entry-point ("main" field) resolution, which keeps
// every firebase/* submodule on one shared instance.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
