/** Pure logic for the bound companion pet feature: species catalog, interaction decisions, and spawn placement. No @minecraft/server imports so this stays unit-testable. */
import { Vec3 } from "../../util/Vector";

export type CompanionSpeciesId =
  | "wolf"
  | "cat"
  | "fox"
  | "snow_fox"
  | "creaking"
  | "rabbit"
  | "spider"
  | "cave_spider"
  | "sniffer"
  | "ravager"
  | "copper_golem"
  | "zoglin"
  | "axolotl"
  | "baby_piglin"
  | "baby_armadillo"
  | "baby_axolotl"
  | "baby_bee"
  | "baby_camel"
  | "baby_cat"
  | "baby_cow"
  | "baby_donkey"
  | "baby_fox"
  | "baby_goat"
  | "baby_hoglin"
  | "baby_horse"
  | "baby_llama"
  | "baby_mooshroom"
  | "baby_mule"
  | "baby_ocelot"
  | "baby_polar_bear"
  | "baby_pig"
  | "baby_rabbit"
  | "baby_sheep"
  | "baby_chicken"
  | "baby_sniffer"
  | "baby_strider"
  | "baby_turtle"
  | "baby_panda"
  | "baby_wolf"
  | "tadpole";

export interface CompanionSpeciesDefinition {
  id: CompanionSpeciesId;
  entityTypeId: string;
  label: string;
  description: string;
  defaultName: string;
  category: "companion" | "baby_animal";
  /** Rideable species have no sit/stand toggle: a plain owner click mounts them instead (no saddle required),
   *  matching the entity's own `minecraft:rideable` component rather than `minecraft:sittable`. */
  rideable: boolean;
}

function babyAnimal(id: CompanionSpeciesId, label: string): CompanionSpeciesDefinition {
  return {
    id,
    entityTypeId: `phlodgate:companion_${id}`,
    label,
    description: `A tame, always-neutral ${label.toLowerCase()} companion that follows, sits on command, and never grows up.`,
    defaultName: `Companion ${label}`,
    category: "baby_animal",
    rideable: false,
  };
}

/** A reasonably sized, all-neutral companion selection. Each entity type is a custom Phlodgate entity that
 *  reuses the matching vanilla mob's client-side geometry/textures/animations by identifier reference (see
 *  RP/entity/*), not an override of the real vanilla mob, so it can be made fully neutral and invulnerable
 *  (and, for the rideable species, saddle-free) without altering any real vanilla mob's behavior. */
export const COMPANION_SPECIES: readonly CompanionSpeciesDefinition[] = [
  {
    id: "wolf",
    entityTypeId: "phlodgate:companion_wolf",
    label: "Wolf",
    description: "A loyal wolf companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Wolf",
    category: "companion",
    rideable: false,
  },
  {
    id: "cat",
    entityTypeId: "phlodgate:companion_cat",
    label: "Cat",
    description: "A calm cat companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Cat",
    category: "companion",
    rideable: false,
  },
  {
    id: "fox",
    entityTypeId: "phlodgate:companion_fox",
    label: "Fox",
    description: "A quiet fox companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Fox",
    category: "companion",
    rideable: false,
  },
  {
    id: "snow_fox",
    entityTypeId: "phlodgate:companion_snow_fox",
    label: "Snow Fox",
    description: "An arctic fox companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Snow Fox",
    category: "companion",
    rideable: false,
  },
  {
    id: "creaking",
    entityTypeId: "phlodgate:companion_creaking",
    label: "Creaking",
    description: "A silent, always-neutral creaking companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Creaking",
    category: "companion",
    rideable: false,
  },
  {
    id: "rabbit",
    entityTypeId: "phlodgate:companion_rabbit",
    label: "Rabbit",
    description: "A small rabbit companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Rabbit",
    category: "companion",
    rideable: false,
  },
  {
    id: "spider",
    entityTypeId: "phlodgate:companion_spider",
    label: "Spider (rideable)",
    description: "A tame, always-neutral spider companion you can ride any time \u2014 no saddle required.",
    defaultName: "Companion Spider",
    category: "companion",
    rideable: true,
  },
  {
    id: "cave_spider",
    entityTypeId: "phlodgate:companion_cave_spider",
    label: "Cave Spider",
    description: "A small, always-neutral cave spider companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Cave Spider",
    category: "companion",
    rideable: false,
  },
  {
    id: "sniffer",
    entityTypeId: "phlodgate:companion_sniffer",
    label: "Sniffer (rideable)",
    description: "A tame, always-neutral sniffer companion you can ride any time \u2014 no saddle required.",
    defaultName: "Companion Sniffer",
    category: "companion",
    rideable: true,
  },
  {
    id: "ravager",
    entityTypeId: "phlodgate:companion_ravager",
    label: "Ravager (rideable)",
    description: "A tame, always-neutral ravager companion you can ride any time \u2014 no saddle required.",
    defaultName: "Companion Ravager",
    category: "companion",
    rideable: true,
  },
  {
    id: "copper_golem",
    entityTypeId: "phlodgate:companion_copper_golem",
    label: "Copper Golem",
    description: "A tame, always-neutral copper golem companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Copper Golem",
    category: "companion",
    rideable: false,
  },
  {
    id: "zoglin",
    entityTypeId: "phlodgate:companion_zoglin",
    label: "Zoglin",
    description: "A tame, always-neutral zoglin companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Zoglin",
    category: "companion",
    rideable: false,
  },
  {
    id: "axolotl",
    entityTypeId: "phlodgate:companion_axolotl",
    label: "Axolotl",
    description: "A tame, always-neutral axolotl companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Axolotl",
    category: "companion",
    rideable: false,
  },
  {
    id: "baby_piglin",
    entityTypeId: "phlodgate:companion_baby_piglin",
    label: "Baby Piglin",
    description: "A tame, always-neutral baby piglin companion, immune to zombification, that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Baby Piglin",
    category: "companion",
    rideable: false,
  },
  ...[
    babyAnimal("baby_armadillo", "Baby Armadillo"),
    babyAnimal("baby_axolotl", "Baby Axolotl"),
    babyAnimal("baby_bee", "Baby Bee"),
    babyAnimal("baby_camel", "Baby Camel"),
    babyAnimal("baby_cat", "Baby Cat"),
    babyAnimal("baby_chicken", "Baby Chicken"),
    babyAnimal("baby_cow", "Baby Cow"),
    babyAnimal("baby_donkey", "Baby Donkey"),
    babyAnimal("baby_fox", "Baby Fox"),
    babyAnimal("baby_goat", "Baby Goat"),
    babyAnimal("baby_hoglin", "Baby Hoglin"),
    babyAnimal("baby_horse", "Baby Horse"),
    babyAnimal("baby_llama", "Baby Llama"),
    babyAnimal("baby_mooshroom", "Baby Mooshroom"),
    babyAnimal("baby_mule", "Baby Mule"),
    babyAnimal("baby_ocelot", "Baby Ocelot"),
    babyAnimal("baby_panda", "Baby Panda"),
    babyAnimal("baby_pig", "Baby Pig"),
    babyAnimal("baby_polar_bear", "Baby Polar Bear"),
    babyAnimal("baby_rabbit", "Baby Rabbit"),
    babyAnimal("baby_sheep", "Baby Sheep"),
    babyAnimal("baby_sniffer", "Baby Sniffer"),
    babyAnimal("baby_strider", "Baby Strider"),
    babyAnimal("baby_turtle", "Baby Turtle"),
    babyAnimal("baby_wolf", "Baby Wolf"),
    babyAnimal("tadpole", "Tadpole"),
  ],
];

