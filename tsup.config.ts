import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  clean: true,
  format: ["esm"],
  platform: "node",
  minify: true,
  sourcemap: true,
});
