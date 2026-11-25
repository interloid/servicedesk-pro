import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Only the `@/` import alias from tsconfig.json; everything else is Vitest's
// defaults, as before this file existed.
export default defineConfig({
  resolve: {
    // A regex alias with a forward-slash path, so it also resolves on Windows,
    // where `fileURLToPath` would return a backslash path.
    alias: [
      {
        find: /^@\//,
        replacement: `${fileURLToPath(new URL("./src", import.meta.url)).replace(/\\/g, "/")}/`,
      },
    ],
  },
});
