module.exports = {
  plugins: ["@trivago/prettier-plugin-sort-imports"],
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  tabWidth: 2,
  jsxBracketSameLine: false,
  arrowParens: "always",
  useTabs: false,
  importOrder: [
    "^containers/?(.*)$",
    "^components/?(.*)$",
    "^enum/?(.*)$",
    "^api/?(.*)$",
    "^globalState/?(.*)$",
    "^hooks/?(.*)$",
    "^[./]",
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
