module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.js'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(drizzle-orm)/)'
  ]
};
