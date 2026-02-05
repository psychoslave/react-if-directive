import { defineConfig } from "tsup";
import { copyFileSync } from "fs";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        vite: "src/vite.ts",
        eslint: "src/eslint.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    external: ["vite", "eslint"],
    onSuccess: async () => {
        // Copy JSX types to dist
        copyFileSync("src/jsx.d.ts", "dist/jsx.d.ts");
    },
});
