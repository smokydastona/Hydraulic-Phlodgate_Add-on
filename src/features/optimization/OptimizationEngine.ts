import { Entity, system, world } from "@minecraft/server";
import { getWorldSettings } from "../../settings/SettingsStore";
import { resolveOptimizationThresholds } from "../../settings/Profiles";
import { safeInterval } from "../../util/Scheduler";
import { log } from "../../util/Logger";
import { extractNamespace, isModdedNamespace } from "../companion/CompanionDetector";
import {
  classifyEntity,
  DEFAULT_PROTECTION_RULES,
  EntitySignal,
  ProtectionRules,
  selectForRemoval,
} from "./EntityClassifier";

const SCAN_INTERVAL_TICKS = 100; // 5 seconds; keeps scanning cheap and throttled
const spawnTickByEntityId = new Map<string, number>();
const lastCombatTickByEntityId = new Map<string, number>();

export interface AuditEntry {
  tick: number;
  entityId: string;
  typeId: string;
  action: "removed" | "would-remove";
  reasonsAvoided: string[];
}

const auditLog: AuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 200;

export function getAuditLog(): readonly AuditEntry[] {
  return auditLog;
}

function pushAudit(entry: AuditEntry): void {
  auditLog.push(entry);
  if (auditLog.length > MAX_AUDIT_ENTRIES) auditLog.shift();
}

/** Call once at startup, before the optimization interval runs, so combat/spawn tracking is active. */
export function registerOptimizationEventTracking(): void {
  world.afterEvents.entitySpawn.subscribe((event) => {
    spawnTickByEntityId.set(event.entity.id, system.currentTick);
  });
  world.afterEvents.entityHurt.subscribe((event) => {
    if (event.hurtEntity) lastCombatTickByEntityId.set(event.hurtEntity.id, system.currentTick);
  });
  world.afterEvents.entityRemove.subscribe((event) => {
    spawnTickByEntityId.delete(event.removedEntityId);
    lastCombatTickByEntityId.delete(event.removedEntityId);
  });
}

function isTamed(entity: Entity): boolean {
  try {
    return entity.getComponent("minecraft:is_tamed") !== undefined;
  } catch {
    return false;
  }
}

function isVillagerOrTrader(typeId: string): boolean {
  return typeId.includes("villager") || typeId === "minecraft:wandering_trader";
}

function isBoss(typeId: string): boolean {
  return typeId === "minecraft:ender_dragon" || typeId === "minecraft:wither";
}

function nearestPlayerDistance(entity: Entity, players: Entity[]): number {
  let min = Infinity;
  const loc = entity.location;
  for (const player of players) {
    if (player.dimension.id !== entity.dimension.id) continue;
    const p = player.location;
    const d = Math.sqrt((p.x - loc.x) ** 2 + (p.y - loc.y) ** 2 + (p.z - loc.z) ** 2);
    if (d < min) min = d;
  }
  return min;
}

function toSignal(entity: Entity, players: Entity[], protectedTypeIds: readonly string[]): EntitySignal {
  const spawnTick = spawnTickByEntityId.get(entity.id);
  const ageTicks = spawnTick !== undefined ? Math.max(0, system.currentTick - spawnTick) : 0;
  const lastCombat = lastCombatTickByEntityId.get(entity.id);

  const isItemEntity = entity.typeId === "minecraft:item";
  let itemTypeId: string | undefined;
  if (isItemEntity) {
    const itemComponent = entity.getComponent("minecraft:item");
    itemTypeId = itemComponent?.itemStack?.typeId;
  }

  return {
    entityId: entity.id,
    typeId: entity.typeId,
    isPlayer: false,
    nameTag: entity.nameTag,
    isTamed: isTamed(entity),
    isVillagerOrTrader: isVillagerOrTrader(entity.typeId),
    isBoss: isBoss(entity.typeId),
    isArmorStand: entity.typeId === "minecraft:armor_stand",
    isItemEntity,
    itemTypeId,
    isModdedEntity: isModdedNamespace(extractNamespace(entity.typeId)),
    ageTicks,
    distanceToNearestPlayer: nearestPlayerDistance(entity, players),
    ticksSinceLastCombatInvolvement: lastCombat !== undefined ? system.currentTick - lastCombat : undefined,
    explicitlyProtectedByConfig: protectedTypeIds.includes(entity.typeId),
  };
}