export const DEFAULT_COMPANION_SPECIES_ID: CompanionSpeciesId = "wolf";

export function findCompanionSpecies(id: string): CompanionSpeciesDefinition | undefined {
  return COMPANION_SPECIES.find((species) => species.id === id);
}

export function companionSpeciesForEntityType(entityTypeId: string): CompanionSpeciesDefinition | undefined {
  return COMPANION_SPECIES.find((species) => species.entityTypeId === entityTypeId);
}

export function isCompanionEntityType(entityTypeId: string): boolean {
  return companionSpeciesForEntityType(entityTypeId) !== undefined;
}

/** Resolves a selection index from a companion-choice form into a species definition, defaulting safely on
 *  an invalid/out-of-range/cancelled selection so the player is never left without a companion. */
export function resolveChosenSpecies(selection: number | undefined): CompanionSpeciesDefinition {
  if (selection === undefined || !Number.isInteger(selection) || selection < 0 || selection >= COMPANION_SPECIES.length) {
    return findCompanionSpecies(DEFAULT_COMPANION_SPECIES_ID)!;
  }
  return COMPANION_SPECIES[selection];
}

export type CompanionInteractionAction = "deny_not_owner" | "open_control_room" | "allow_default_interaction";

/** Decides what a click on a bound companion should do: only the owner may interact with it at all; the
 *  owner's sneak-click opens the Control Room (and must suppress the default interaction so it doesn't also
 *  toggle sit/mount); the owner's plain click falls through to the entity's own native interaction — the
 *  tamed-pet sit/stand toggle for a `sittable` species, or mounting for a `rideable` one. */
export function decideCompanionInteraction(isOwner: boolean, isSneaking: boolean): CompanionInteractionAction {
  if (!isOwner) return "deny_not_owner";
  return isSneaking ? "open_control_room" : "allow_default_interaction";
}

/** Places the companion a couple of blocks behind the player's current facing (using yaw, matching Minecraft's
 *  yaw convention where 0 = south/+Z) so it doesn't spawn on top of them. */
export function computeCompanionSpawnLocation(playerLocation: Vec3, yawDegrees: number, backDistance = 1.5): Vec3 {
  const yawRad = (yawDegrees * Math.PI) / 180;
  // Forward vector for Minecraft yaw: (-sin(yaw), cos(yaw)) in the (x, z) plane. Spawn behind = subtract forward.
  const forwardX = -Math.sin(yawRad);
  const forwardZ = Math.cos(yawRad);
  return {
    x: playerLocation.x - forwardX * backDistance,
    y: playerLocation.y,
    z: playerLocation.z - forwardZ * backDistance,
  };
}
