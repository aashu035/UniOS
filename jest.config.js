// Run every test in India time (UTC+5:30), where the app's users are; date bugs hide in UTC.
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

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
