import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_ENGINE_VERSION = [1, 26, 0];
const REQUIRED_SCRIPT_MODULES = new Map([
  ["@minecraft/server", "2.9.0"],
  ["@minecraft/server-ui", "2.1.0"],
]);

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${filePath}: invalid JSON (${String(error)})`);
  }
}

function listJsonFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listJsonFiles(entryPath));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(entryPath);
  }
  return files;
}

function assertUuid(value, label) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new Error(`${label}: expected a valid UUID`);
}

function assertVersion(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`${label}: expected a three-part non-negative version`);
  }
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function validateManifest(filePath, seenIds) {
  const manifest = readJson(filePath);
  if (!manifest.header || typeof manifest.header !== "object") throw new Error(`${filePath}: missing header`);
  assertUuid(manifest.header.uuid, `${filePath}: header.uuid`);
  assertVersion(manifest.header.version, `${filePath}: header.version`);
  assertVersion(manifest.header.min_engine_version, `${filePath}: header.min_engine_version`);
  if (compareVersions(manifest.header.min_engine_version, REQUIRED_ENGINE_VERSION) < 0) {
    throw new Error(`${filePath}: min_engine_version must be at least ${REQUIRED_ENGINE_VERSION.join(".")}`);
  }
  if (!Array.isArray(manifest.modules) || manifest.modules.length === 0) throw new Error(`${filePath}: missing modules`);

  const moduleIds = new Set();
  for (const [index, module] of manifest.modules.entries()) {
    assertUuid(module?.uuid, `${filePath}: modules[${index}].uuid`);
    assertVersion(module?.version, `${filePath}: modules[${index}].version`);
    if (moduleIds.has(module.uuid)) throw new Error(`${filePath}: duplicate module UUID ${module.uuid}`);
    moduleIds.add(module.uuid);
    if (seenIds.has(module.uuid)) throw new Error(`${filePath}: UUID reused by another pack/module: ${module.uuid}`);
    seenIds.add(module.uuid);
  }

  if (seenIds.has(manifest.header.uuid)) throw new Error(`${filePath}: UUID reused by another pack/module: ${manifest.header.uuid}`);
  seenIds.add(manifest.header.uuid);
  return manifest;
}

function validateUiDefinitions(filePath, packRoot) {
  const definitions = readJson(filePath);
  if (!Array.isArray(definitions.ui_defs) || definitions.ui_defs.some((entry) => typeof entry !== "string" || !entry.endsWith(".json"))) {
    throw new Error(`${filePath}: ui_defs must be an array of JSON file paths`);
  }
  for (const definition of definitions.ui_defs) {
    const target = path.resolve(packRoot, definition);
    if (!target.startsWith(`${path.resolve(packRoot)}${path.sep}`) || !existsSync(target)) {
      throw new Error(`${filePath}: referenced UI definition does not exist: ${definition}`);
    }
  }
}

function validateCompanionAssets(root) {
  const catalogPath = path.join(root, "src", "features", "companion", "CompanionPetPlan.ts");
  const catalog = readFileSync(catalogPath, "utf8");
  const explicitSpeciesIds = [...catalog.matchAll(/entityTypeId:\s*"phlodgate:companion_([a-z0-9_]+)"/g)].map((match) => match[1]);
  const babySpeciesIds = [...catalog.matchAll(/babyAnimal\("([a-z0-9_]+)"/g)].map((match) => match[1]);
  const speciesIds = [...new Set([...explicitSpeciesIds, ...babySpeciesIds])];
  if (speciesIds.length !== 40) throw new Error(`${catalogPath}: expected 40 unique companion species, found ${speciesIds.length}`);
  const balancedTextureHashes = new Map();

  for (const speciesId of speciesIds) {
    const behaviorPath = path.join(root, "BP", "entities", `companion_${speciesId}.json`);
    if (!existsSync(behaviorPath)) throw new Error(`Missing companion behavior: ${behaviorPath}`);
    const behavior = readJson(behaviorPath)?.["minecraft:entity"];
    const components = behavior?.components ?? {};
    if (components["minecraft:is_tamed"]) throw new Error(`${behaviorPath}: base components must not pre-apply minecraft:is_tamed`);
    if (components["minecraft:tameable"]?.tame_event?.event !== "phlodgate:on_tame") {
      throw new Error(`${behaviorPath}: tameable must assign ownership through phlodgate:on_tame`);
    }
    if (!behavior?.component_groups?.["phlodgate:tamed"]?.["minecraft:is_tamed"]) {
      throw new Error(`${behaviorPath}: missing phlodgate:tamed component group`);
    }
    const damageTrigger = components["minecraft:damage_sensor"]?.triggers;
    if (damageTrigger?.cause !== "all" || damageTrigger?.deals_damage !== "no") {
      throw new Error(`${behaviorPath}: companion must reject all damage`);
    }
    const behaviorText = JSON.stringify(behavior);
    for (const hostileComponent of ["minecraft:attack", "minecraft:behavior.melee_attack", "minecraft:behavior.melee_box_attack", "minecraft:behavior.nearest_attackable_target"]) {
      if (behaviorText.includes(`\"${hostileComponent}\"`)) throw new Error(`${behaviorPath}: hostile component ${hostileComponent} is forbidden`);
    }

    for (const packName of ["RP", "RP_Aggressive", "RP_Extreme"]) {
      const clientEntityPath = path.join(root, packName, "entity", `companion_${speciesId}.json`);
      const texturePath = path.join(root, packName, "textures", "entity", "phlodgate", `companion_${speciesId}.png`);
      if (!existsSync(clientEntityPath)) throw new Error(`Missing companion client entity: ${clientEntityPath}`);
      if (!existsSync(texturePath)) throw new Error(`Missing companion texture: ${texturePath}`);

      const clientEntity = readJson(clientEntityPath);
      const expectedTexture = `textures/entity/phlodgate/companion_${speciesId}`;
      const textures = Object.values(clientEntity?.["minecraft:client_entity"]?.description?.textures ?? {});
      if (!textures.includes(expectedTexture)) {
        throw new Error(`${clientEntityPath}: must reference its unique texture ${expectedTexture}`);
      }
      const lang = readFileSync(path.join(root, packName, "texts", "en_US.lang"), "utf8");
      if (!lang.includes(`entity.phlodgate:companion_${speciesId}.name=`)) {
        throw new Error(`${packName}/texts/en_US.lang: missing companion_${speciesId} localization`);
      }
      if (packName === "RP") {
        const hash = createHash("sha256").update(readFileSync(texturePath)).digest("hex");
        const duplicate = balancedTextureHashes.get(hash);
        if (duplicate) throw new Error(`${texturePath}: texture duplicates companion_${duplicate}.png`);
        balancedTextureHashes.set(hash, speciesId);
      }
    }
  }
}

