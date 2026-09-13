// Packages BP/ and RP/ into a distributable .mcaddon (a zip containing both .mcpack files),
// plus produces standalone Aggressive/Extreme resource pack .mcpack variants.
import archiver from "archiver";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist");

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

/** @param {string} srcDir @param {string} outFile */
function zipDir(srcDir, outFile) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outFile);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(srcDir, false);
    archive.finalize();
  });
}

async function main() {
  const version = process.env.npm_package_version ?? "0.1.0";

  const targets = [
    { dir: path.join(root, "BP"), out: path.join(outDir, `Phlodgate_BP_v${version}.mcpack`) },
    { dir: path.join(root, "RP"), out: path.join(outDir, `Phlodgate_RP_v${version}.mcpack`) },
    { dir: path.join(root, "RP_Aggressive"), out: path.join(outDir, `Phlodgate_RP_Aggressive_v${version}.mcpack`) },
    { dir: path.join(root, "RP_Extreme"), out: path.join(outDir, `Phlodgate_RP_Extreme_v${version}.mcpack`) },
  ].filter((t) => existsSync(t.dir));

  for (const t of targets) {
    await zipDir(t.dir, t.out);
    console.log(`Packed ${path.basename(t.out)}`);
  }

  // .mcaddon bundles the default BP + default RP so Minecraft imports both at once.
  const addonOut = path.join(outDir, `Phlodgate_Add-on_v${version}.mcaddon`);
  await new Promise((resolve, reject) => {
    const output = createWriteStream(addonOut);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(path.join(root, "BP"), "BP");
    archive.directory(path.join(root, "RP"), "RP");
    archive.finalize();
  });
  console.log(`Packed ${path.basename(addonOut)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
