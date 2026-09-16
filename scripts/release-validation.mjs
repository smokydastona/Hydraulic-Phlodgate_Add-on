import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function validateManifest(filePath, seenIds) {
  const manifest = readJson(filePath);
  if (!manifest.header || typeof manifest.header !== "object") throw new Error(`${filePath}: missing header`);
  assertUuid(manifest.header.uuid, `${filePath}: header.uuid`);
  assertVersion(manifest.header.version, `${filePath}: header.version`);
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

  const behaviorDependencies = manifests.get("BP").dependencies ?? [];
  const balancedResourcePack = manifests.get("RP").header.uuid;
  const balancedDependency = behaviorDependencies.find((dependency) => dependency?.uuid === balancedResourcePack);
  if (!balancedDependency) throw new Error(`BP/manifest.json: missing dependency on RP header ${balancedResourcePack}`);
  assertVersion(balancedDependency.version, "BP/manifest.json: balanced RP dependency version");

  const scriptPath = path.join(root, "BP", "scripts", "main.js");
  if (!existsSync(scriptPath)) throw new Error("BP/scripts/main.js is missing; run the build before packaging");

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