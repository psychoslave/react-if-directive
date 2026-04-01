import { defineConfig } from "tsup";
import { copyFileSync } from "fs";

export default defineConfig({
    entry: {
        index: "src/index.ts",
        vite: "src/vite.ts",
        babel: "src/babel.ts",
        nextjs: "src/nextjs.ts",
        eslint: "src/eslint.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    external: ["vite", "eslint", "@babel/core", "next"],
    onSuccess: async () => {
        // Copy JSX types to dist
        copyFileSync("src/jsx.d.ts", "dist/jsx.d.ts");
    },
});
