module.exports = {
  preset: "react-native",
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Stub out native-only assets and modules
    "\\.(png|jpg|jpeg|gif|svg|ttf|otf|mp4|mp3|wav)$":
      "<rootDir>/__mocks__/fileMock.js",
    // Force local react-test-renderer (root monorepo has v19 which is incompatible)
    "^react-test-renderer(.*)$":
      "<rootDir>/node_modules/react-test-renderer$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@gorhom/.*|@shopify/.*)",
  ],
  testMatch: ["**/__tests__/**/*.{test,spec}.{ts,tsx,js,jsx}"],
  testEnvironment: "node",
};
