/** Runtime wiring for the bound companion pet: first-spawn species choice, ownership/interaction routing to the
 *  Hydraulic Control Room, and layered invulnerability. Pure decision logic lives in CompanionPetPlan.ts so it
 *  stays unit-testable; this module only wires that logic to @minecraft/server side effects. */
import {
  Entity,
  EntityHurtBeforeEvent,
  EntityTameableComponent,
  InputPermissionCategory,
  Player,
  PlayerInteractWithEntityBeforeEvent,
  system,
  world,
} from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { openHydraulicControlRoom } from "../../ui/HydraulicControlRoom";
import { readSelection } from "../../ui/FormValidation";
import { log } from "../../util/Logger";
import {
  COMPANION_SPECIES,
  CompanionSpeciesDefinition,
  computeCompanionSpawnLocation,
  decideCompanionInteraction,
  DEFAULT_COMPANION_SPECIES_ID,
  findCompanionSpecies,
} from "./CompanionPetPlan";

const COMPANION_TAG = "phlodgate:companion";
const OWNER_ID_PROPERTY = "phlodgate:ownerId";
const SPECIES_ID_PROPERTY = "phlodgate:speciesId";
const COMPANION_SPECIES_PLAYER_PROPERTY = "phlodgate:companionSpecies";
const COMPANION_ENTITY_PLAYER_PROPERTY = "phlodgate:companionEntityId";
const RESPAWN_DELAY_TICKS = 40; // 2 seconds
const FORCED_CHOICE_RETRY_TICKS = 30; // 1.5 seconds between re-prompts if the player closes/cancels the form
const onboardingPlayers = new Set<string>();

function isCompanionEntity(entity: Entity | undefined): entity is Entity {
  return !!entity && entity.isValid && entity.hasTag(COMPANION_TAG);
}

function spawnCompanion(player: Player, species: CompanionSpeciesDefinition): Entity | undefined {
  let entity: Entity | undefined;
  try {
    const rotation = player.getRotation();
    const location = computeCompanionSpawnLocation(player.location, rotation.y);
    entity = player.dimension.spawnEntity(species.entityTypeId, location);
    entity.nameTag = species.defaultName;
    entity.addTag(COMPANION_TAG);
    entity.setDynamicProperty(OWNER_ID_PROPERTY, player.id);
    entity.setDynamicProperty(SPECIES_ID_PROPERTY, species.id);

    const tameable = entity.getComponent("minecraft:tameable") as EntityTameableComponent | undefined;
    if (!tameable?.tame(player)) throw new Error("entity could not be assigned to its owner");
    player.setDynamicProperty(COMPANION_ENTITY_PLAYER_PROPERTY, entity.id);

    log(`Spawned companion ${species.entityTypeId} for ${player.name}.`);
    return entity;
  } catch (err) {
    try {
      if (entity?.isValid) entity.remove();
    } catch {
      // The failed entity may already have been invalidated.
    }
    log(`Failed to spawn companion ${species.entityTypeId} for ${player.name}: ${String(err)}`);
    return undefined;
  }
}

function buildCompanionCategoryForm(): ActionFormData {
  return new ActionFormData()
    .title("Choose Your Companion")
    .body("You must pick a bound companion before you can play.")
    .button("Companions\n§7Adults, special creatures, and mounts")
    .button("Baby Animals\n§7Passive animal babies");
}

function buildCompanionChoiceForm(speciesOptions: readonly CompanionSpeciesDefinition[]): ActionFormData {
  const form = new ActionFormData()
    .title("Choose Your Companion")
    .body(
      "You must pick a bound companion before you can play. It is invulnerable, always neutral, and follows you. Shift+click it any time to open the Hydraulic Control Room."
    );
  for (const species of speciesOptions) form.button(`${species.label}\n§7${species.description}`);
  return form;
}

function setOnboardingMovement(player: Player, enabled: boolean): void {
  try {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, enabled);
  } catch (err) {
    log(`Failed to ${enabled ? "restore" : "lock"} movement during companion onboarding for ${player.name}: ${String(err)}`);
  }
}

/** Bedrock forms can only open after the player joins, so movement is locked and the choice is re-presented
 *  until a valid selection successfully spawns. The completion property is never written before spawn. */
