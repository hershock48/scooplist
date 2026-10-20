import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The flat config ESLint 9 needs; `npm run lint` had no config file at all
// and exited 2 before it looked at a single line (20 Oct 2026).
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      // Every window.location navigation in this app is a FULL load on
      // purpose: after a 401 the cookie is gone and the server must render
      // the gate (and drop the old session's client state with it), and
      // after /setup the server-side vertical has to be re-resolved. The
      // rule guards basePath-relative destinations; this app has no
      // basePath. Off, so a real warning is never buried under five
      // deliberate ones.
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
]);
