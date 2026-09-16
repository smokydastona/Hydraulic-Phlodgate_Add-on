import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_ENGINE_VERSION = [1, 26, 51];
const REQUIRED_SCRIPT_MODULES = new Map([
  ["@minecraft/server", "2.10.0"],
  ["@minecraft/server-ui", "2.2.0"],
]);
const RIDEABLE_COMPANIONS = new Set(["spider", "sniffer", "ravager"]);
const ACCESSORY_ITEMS = new Map([
  ["trinket_cabinet", "phlodgate:trinket_cabinet"],
  ["speed_ring", "phlodgate:speed_ring"],
  ["water_necklace", "phlodgate:water_necklace"],
  ["feather_charm", "phlodgate:feather_charm"],
  ["fire_charm", "phlodgate:fire_charm"],
  ["night_amulet", "phlodgate:night_amulet"],
  ["vitality_bracelet", "phlodgate:vitality_bracelet"],
  ["haste_gloves", "phlodgate:haste_gloves"],
]);
const REQUIRED_PACK_ICON = "pack_icon.png";

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
  // _ui_defs registers NEW ui files only. Vanilla screen overrides are merged by path automatically, and
  // listing one here makes the engine load it as a separate screen instead of applying it as an override.
  for (const vanillaScreen of ["ui/hud_screen.json", "ui/pause_screen.json", "ui/inventory_screen.json"]) {
    if (definitions.ui_defs.includes(vanillaScreen)) {
      throw new Error(`${filePath}: must not register vanilla override ${vanillaScreen}`);
    }
  }
  for (const definition of definitions.ui_defs) {
    const target = path.resolve(packRoot, definition);
    if (!target.startsWith(`${path.resolve(packRoot)}${path.sep}`) || !existsSync(target)) {
      throw new Error(`${filePath}: referenced UI definition does not exist: ${definition}`);
    }
  }
}

