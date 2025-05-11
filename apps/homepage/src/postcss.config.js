const path = require("path");
const tailwindConfigPath = path.resolve(__dirname, "./tailwind.config.js");

module.exports = {
  plugins: {
    "postcss-import": {},
    "@tailwindcss/postcss": {
      config: tailwindConfigPath,
    },
    autoprefixer: {},
  },
};
