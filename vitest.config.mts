import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

// The `@/` import alias from tsconfig.json, and one exclude; everything else is
// Vitest's defaults.
export default defineConfig({
  test: {
    // .claude/ is gitignored and can hold whole copies of the repo (agent
    // worktrees), whose tests would otherwise run, and fail, alongside ours.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
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
