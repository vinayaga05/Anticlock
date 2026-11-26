module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|use-latest-callback)/)',
  ],
  moduleNameMapper: {
    '^@anticlock/contracts/provider-registration$': '<rootDir>/../../packages/contracts/src/provider-registration.ts',
    '^@anticlock/contracts/username$': '<rootDir>/../../packages/contracts/src/username.ts',
    '^@anticlock/contracts/play-edition$': '<rootDir>/../../packages/contracts/src/play-edition.ts',
    '^lucide-react-native$': require.resolve('lucide-react-native'),
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