export function validateRelease(root) {
  const packNames = ["BP", "RP", "RP_Aggressive", "RP_Extreme"];
  const manifests = new Map();
  const seenIds = new Set();

  for (const packName of packNames) {
    const packRoot = path.join(root, packName);
    if (!existsSync(packRoot)) throw new Error(`Missing pack directory: ${packName}`);
    const manifestPath = path.join(packRoot, "manifest.json");
    if (!existsSync(manifestPath)) throw new Error(`${packName}: missing manifest.json`);
    manifests.set(packName, validateManifest(manifestPath, seenIds));

    for (const jsonFile of listJsonFiles(packRoot)) {
      if (path.basename(jsonFile) === "manifest.json") continue;
      readJson(jsonFile);
      if (path.basename(jsonFile) === "_ui_defs.json") validateUiDefinitions(jsonFile, packRoot);
    }
  }

  // BP intentionally does NOT hard-depend on any single resource pack header UUID: three alternate RP
  // variants (Balanced/Aggressive/Extreme) ship together and the player enables exactly one per world. A hard
  // pack dependency on one specific RP UUID caused Bedrock to report a "missing dependency" warning whenever a
  // player enabled a different variant, even though the pack still worked. Enforce that this stays removed.
  const behaviorDependencies = manifests.get("BP").dependencies ?? [];
  const resourcePackUuids = new Set(["RP", "RP_Aggressive", "RP_Extreme"].map((name) => manifests.get(name).header.uuid));
  const hardPackDependency = behaviorDependencies.find((dependency) => typeof dependency?.uuid === "string" && resourcePackUuids.has(dependency.uuid));
  if (hardPackDependency) {
    throw new Error(
      `BP/manifest.json: must not hard-depend on a single resource pack variant (found dependency on ${hardPackDependency.uuid}); players choose one of the three RP variants themselves.`
    );
  }
  for (const [moduleName, version] of REQUIRED_SCRIPT_MODULES) {
    const dependency = behaviorDependencies.find((entry) => entry?.module_name === moduleName);
    if (dependency?.version !== version) {
      throw new Error(`BP/manifest.json: ${moduleName} must use stable version ${version}`);
    }
  }

  const scriptPath = path.join(root, "BP", "scripts", "main.js");
  if (!existsSync(scriptPath)) throw new Error("BP/scripts/main.js is missing; run the build before packaging");

  validateCompanionAssets(root);

  return { packs: packNames, manifestCount: manifests.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  try {
    const result = validateRelease(root);
    console.log(`Release validation passed: ${result.manifestCount} manifests and ${result.packs.length} packs checked.`);
  } catch (error) {
    console.error(`Release validation failed: ${String(error)}`);
    process.exitCode = 1;
  }
}