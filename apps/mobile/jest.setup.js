// Patch NativeModules to have a .default property so jest-expo v55 can call
// Object.defineProperty on it. In RN 0.76 the module uses module.exports
// (CommonJS) so .default is undefined without this shim.
const mods = require("react-native/Libraries/BatchedBridge/NativeModules");
if (typeof mods.default === "undefined") {
  Object.defineProperty(mods, "default", {
    value:        mods,
    configurable: true,
    writable:     true,
  });
}
