module.exports = {
  root: true,
  extends: ["@repo/eslint-config/vite.js"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
};
