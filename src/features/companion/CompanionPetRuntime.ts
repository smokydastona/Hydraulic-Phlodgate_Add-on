/** Runtime wiring for the bound companion pet: first-spawn species choice, ownership/interaction routing to the
 *  Hydraulic Control Room, and layered invulnerability. Pure decision logic lives in CompanionPetPlan.ts so it
 *  stays unit-testable; this module only wires that logic to @minecraft/server side effects. */
import { Entity, EntityHurtBeforeEvent, EntityTameableComponent, Player, PlayerInteractWithEntityBeforeEvent, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { openHydraulicControlRoom } from "../../ui/HydraulicControlRoom";
import { showFormWithRetry } from "../../ui/FormRuntime";
import { readSelection } from "../../ui/FormValidation";
import { log } from "../../util/Logger";
import { COMPANION_SPECIES, CompanionSpeciesDefinition, computeCompanionSpawnLocation, decideCompanionInteraction, resolveChosenSpecies } from "./CompanionPetPlan";

const COMPANION_TAG = "phlodgate:companion";
const OWNER_ID_PROPERTY = "phlodgate:ownerId";
const SPECIES_ID_PROPERTY = "phlodgate:speciesId";
const COMPANION_GIVEN_PLAYER_PROPERTY = "phlodgate:companionGiven";
const RESPAWN_DELAY_TICKS = 40; // 2 seconds

function isCompanionEntity(entity: Entity | undefined): entity is Entity {
  return !!entity && entity.isValid && entity.hasTag(COMPANION_TAG);
}

function spawnCompanion(player: Player, species: CompanionSpeciesDefinition): Entity | undefined {
  try {
    const rotation = player.getRotation();
    const location = computeCompanionSpawnLocation(player.location, rotation.y);
    const entity = player.dimension.spawnEntity(species.entityTypeId, location);
    entity.nameTag = species.defaultName;
    entity.addTag(COMPANION_TAG);
    entity.setDynamicProperty(OWNER_ID_PROPERTY, player.id);
    entity.setDynamicProperty(SPECIES_ID_PROPERTY, species.id);

    const tameable = entity.getComponent("minecraft:tameable") as EntityTameableComponent | undefined;
    tameable?.tame(player);

    log(`Spawned companion ${species.entityTypeId} for ${player.name}.`);
    return entity;
  } catch (err) {
    log(`Failed to spawn companion ${species.entityTypeId} for ${player.name}: ${String(err)}`);
    return undefined;
  }
}

async function offerCompanionChoice(player: Player): Promise<void> {
  const form = new ActionFormData()
    .title("Choose Your Companion")
    .body("Pick a bound companion. It is invulnerable, always neutral, and follows you. Shift+click it any time to open the Hydraulic Control Room.");
  for (const species of COMPANION_SPECIES) form.button(`${species.label}\n§7${species.description}`);

  const response = await showFormWithRetry(player, () => form, { context: "Companion Choice" });
  const selection = response ? readSelection(response) : undefined;
  const species = resolveChosenSpecies(selection);
  spawnCompanion(player, species);
}

function handlePlayerSpawn(player: Player): void {
  try {
    if (player.getDynamicProperty(COMPANION_GIVEN_PLAYER_PROPERTY) === true) return;
    // Set the flag immediately (before the async form resolves) so a rapid re-join can't trigger a second grant.
    player.setDynamicProperty(COMPANION_GIVEN_PLAYER_PROPERTY, true);
    system.run(() => {
      void offerCompanionChoice(player).catch((err) => log(`Companion choice form failed for ${player.name}: ${String(err)}`));
    });
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
}
