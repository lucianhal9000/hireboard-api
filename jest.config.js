/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testTimeout: 30000,
  collectCoverageFrom: ["src/**/*.ts", "!src/index.ts"],
};
