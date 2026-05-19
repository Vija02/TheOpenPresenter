module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    // @tanstack/react-query v5 source uses class private methods (#field).
    // The RN 0.72 babel preset doesn't enable these by default.
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
  ],
};
