import { defineConfig, globalIgnores } from "eslint/config";
import nextCore from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCore,
  ...nextTs,
  globalIgnores([".next/**", "next-env.d.ts"]),
]);