function rulesFromSettings(): ProtectionRules {
  const settings = getWorldSettings();
  return {
    ...DEFAULT_PROTECTION_RULES,
    protectNamedEntities: settings.protectNamedEntities,
    protectTamedPets: settings.protectTamedPets,
    protectBosses: settings.protectBosses,
    protectArmorStands: settings.protectArmorStands,
    protectVillagersAndTraders: settings.protectVillagersAndTraders,
    protectEntitiesInCombat: settings.protectEntitiesInCombat,
    protectModdedEntities: settings.protectModdedEntities,
  };
}

/** Additional distance/age gating on top of protection classification - a mob/item is only a *candidate* if it is actually stale/far per the active mode's thresholds. */
function passesDespawnGate(
  signal: EntitySignal,
  settings: ReturnType<typeof getWorldSettings>,
  thresholds: ReturnType<typeof resolveOptimizationThresholds>
): boolean {
  if (signal.isItemEntity) {
    const farEnough = settings.distantDespawnEnabled && signal.distanceToNearestPlayer > thresholds.itemDespawnRadius;
    const staleEnough = signal.ageTicks > thresholds.itemMaxAgeTicks;
    return farEnough || staleEnough;
  }
  const farEnough = settings.distantDespawnEnabled && signal.distanceToNearestPlayer > thresholds.mobDespawnRadius;
  const offScreenStale = settings.offScreenDespawnEnabled && signal.ageTicks > thresholds.offScreenGraceTicks && signal.distanceToNearestPlayer > thresholds.mobDespawnRadius / 2;
  return farEnough || offScreenStale;
}

function runScan(): void {
  const settings = getWorldSettings();
  if (!settings.despawnOptimizationEnabled) return;

  const thresholds = resolveOptimizationThresholds(settings.optimizationMode);
  const rules = rulesFromSettings();
  const players = [...world.getAllPlayers()];

  for (const dimensionId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    let entities: Entity[];
    try {
      entities = [...world.getDimension(dimensionId).getEntities()];
    } catch {
      continue;
    }

    const candidates: Array<{ entity: Entity; signal: EntitySignal }> = [];
    for (const entity of entities) {
      if (entity.typeId === "minecraft:player") continue;
      const isItem = entity.typeId === "minecraft:item";
      if (!isItem && !isMobFamily(entity)) continue; // skip non-mob, non-item entities we have no policy for (minecarts, boats, projectiles, etc.)

      const signal = toSignal(entity, players, settings.protectedEntityTypeIds);
      if (!passesDespawnGate(signal, settings, thresholds)) continue;

      candidates.push({ entity, signal });
    }

    const classified = candidates.map((c) => ({
      entity: c.entity,
      signal: c.signal,
      classification: classifyEntity(c.signal, rules),
    }));

    const selectedIds = new Set(
      selectForRemoval(
        classified.map((c) => ({ signal: c.signal, classification: c.classification })),
        thresholds.removalAggressiveness
      )
    );

    for (const c of classified) {
      if (!selectedIds.has(c.signal.entityId)) continue;
      if (settings.auditModeOnly) {
        pushAudit({ tick: system.currentTick, entityId: c.signal.entityId, typeId: c.signal.typeId, action: "would-remove", reasonsAvoided: [] });
        continue;
      }
      try {
        c.entity.remove();
        pushAudit({ tick: system.currentTick, entityId: c.signal.entityId, typeId: c.signal.typeId, action: "removed", reasonsAvoided: [] });
      } catch (err) {
        log(`Failed to remove entity ${c.signal.entityId} (${c.signal.typeId}): ${String(err)}`);
      }
    }
  }
}

/** Conservative allow-list-by-exclusion: treat anything that isn't clearly a vehicle/projectile/xp-orb as a "mob" for despawn purposes. */
function isMobFamily(entity: Entity): boolean {
  const excluded = ["minecraft:boat", "minecraft:chest_boat", "minecraft:xp_orb", "minecraft:arrow", "minecraft:trident", "minecraft:fireball", "minecraft:egg", "minecraft:snowball", "minecraft:ender_pearl", "minecraft:fishing_hook", "minecraft:area_effect_cloud"];
  if (excluded.includes(entity.typeId)) return false;
  if (entity.typeId.includes("minecart")) return false;
  return true;
}

export function startOptimizationEngine(): number {
  return safeInterval("optimization-engine", runScan, SCAN_INTERVAL_TICKS);
}