function validateHudDefinition(filePath) {
  const hud = readJson(filePath);
  const serialized = JSON.stringify(hud);
  for (const marker of [
    "[PGL:TL1]",
    "[PGL:TL2]",
    "[PGL:TR1]",
    "[PGL:TR2]",
    "[PGL:BL1]",
    "[PGL:BL2]",
    "[PGL:BR1]",
    "[PGL:BR2]",
  ]) {
    if (!serialized.includes(marker)) throw new Error(`${filePath}: missing minimap routing marker ${marker}`);
  }
  if (hud["hud_title_text/subtitle_frame/subtitle_background"]?.ignored !== true) {
    throw new Error(`${filePath}: compass subtitle background must be ignored`);
  }

  // Bedrock cannot run operators directly on the hardcoded $actionbar_text variable; it has to be copied into
  // a normal variable first. Every control that compares actionbar text must therefore declare its own copy,
  // and no control may reference $actionbar_text inside an expression. Shipping that mistake made the minimap
  // silently never match its routing marker.
  const stack = [hud];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    const copiesActionbarText = node.$atext === "$actionbar_text";
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string" && key !== "$atext" && value.includes("$actionbar_text")) {
        throw new Error(
          `${filePath}: "${key}" uses $actionbar_text directly; copy it into $atext first or the comparison never matches`
        );
      }
      if (typeof value === "string" && value.includes("$atext") && key !== "$atext" && !copiesActionbarText) {
        throw new Error(`${filePath}: "${key}" uses $atext without declaring "$atext": "$actionbar_text" on the same control`);
      }
      if (value && typeof value === "object") stack.push(value);
    }
  }

  // New actionbar-driven controls must come from a hud_actionbar_text_factory injected into root_panel; that is
  // the only documented way to receive $actionbar_text in a control we own.
  const factory = hud["phlodgate_minimap_factory"];
  if (factory?.factory?.name !== "hud_actionbar_text_factory") {
    throw new Error(`${filePath}: minimap must be driven by a hud_actionbar_text_factory`);
  }
  if (!Array.isArray(hud["root_panel"]?.modifications)) {
    throw new Error(`${filePath}: the minimap factory must be inserted into root_panel via modifications`);
  }

  const cornerControls = hud["phlodgate_minimap_root"]?.controls ?? [];
  const cornerNames = cornerControls.flatMap((entry) => Object.keys(entry).map((key) => key.split("@")[0]));
  if (cornerNames.length !== 8) {
    throw new Error(`${filePath}: expected all 8 minimap corner/size controls, found ${cornerNames.length}`);
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
    if (RIDEABLE_COMPANIONS.has(speciesId)) {
      if (!components["minecraft:rideable"] || !components["minecraft:input_ground_controlled"]) {
        throw new Error(`${behaviorPath}: rideable companions require minecraft:rideable and minecraft:input_ground_controlled`);
      }
      if (components["minecraft:item_controllable"] || components["minecraft:behavior.controlled_by_player"]) {
        throw new Error(`${behaviorPath}: saddle-free mounts must not require item-based control components`);
      }
      // Without a jump strength the rider cannot make the mount jump at all.
      if (!components["minecraft:horse.jump_strength"]) {
        throw new Error(`${behaviorPath}: rideable companions must define minecraft:horse.jump_strength so the rider can jump`);
      }
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

function validateMinimapArtSet(packRoot) {
  const artDirectory = path.join(packRoot, "textures", "ui", "phlodgate", "minimap");
  const required = [
    "frame_square",
    "frame_circle",
    "frame_cave",
    "entity_player",
    "entity_companion",
    "entity_passive",
    "entity_hostile",
    "entity_boss",
    "entity_villager",
    "waypoint_default",
    "waypoint_active",
    "waypoint_death",
    "waypoint_home",
    "waypoint_offscreen",
    "marker_north",
    "marker_center",
  ];

  for (const name of required) {
    const texturePath = path.join(artDirectory, `${name}.png`);
    if (!existsSync(texturePath)) throw new Error(`Missing minimap art asset: ${texturePath}`);
  }

  // Terrain cell color is derived from the real block type id at runtime, so no per-block tile art may ship:
  // a fixed tile set could never cover unknown or future blocks.
  for (const stalePrefix of ["block_", "cave_"]) {
    const stale = readdirSync(artDirectory).filter((entry) => entry.startsWith(stalePrefix));
    if (stale.length > 0) {
      throw new Error(`${artDirectory}: per-block tile art is not supported (${stale.join(", ")})`);
    }
  }
}

function validateMinimapIconProvenance(root) {
  const provenancePath = path.join(root, "assets", "minimap-icon-provenance.json");
  if (!existsSync(provenancePath)) throw new Error(`Missing minimap icon provenance record: ${provenancePath}`);

  const provenance = readJson(provenancePath);
  if (provenance.license !== "CC0-1.0") {
    throw new Error(`${provenancePath}: vendored minimap icons must stay under a public-domain CC0-1.0 license`);
  }
  if (!/^[0-9a-f]{40}$/.test(provenance.commit ?? "")) {
    throw new Error(`${provenancePath}: upstream commit must be pinned to a full sha`);
  }

  for (const packName of ["RP", "RP_Aggressive", "RP_Extreme"]) {
    for (const [iconName, entry] of Object.entries(provenance.icons ?? {})) {
      const iconPath = path.join(root, packName, "textures", "ui", "phlodgate", "minimap", `${iconName}.png`);
      if (!existsSync(iconPath)) throw new Error(`Missing vendored minimap icon: ${iconPath}`);
      const hash = createHash("sha256").update(readFileSync(iconPath)).digest("hex");
      if (hash !== entry.sha256) {
        throw new Error(`${iconPath}: does not match recorded provenance hash for ${entry.source}`);
      }
    }
  }
}

function validateAccessoryAssets(root) {
  const catalogPath = path.join(root, "src", "features", "accessories", "AccessoryPlan.ts");
  const catalog = readFileSync(catalogPath, "utf8");
  for (const [fileStem, itemId] of ACCESSORY_ITEMS) {
    if (fileStem !== "trinket_cabinet" && !catalog.includes(`itemTypeId: "${itemId}"`)) {
      throw new Error(`${catalogPath}: missing catalog entry ${itemId}`);
    }
    const itemPath = path.join(root, "BP", "items", `${fileStem}.json`);
    if (!existsSync(itemPath)) throw new Error(`Missing accessory item definition: ${itemPath}`);
    const item = readJson(itemPath)?.["minecraft:item"];
    if (item?.description?.identifier !== itemId) throw new Error(`${itemPath}: identifier must be ${itemId}`);
    if (item?.components?.["minecraft:max_stack_size"] !== 1) throw new Error(`${itemPath}: accessories must be non-stackable`);
  }

  for (const packName of ["RP", "RP_Aggressive", "RP_Extreme"]) {
    const languagePath = path.join(root, packName, "texts", "en_US.lang");
    const language = readFileSync(languagePath, "utf8");
    for (const fileStem of ACCESSORY_ITEMS.keys()) {
      if (!language.includes(`item.phlodgate:${fileStem}.name=`)) {
        throw new Error(`${languagePath}: missing localization for ${fileStem}`);
      }
    }
  }
}

export function validateRelease(root) {
  const packNames = ["BP", "RP", "RP_Aggressive", "RP_Extreme"];
  const manifests = new Map();
  const seenIds = new Set();

  validateMinimapIconProvenance(root);
  validateAccessoryAssets(root);

  for (const packName of packNames) {
    const packRoot = path.join(root, packName);
    if (!existsSync(packRoot)) throw new Error(`Missing pack directory: ${packName}`);
    if (!existsSync(path.join(packRoot, REQUIRED_PACK_ICON))) {
      throw new Error(`${packName}: missing ${REQUIRED_PACK_ICON}`);
    }
    const manifestPath = path.join(packRoot, "manifest.json");
    if (!existsSync(manifestPath)) throw new Error(`${packName}: missing manifest.json`);
    manifests.set(packName, validateManifest(manifestPath, seenIds));

    for (const jsonFile of listJsonFiles(packRoot)) {
      if (path.basename(jsonFile) === "manifest.json") continue;
      readJson(jsonFile);
      if (path.basename(jsonFile) === "_ui_defs.json") validateUiDefinitions(jsonFile, packRoot);
      if (path.basename(jsonFile) === "hud_screen.json") validateMinimapArtSet(packRoot);
      if (path.basename(jsonFile) === "hud_screen.json") validateHudDefinition(jsonFile);
    }
  }

  // BP intentionally does NOT hard-depend on any single resource pack header UUID: three alternate RP
  // variants (Balanced/Aggressive/Extreme) ship together and the player enables exactly one per world. A hard
  // pack dependency on one specific RP UUID caused Bedrock to report a "missing dependency" warning whenever a
  // player enabled a different variant, even though the pack still worked. Enforce that this stays removed.
  const behaviorDependencies = manifests.get("BP").dependencies ?? [];
  const packageManifest = readJson(path.join(root, "package.json"));
  const expectedPackVersion = [1, 0, Number(packageManifest.version.split(".")[2])];
  for (const [packName, manifest] of manifests) {
    if (compareVersions(manifest.header.version, expectedPackVersion) !== 0) {
      throw new Error(`${packName}/manifest.json: pack version must match npm release ${expectedPackVersion.join(".")}`);
    }
    for (const module of manifest.modules) {
      if (compareVersions(module.version, manifest.header.version) !== 0) {
        throw new Error(`${packName}/manifest.json: module ${module.uuid} version must match its header`);
      }
    }
  }
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
    if (packageManifest.devDependencies?.[moduleName] !== version) {
      throw new Error(`package.json: ${moduleName} must exactly match manifest version ${version}`);
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