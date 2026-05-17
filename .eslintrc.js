module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
  },
  plugins: ["n"],
  rules: {
    // catch real bugs
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-undef": "error",
    "no-unreachable": "error",
    "no-constant-condition": "error",
    "eqeqeq": ["error", "always", { null: "ignore" }],
    "no-var": "error",

    // security / production hygiene
    "no-console": ["warn", { allow: ["warn", "error"] }],

    // node-specific
    "n/no-missing-require": "error",
    "n/no-extraneous-require": "error",
    "n/handle-callback-err": "error",
  },
  ignorePatterns: ["node_modules/", "scripts/", "tests/", "*.test.js"],
};
