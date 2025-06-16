/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["@repo/eslint-config/react-internal.js", "plugin:storybook/recommended"],
  parser: "@typescript-eslint/parser",
  rules: {
    "no-redeclare": 0,
  },
};
