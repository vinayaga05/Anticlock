module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|use-latest-callback)/)',
  ],
  moduleNameMapper: {
    '^lucide-react-native$': require.resolve('lucide-react-native'),
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
