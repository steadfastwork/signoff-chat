"use strict";
// Wrapper that adds .default so jest-expo v55 can call Object.defineProperty on it.
const NativeModules = jest.requireActual(
  "react-native/Libraries/BatchedBridge/NativeModules"
);
const withDefault = { ...NativeModules, default: NativeModules };
module.exports = withDefault;
