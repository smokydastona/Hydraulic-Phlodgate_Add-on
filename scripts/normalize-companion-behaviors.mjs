import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entityDirectory = path.join(root, "BP", "entities");
const files = readdirSync(entityDirectory).filter((name) => name.startsWith("companion_") && name.endsWith(".json"));

for (const fileName of files) {
  const filePath = path.join(entityDirectory, fileName);
  const document = JSON.parse(readFileSync(filePath, "utf8"));
  const entity = document["minecraft:entity"];
  const components = entity.components ?? (entity.components = {});

  delete components["minecraft:is_tamed"];
  components["minecraft:tameable"] = {
    probability: 1,
    tame_items: [],
    tame_event: { event: "phlodgate:on_tame", target: "self" },
  };

  entity.component_groups = {
    ...(entity.component_groups ?? {}),
    "phlodgate:tamed": { "minecraft:is_tamed": {} },
  };
  entity.events = {
    ...(entity.events ?? {}),
    "phlodgate:on_tame": { add: { component_groups: ["phlodgate:tamed"] } },
  };

  writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`);
}

console.log(`Normalized tame ownership lifecycle for ${files.length} companion behaviors.`);
