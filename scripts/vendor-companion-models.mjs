/** Vendors real, Blockbench-editable geometry for every companion species.
 *
 *  Each companion currently points at a vanilla geometry identifier, which cannot be opened or edited. This
 *  script resolves that identifier inside Mojang's official `bedrock-samples` resource pack, copies the model
 *  into this pack under `geometry.phlodgate.companion_<species>`, and repoints the client entity at the copy.
 *  Bone names are preserved, so the reused vanilla animations and render controllers keep working.
 *
 *  Run with `--download` to re-fetch from the pinned commit; the default run re-syncs the already-committed
 *  models into every resource-pack variant without touching the network.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packNames = ["RP", "RP_Aggressive", "RP_Extreme"];
const modelDirectory = ["models", "entity", "phlodgate"];
const provenancePath = path.join(root, "assets", "companion-model-provenance.json");

export const SOURCE_REPOSITORY = "https://github.com/Mojang/bedrock-samples";
export const SOURCE_COMMIT = "46ba6ea985fb5a92d79a9419198f10dda14c199d";
export const SOURCE_LICENSE = "Minecraft End User License Agreement (official sample content)";

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function listSpecies() {
  const entityDirectory = path.join(root, packNames[0], "entity");
  return readdirSync(entityDirectory)
    .filter((entry) => entry.startsWith("companion_") && entry.endsWith(".json"))
    .map((entry) => entry.slice("companion_".length, -".json".length))
    .sort();
}

function vanillaGeometryFor(speciesId) {
  const clientEntity = readJson(path.join(root, packNames[0], "entity", `companion_${speciesId}.json`));
  const geometry = clientEntity?.["minecraft:client_entity"]?.description?.geometry ?? {};
  const identifier = geometry.default;
  if (typeof identifier !== "string" || !identifier.startsWith("geometry.")) {
    throw new Error(`companion_${speciesId}.json: expected a vanilla geometry.* identifier, found ${identifier}`);
  }
  // Once repointed at our own copy the client entity no longer names the vanilla source, so the recorded
  // provenance becomes the authoritative mapping.
  if (identifier.startsWith("geometry.phlodgate.")) {
    const recorded = existsSync(provenancePath)
      ? readJson(provenancePath).models?.[`companion_${speciesId}`]?.vanillaIdentifier
      : undefined;
    if (typeof recorded !== "string") {
      throw new Error(
        `companion_${speciesId}.json already points at ${identifier} but assets/companion-model-provenance.json has no vanillaIdentifier for it`
      );
    }
    return recorded;
  }
  return identifier;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "phlodgate-add-on" } });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  return response.json();
}

/** Builds identifier -> geometry for every model in the sample pack. Mojang ships two formats: modern
 *  per-entity files under models/entity (a "minecraft:geometry" array) and a legacy 1.8 combined file whose
 *  top-level keys are the geometry identifiers. Both are Blockbench-editable, so both are indexed. */
async function buildGeometryIndex() {
  const tree = await fetchJson(
    `https://api.github.com/repos/Mojang/bedrock-samples/git/trees/${SOURCE_COMMIT}?recursive=1`
  );
  const files = (tree.tree ?? []).filter(
    (entry) => entry.type === "blob" && entry.path.startsWith("resource_pack/models/") && entry.path.endsWith(".json")
  );

  const index = new Map();
  for (const file of files) {
    const url = `https://raw.githubusercontent.com/Mojang/bedrock-samples/${SOURCE_COMMIT}/${file.path}`;
    let model;
    try {
      model = await fetchJson(url);
    } catch {
      continue;
    }

    for (const geometry of model["minecraft:geometry"] ?? []) {
      const identifier = geometry?.description?.identifier;
      if (typeof identifier === "string" && !index.has(identifier)) {
        index.set(identifier, { format: "modern", geometry, sourcePath: file.path });
      }
    }

    for (const [key, value] of Object.entries(model)) {
      if (!key.startsWith("geometry.") || !value || typeof value !== "object") continue;
      // Legacy entries may carry an inheritance suffix such as "geometry.horse:geometry.base".
      const identifier = key.split(":")[0];
      if (!index.has(identifier)) {
        index.set(identifier, { format: "legacy", key, geometry: value, sourcePath: file.path });
      }
    }
  }
  return index;
}

