module.exports = {
  extends: ["plugin:prettier/recommended"],

  parserOptions: {
    sourceType: "module",
    ecmaVersion: 8,
    ecmaFeatures: {
      experimentalObjectRestSpread: true
    }
  }
};
