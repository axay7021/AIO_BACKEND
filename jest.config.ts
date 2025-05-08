module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        isolatedModules: true, // Move this configuration here
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1', // Map 'src' alias to root directory
    '^@app/(.*)$': '<rootDir>/app/$1',
    '^@common/(.*)$': '<rootDir>/common/$1',
  },
};
