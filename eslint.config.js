import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "src/generated/**"] },
  { files: ["src/**/*.ts", "scripts/**/*.ts"], extends: [js.configs.recommended, tseslint.configs.recommended] },
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts", "src/generated/**"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { project: "./tsconfig.check.json", tsconfigRootDir: import.meta.dirname } },
  },
  {
    files: ["src/**/*.test.ts", "scripts/**/*.test.ts", "scripts/generate-openapi.ts", "scripts/ci/test-release-workflows.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
