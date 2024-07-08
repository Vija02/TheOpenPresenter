module.exports = {
  plugins: {
    "postcss-import": {},
    "@pandacss/dev/postcss": {
      cwd: `${__dirname}/../../../apps/homepage/src`,
    },
    autoprefixer: {},
  },
};
