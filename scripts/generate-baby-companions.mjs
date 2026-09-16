import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packs = ["RP", "RP_Aggressive", "RP_Extreme"];
const baseUrl = "https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/entity";

const babies = [
  { id: "baby_armadillo", source: "armadillo.entity.json", family: "armadillo", scale: 0.5 },
  { id: "baby_axolotl", source: "axolotl.entity.json", family: "axolotl", scale: 0.5, movement: "amphibious" },
  { id: "baby_bee", source: "bee.entity.json", family: "bee", scale: 0.5, movement: "hover" },
  { id: "baby_camel", source: "camel.entity.json", family: "camel", scale: 0.5 },
  { id: "baby_cat", source: "cat.entity.json", family: "cat", scale: 0.4 },
  { id: "baby_chicken", source: "chicken.entity.json", family: "chicken", scale: 0.5 },
  { id: "baby_cow", source: "cow.entity.json", family: "cow", scale: 0.5 },
  { id: "baby_donkey", source: "donkey_v1.entity.json", family: "donkey", scale: 0.5 },
  { id: "baby_fox", source: "fox.entity.json", family: "fox", scale: 0.5 },
  { id: "baby_goat", source: "goat.entity.json", family: "goat", scale: 0.5 },
  { id: "baby_hoglin", source: "hoglin.entity.json", family: "hoglin", scale: 0.5 },
  { id: "baby_horse", source: "horse_v1.entity.json", family: "horse", scale: 0.5 },
  { id: "baby_llama", source: "llama.entity.json", family: "llama", scale: 0.5 },
  { id: "baby_mooshroom", source: "mooshroom.entity.json", family: "mooshroom", scale: 0.5 },
  { id: "baby_mule", source: "mule_v1.entity.json", family: "mule", scale: 0.5 },
  { id: "baby_ocelot", source: "ocelot.entity.json", family: "ocelot", scale: 0.5 },
  { id: "baby_panda", source: "panda.entity.json", family: "panda", scale: 0.5 },
  { id: "baby_pig", source: "pig.entity.json", family: "pig", scale: 0.5 },
  { id: "baby_polar_bear", source: "polar_bear.entity.json", family: "polar_bear", scale: 0.5 },
  { id: "baby_rabbit", source: "rabbit.entity.json", family: "rabbit", scale: 0.4 },
  { id: "baby_sheep", source: "sheep.entity.json", family: "sheep", scale: 0.5 },
  { id: "baby_sniffer", source: "sniffer.entity.json", family: "sniffer", scale: 0.45 },
  { id: "baby_strider", source: "strider.entity.json", family: "strider", scale: 0.5, movement: "lava" },
  { id: "baby_turtle", source: "turtle.entity.json", family: "turtle", scale: 0.5, movement: "amphibious" },
  { id: "baby_wolf", source: "wolf.entity.json", family: "wolf", scale: 0.5 },
  { id: "tadpole", source: "tadpole.entity.json", family: "tadpole", scale: 1, movement: "amphibious" },
];

function behaviorFor(entry) {
  const navigation = entry.movement === "hover"
    ? { "minecraft:navigation.hover": { can_path_over_water: true, can_sink: false, can_path_from_air: true, avoid_damage_blocks: true } }
    : entry.movement === "amphibious"
      ? { "minecraft:navigation.generic": { is_amphibious: true, can_path_over_water: true, can_swim: true, can_walk: true, can_sink: false, avoid_damage_blocks: true } }
      : { "minecraft:navigation.walk": { can_path_over_water: true, can_path_over_lava: entry.movement === "lava", avoid_damage_blocks: entry.movement !== "lava" } };
  const movement = entry.movement === "hover"
    ? { "minecraft:movement.hover": {}, "minecraft:can_fly": {}, "minecraft:flying_speed": { value: 0.15 } }
    : entry.movement === "amphibious"
      ? { "minecraft:movement.amphibious": { max_turn: 15 }, "minecraft:underwater_movement": { value: 0.2 } }
      : { "minecraft:movement.basic": {} };

  return {
    format_version: "1.21.80",
    "minecraft:entity": {
      description: { identifier: `phlodgate:companion_${entry.id}`, is_spawnable: false, is_summonable: true, is_experimental: false },
      components: {
        "minecraft:type_family": { family: ["phlodgate_companion", entry.family, "mob"] },
        "minecraft:collision_box": { width: 0.6, height: 0.7 },
        "minecraft:health": { value: 20, max: 20 },
        "minecraft:knockback_resistance": { value: 1 },
        "minecraft:fire_immune": true,
        "minecraft:damage_sensor": { triggers: { cause: "all", deals_damage: "no" } },
        "minecraft:breathable": { total_supply: 15, suffocate_time: 0, breathes_water: entry.movement === "amphibious", breathes_air: true },
        "minecraft:physics": {},
        "minecraft:movement": { value: 0.3 },
        ...movement,
        ...navigation,
        "minecraft:jump.static": {},
        "minecraft:nameable": {},
        "minecraft:is_baby": {},
        "minecraft:scale": { value: entry.scale },
        "minecraft:tameable": { probability: 1, tame_items: [] },
        "minecraft:sittable": {},
        "minecraft:leashable": { unleash_on_removal: false },
        "minecraft:behavior.stay_while_sitting": { priority: 0 },
        "minecraft:behavior.follow_owner": { priority: 1, speed_multiplier: 1, start_distance: 10, stop_distance: 2, post_teleport_distance: -1, ignore_vibration: true },
        "minecraft:behavior.teleport_to_owner": { priority: 2, filters: { test: "owner_distance", operator: ">", value: 24 } },
        "minecraft:behavior.look_at_player": { priority: 8, look_distance: 6, probability: 0.02 },
      },
    },
  };
}

for (const entry of babies) {
  const response = await fetch(`${baseUrl}/${entry.source}`);
  if (!response.ok) throw new Error(`Failed to fetch ${entry.source}: HTTP ${response.status}`);
  const clientEntity = await response.json();
  const description = clientEntity?.["minecraft:client_entity"]?.description;
  if (!description) throw new Error(`${entry.source}: missing minecraft:client_entity.description`);

  description.identifier = `phlodgate:companion_${entry.id}`;
  const texturePath = `textures/entity/phlodgate/companion_${entry.id}`;
  for (const key of Object.keys(description.textures ?? {})) description.textures[key] = texturePath;
  delete description.spawn_egg;
  if (entry.id === "baby_panda") {
    delete description.animation_controllers;
    description.scripts = { ...(description.scripts ?? {}), animate: ["baby_transform", "walk", "look_at_target"] };
  }

  const behaviorPath = path.join(root, "BP", "entities", `companion_${entry.id}.json`);
  mkdirSync(path.dirname(behaviorPath), { recursive: true });
  writeFileSync(behaviorPath, `${JSON.stringify(behaviorFor(entry), null, 2)}\n`);

  for (const packName of packs) {
    const clientPath = path.join(root, packName, "entity", `companion_${entry.id}.json`);
    mkdirSync(path.dirname(clientPath), { recursive: true });
    writeFileSync(clientPath, `${JSON.stringify(clientEntity, null, 2)}\n`);
  }
}

console.log(`Generated ${babies.length} baby companion behavior definitions and ${babies.length * packs.length} client definitions.`);
