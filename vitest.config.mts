import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Only the `@/` import alias from tsconfig.json; everything else is Vitest's
// defaults, as before this file existed.
export default defineConfig({
  resolve: {
    alias: {
      "@/": fileURLToPath(new URL("./src/", import.meta.url)),
    },
  },
});
