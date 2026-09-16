/** Pure logic for the bound companion pet feature: species catalog, interaction decisions, and spawn placement. No @minecraft/server imports so this stays unit-testable. */
import { Vec3 } from "../../util/Vector";

export type CompanionSpeciesId = "wolf" | "cat" | "fox";

export interface CompanionSpeciesDefinition {
  id: CompanionSpeciesId;
  entityTypeId: string;
  label: string;
  description: string;
  defaultName: string;
}

/** A reasonably sized, all-neutral, land-companion selection. Each entity type is a custom Phlodgate entity
 *  that reuses the matching vanilla mob's client-side geometry/textures/animations by identifier reference
 *  (see RP/entity/*), not a vanilla wolf/cat/fox itself, so it can be made fully neutral and invulnerable
 *  without altering any real vanilla mob's behavior. */
export const COMPANION_SPECIES: readonly CompanionSpeciesDefinition[] = [
  {
    id: "wolf",
    entityTypeId: "phlodgate:companion_wolf",
    label: "Wolf",
    description: "A loyal wolf companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Wolf",
  },
  {
    id: "cat",
    entityTypeId: "phlodgate:companion_cat",
    label: "Cat",
    description: "A calm cat companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Cat",
  },
  {
    id: "fox",
    entityTypeId: "phlodgate:companion_fox",
    label: "Fox",
    description: "A quiet fox companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Fox",
  },
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

export type CompanionInteractionAction = "deny_not_owner" | "open_control_room" | "allow_default_sit_toggle";

/** Decides what a click on a bound companion should do: only the owner may interact with it at all; the
 *  owner's sneak-click opens the Control Room (and must suppress the default interaction so it doesn't also
 *  toggle sit); the owner's plain click falls through to the entity's native tamed-pet sit/stand toggle. */
export function decideCompanionInteraction(isOwner: boolean, isSneaking: boolean): CompanionInteractionAction {
  if (!isOwner) return "deny_not_owner";
  return isSneaking ? "open_control_room" : "allow_default_sit_toggle";
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
