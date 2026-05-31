const tseslint = require("typescript-eslint");
const js = require("@eslint/js");

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    ignores: ["out/**", "node_modules/**", ".vscode-test/**", "eslint.config.js"],
  },
  {
    rules: {
      // 允许使用 any（VS Code API 中常见）
      "@typescript-eslint/no-explicit-any": "warn",
      // 允许非空断言
      "@typescript-eslint/no-non-null-assertion": "warn",
      // 允许未使用的变量（以 _ 开头忽略）
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // 要求使用 const 而非 let
      "prefer-const": "error",
      // 禁止 console.log
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  }
);
