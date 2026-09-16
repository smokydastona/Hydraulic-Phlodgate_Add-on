/** Vendors the minimap icon set from tstamborski/pixelart-icons (CC0-1.0, public domain).
 *
 *  Run with `--download` to re-fetch from the pinned commit; the default run only re-verifies and re-syncs the
 *  already-committed PNGs into every resource-pack variant, so a normal build never touches the network.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packNames = ["RP", "RP_Aggressive", "RP_Extreme"];
const outputDirectory = ["textures", "ui", "phlodgate", "minimap"];
const provenancePath = path.join(root, "assets", "minimap-icon-provenance.json");

export const SOURCE_REPOSITORY = "https://github.com/tstamborski/pixelart-icons";
export const SOURCE_COMMIT = "5e3810b968e6f0c8507a78807e32ade7e9db2372";
export const SOURCE_LICENSE = "CC0-1.0";

/** Target icon name -> upstream png filename. */
export const ICON_SOURCES = {
  entity_player: "target16.png",
  entity_companion: "heart16.png",
  entity_passive: "happy16.png",
  entity_hostile: "ghost16.png",
  entity_boss: "star-red32.png",
  entity_villager: "coin16.png",
  waypoint_default: "flag-blue16.png",
  waypoint_active: "flag-red16.png",
  waypoint_death: "death16.png",
  waypoint_home: "home16.png",
  waypoint_offscreen: "dir-right16.png",
  marker_north: "dir-up16.png",
  marker_center: "circle16.png",
};

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function download(sourceFile) {
  const url = `https://raw.githubusercontent.com/tstamborski/pixelart-icons/${SOURCE_COMMIT}/png/${sourceFile}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  return Buffer.from(await response.arrayBuffer());
}

const shouldDownload = process.argv.includes("--download");
const primaryDirectory = path.join(root, packNames[0], ...outputDirectory);
mkdirSync(primaryDirectory, { recursive: true });

const provenance = {
  repository: SOURCE_REPOSITORY,
  commit: SOURCE_COMMIT,
  license: SOURCE_LICENSE,
  note: "Public-domain (CC0-1.0) pixel art. Attribution is not required by the license; recorded here for provenance.",
  icons: {},
};

for (const [iconName, sourceFile] of Object.entries(ICON_SOURCES)) {
  const primaryPath = path.join(primaryDirectory, `${iconName}.png`);
  let png;

  if (shouldDownload || !existsSync(primaryPath)) {
    png = await download(sourceFile);
    writeFileSync(primaryPath, png);
  } else {
    png = readFileSync(primaryPath);
  }

  provenance.icons[iconName] = { source: `png/${sourceFile}`, sha256: sha256(png) };

  for (const packName of packNames.slice(1)) {
    const directory = path.join(root, packName, ...outputDirectory);
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, `${iconName}.png`), png);
  }
}

mkdirSync(path.dirname(provenancePath), { recursive: true });
writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);

console.log(
  `Vendored ${Object.keys(ICON_SOURCES).length} CC0 minimap icons from ${SOURCE_REPOSITORY}@${SOURCE_COMMIT.slice(0, 7)} into ${packNames.length} resource packs.`
);
