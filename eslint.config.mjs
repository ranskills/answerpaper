import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    ignores: [
      "assets/js/vendor/**",
      "node_modules/**",
      ".claude/**",
      ".agents/**",
      ".scratchpad/**",
      ".playwright/**",
      ".playwright-cli/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["assets/js/**/*.js"],
    languageOptions: {
      sourceType: "script",
      ecmaVersion: 2022,
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        console: "readonly",
        location: "readonly",
        self: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        Intl: "readonly",
        URL: "readonly",
        Blob: "readonly",
        FileReader: "readonly",
        alert: "readonly",
        confirm: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    rules: {
      // Files share an implicit global scope across <script> tags (no modules,
      // no imports) — see AGENTS.md "File layout". ESLint can't resolve
      // cross-file globals, so no-undef would false-positive on every
      // function/const defined in another script.
      "no-undef": "off",
      // vars: "local" skips top-level declarations too — they're routinely
      // consumed by a later <script> in the same global scope, which looks
      // "unused" from a single file's perspective. Still flags genuinely
      // unused locals/params inside function bodies.
      "no-unused-vars": ["warn", { vars: "local", args: "none" }],
    },
  },
  prettierConfig,
];
