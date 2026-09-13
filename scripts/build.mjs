// Builds the TypeScript source into the Behavior Pack's scripts/ folder using esbuild.
// External @minecraft/* modules are provided by the game runtime, not bundled.
import { build, context } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const options = {
  entryPoints: [path.join(root, "src", "main.ts")],
  outfile: path.join(root, "BP", "scripts", "main.js"),
  bundle: true,
  format: "esm",
  target: "es2020",
  platform: "neutral",
  sourcemap: true,
  external: ["@minecraft/server", "@minecraft/server-ui", "@minecraft/server-net"],
  logLevel: "info",
};

const watch = process.argv.includes("--watch");

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await build(options);
  console.log("Build complete: BP/scripts/main.js");
}