const shouldDownload = process.argv.includes("--download");
const species = listSpecies();
const primaryDirectory = path.join(root, packNames[0], ...modelDirectory);
mkdirSync(primaryDirectory, { recursive: true });

// Resolve every mapping before writing anything, so a failure part-way through cannot leave the packs in a
// half-repointed state that hides the original vanilla identifiers from a re-run.
const vanillaIdentifiers = new Map(species.map((speciesId) => [speciesId, vanillaGeometryFor(speciesId)]));

let index;
if (shouldDownload) {
  index = await buildGeometryIndex();
  const missing = [...vanillaIdentifiers.entries()].filter(([, identifier]) => !index.has(identifier));
  if (missing.length > 0) {
    throw new Error(
      `No sample geometry found for: ${missing.map(([speciesId, identifier]) => `${identifier} (companion_${speciesId})`).join(", ")}`
    );
  }
}

const provenance = {
  repository: SOURCE_REPOSITORY,
  commit: SOURCE_COMMIT,
  license: SOURCE_LICENSE,
  note: "Official Mojang sample geometry, re-identified under geometry.phlodgate.* so the models can be opened and edited in Blockbench. Bone names are unchanged so the reused vanilla animations still bind.",
  models: {},
};

let written = 0;
for (const speciesId of species) {
  const targetIdentifier = `geometry.phlodgate.companion_${speciesId}`;
  const primaryPath = path.join(primaryDirectory, `companion_${speciesId}.geo.json`);
  let model;

  if (shouldDownload || !existsSync(primaryPath)) {
    const vanillaIdentifier = vanillaIdentifiers.get(speciesId);
    const found = index?.get(vanillaIdentifier);
    if (!found) throw new Error(`No sample geometry found for ${vanillaIdentifier} (companion_${speciesId})`);

    const geometry = JSON.parse(JSON.stringify(found.geometry));
    if (found.format === "modern") {
      geometry.description.identifier = targetIdentifier;
      model = { format_version: "1.12.0", "minecraft:geometry": [geometry] };
    } else {
      model = { format_version: "1.8.0", [targetIdentifier]: geometry };
    }
    writeJson(primaryPath, model);
    written++;
    provenance.models[`companion_${speciesId}`] = { source: found.sourcePath, vanillaIdentifier };
  } else {
    model = readJson(primaryPath);
    const existingProvenance = existsSync(provenancePath) ? readJson(provenancePath).models ?? {} : {};
    provenance.models[`companion_${speciesId}`] = existingProvenance[`companion_${speciesId}`] ?? {
      source: "resource_pack/models/entity/",
      vanillaIdentifier: vanillaIdentifiers.get(speciesId),
    };
  }

  const actualIdentifier =
    model["minecraft:geometry"]?.[0]?.description?.identifier ??
    Object.keys(model).find((key) => key.startsWith("geometry."));
  if (actualIdentifier !== targetIdentifier) {
    throw new Error(`${primaryPath}: identifier must be ${targetIdentifier}, found ${actualIdentifier}`);
  }
  provenance.models[`companion_${speciesId}`].sha256 = createHash("sha256")
    .update(readFileSync(primaryPath))
    .digest("hex");

  for (const packName of packNames) {
    const directory = path.join(root, packName, ...modelDirectory);
    mkdirSync(directory, { recursive: true });
    if (packName !== packNames[0]) writeJson(path.join(directory, `companion_${speciesId}.geo.json`), model);

    // Repoint the client entity at the editable copy.
    const clientEntityPath = path.join(root, packName, "entity", `companion_${speciesId}.json`);
    const clientEntity = readJson(clientEntityPath);
    const description = clientEntity["minecraft:client_entity"].description;
    if (description.geometry?.default !== targetIdentifier) {
      description.geometry = { ...description.geometry, default: targetIdentifier };
      writeJson(clientEntityPath, clientEntity);
    }
  }
}

mkdirSync(path.dirname(provenancePath), { recursive: true });
writeJson(provenancePath, provenance);

console.log(
  `Companion models: ${species.length} editable geometries per pack across ${packNames.length} resource packs (${written} newly vendored).`
);
