import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The workout engine is pure TypeScript: no UI framework, no database client.
  // See CLAUDE.md, Architecture rule 1.
  {
    files: ["src/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react/*", "react-dom", "react-dom/*"],
              message: "The engine must stay pure: no React inside src/engine/.",
            },
            {
              group: ["next", "next/*"],
              message: "The engine must stay pure: no Next.js inside src/engine/.",
            },
            {
              group: ["@supabase/*"],
              message: "The engine must stay pure: no Supabase inside src/engine/.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