function scheduleForcedCompanionChoice(player: Player): void {
  if (!player.isValid) return;
  if (onboardingPlayers.has(player.id)) return;
  onboardingPlayers.add(player.id);
  setOnboardingMovement(player, false);

  const prompt = (): void => {
    if (!player.isValid) {
      onboardingPlayers.delete(player.id);
      return;
    }
    void (async () => {
      let categoryResponse;
      try {
        categoryResponse = await buildCompanionCategoryForm().show(player);
      } catch (err) {
        log(`Companion choice form failed for ${player.name}: ${String(err)}`);
        categoryResponse = undefined;
      }
      if (!player.isValid) return;

      const categorySelection = categoryResponse ? readSelection(categoryResponse) : undefined;
      if (categorySelection === undefined || categorySelection > 1) {
        system.runTimeout(prompt, FORCED_CHOICE_RETRY_TICKS);
        return;
      }

      const category = categorySelection === 0 ? "companion" : "baby_animal";
      const speciesOptions = COMPANION_SPECIES.filter((species) => species.category === category);
      let choiceResponse;
      try {
        choiceResponse = await buildCompanionChoiceForm(speciesOptions).show(player);
      } catch (err) {
        log(`Companion species form failed for ${player.name}: ${String(err)}`);
        choiceResponse = undefined;
      }
      if (!player.isValid) return;

      const selection = choiceResponse ? readSelection(choiceResponse) : undefined;
      if (selection === undefined) {
        system.runTimeout(prompt, FORCED_CHOICE_RETRY_TICKS);
        return;
      }

      const species = speciesOptions[selection] ?? findCompanionSpecies(DEFAULT_COMPANION_SPECIES_ID)!;
      if (!spawnCompanion(player, species)) {
        system.runTimeout(prompt, FORCED_CHOICE_RETRY_TICKS);
        return;
      }

      player.setDynamicProperty(COMPANION_SPECIES_PLAYER_PROPERTY, species.id);
      onboardingPlayers.delete(player.id);
      setOnboardingMovement(player, true);
    })();
  };

  system.runTimeout(prompt, 20);
}

function handlePlayerSpawn(player: Player): void {
  try {
    const selectedSpeciesId = player.getDynamicProperty(COMPANION_SPECIES_PLAYER_PROPERTY);
    const selectedSpecies = typeof selectedSpeciesId === "string" ? findCompanionSpecies(selectedSpeciesId) : undefined;
    if (selectedSpecies) {
      setOnboardingMovement(player, true);
      const entityId = player.getDynamicProperty(COMPANION_ENTITY_PLAYER_PROPERTY);
      const existing = typeof entityId === "string" ? world.getEntity(entityId) : undefined;
      if (!isCompanionEntity(existing)) system.runTimeout(() => spawnCompanion(player, selectedSpecies), 20);
      return;
    }
    scheduleForcedCompanionChoice(player);
  } catch (err) {
    log(`Failed to evaluate companion grant for ${player.name}: ${String(err)}`);
  }
}

function handleInteract(event: PlayerInteractWithEntityBeforeEvent): void {
  if (!isCompanionEntity(event.target)) return;

  let ownerId: unknown;
  try {
    ownerId = event.target.getDynamicProperty(OWNER_ID_PROPERTY);
  } catch (err) {
    log(`Failed to read companion owner id: ${String(err)}`);
    event.cancel = true;
    return;
  }

  const isOwner = typeof ownerId === "string" && ownerId === event.player.id;
  const action = decideCompanionInteraction(isOwner, event.player.isSneaking);

  if (action === "deny_not_owner") {
    event.cancel = true;
    return;
  }
  if (action === "open_control_room") {
    event.cancel = true;
    const player = event.player;
    system.run(() => {
      void openHydraulicControlRoom(player).catch((err) => log(`Companion-triggered Control Room failed to open: ${String(err)}`));
    });
    return;
  }
  // "allow_default_interaction": leave the event uncancelled so the entity's own native interaction runs \u2014
  // the tameable/sittable toggle for a walking companion, or mounting (no saddle required) for a rideable one.
}

function handleEntityHurt(event: EntityHurtBeforeEvent): void {
  if (isCompanionEntity(event.hurtEntity)) event.cancel = true;
}

function handleEntityDie(deadEntity: Entity): void {
  let ownerId: unknown;
  let speciesId: unknown;
  let name: string | undefined;
  try {
    if (!deadEntity.hasTag(COMPANION_TAG)) return;
    ownerId = deadEntity.getDynamicProperty(OWNER_ID_PROPERTY);
    speciesId = deadEntity.getDynamicProperty(SPECIES_ID_PROPERTY);
    name = deadEntity.nameTag;
  } catch {
    // The entity reference is no longer valid post-death; nothing more we can safely read.
    return;
  }
  if (typeof ownerId !== "string" || typeof speciesId !== "string") return;

  const species = COMPANION_SPECIES.find((s) => s.id === speciesId);
  if (!species) return;

  // Damage is already fully blocked (damage_sensor + fire immunity + this module's entityHurt cancellation),
  // so this only fires if something removed the companion outside of normal damage (e.g. an operator command).
  // Respawning keeps the "immortal, always-bound" companion promise intact.
  system.runTimeout(() => {
    const owner = [...world.getAllPlayers()].find((p) => p.id === ownerId);
    if (!owner) return;
    const respawned = spawnCompanion(owner, species);
    if (respawned && name) respawned.nameTag = name;
  }, RESPAWN_DELAY_TICKS);
}

export function registerCompanionPetSystem(): void {
  world.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) return;
    handlePlayerSpawn(event.player);
  });

  world.beforeEvents.playerInteractWithEntity.subscribe(handleInteract);
  world.beforeEvents.entityHurt.subscribe(handleEntityHurt);
  world.afterEvents.entityDie.subscribe((event) => handleEntityDie(event.deadEntity));
  world.afterEvents.playerLeave.subscribe((event) => onboardingPlayers.delete(event.playerId));
}
