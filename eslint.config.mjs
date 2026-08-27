import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    ".next-interview-e2e/**",
    "apps/mobile/**",
    "out/**",
    "build/**",
    ".tools/**",
    "artifacts/**",
    "next-env.d.ts",
  ]),
]);
