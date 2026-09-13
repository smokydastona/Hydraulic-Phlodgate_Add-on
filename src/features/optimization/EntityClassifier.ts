/**
 * Classify -> Protect -> Score step of the optimization engine's Classify -> Protect -> Score -> Policy -> Act -> Audit pipeline.
 * Pure, deterministic, unit-testable. OptimizationEngine.ts (runtime) is responsible for gathering EntitySignal data
 * from the real world and for the Policy/Act/Audit steps.
 */
import { extractNamespace, isModdedNamespace } from "../companion/CompanionDetector";

export interface EntitySignal {
  entityId: string;
  typeId: string;
  isPlayer: boolean;
  nameTag?: string;
  isTamed: boolean;
  isVillagerOrTrader: boolean;
  isBoss: boolean;
  isArmorStand: boolean;
  isItemEntity: boolean;
  itemTypeId?: string;
  isModdedEntity?: boolean;
  ageTicks: number;
  distanceToNearestPlayer: number;
  ticksSinceLastCombatInvolvement?: number; // undefined = never involved in combat
  explicitlyProtectedByConfig: boolean;
}

export interface ProtectionRules {
  protectNamedEntities: boolean;
  protectTamedPets: boolean;
  protectBosses: boolean;
  protectArmorStands: boolean;
  protectVillagersAndTraders: boolean;
  protectEntitiesInCombat: boolean;
  protectModdedEntities: boolean;
  combatGraceTicks: number;
  nearPlayerSafeRadius: number;
  recentItemGraceTicks: number;
  valuableItemTypeIds: readonly string[];
}

export const DEFAULT_PROTECTION_RULES: ProtectionRules = {
  protectNamedEntities: true,
  protectTamedPets: true,
  protectBosses: true,
  protectArmorStands: true,
  protectVillagersAndTraders: true,
  protectEntitiesInCombat: true,
  protectModdedEntities: true,
  combatGraceTicks: 20 * 15, // 15s after last hit
  nearPlayerSafeRadius: 12,
  recentItemGraceTicks: 20 * 5, // items always safe for their first 5s
  valuableItemTypeIds: [
    "minecraft:diamond",
    "minecraft:netherite_ingot",
    "minecraft:netherite_scrap",
    "minecraft:emerald",
    "minecraft:nether_star",
    "minecraft:totem_of_undying",
    "minecraft:enchanted_golden_apple",
    "minecraft:dragon_egg",
  ],
};

export interface ClassificationResult {
  protectedFromRemoval: boolean;
  reasons: string[];
  eligibleForRemoval: boolean;
  /** Higher = more "safe to remove" priority if the policy needs to cap how many are removed per scan. */
  removalPriority: number;
}

export function classifyEntity(signal: EntitySignal, rules: ProtectionRules): ClassificationResult {
  const reasons: string[] = [];

  if (signal.isPlayer) reasons.push("players are always protected");
  if (signal.explicitlyProtectedByConfig) reasons.push("explicitly protected by world configuration");
  if (rules.protectTamedPets && signal.isTamed) reasons.push("tamed entity");
  if (rules.protectNamedEntities && signal.nameTag && signal.nameTag.trim().length > 0) reasons.push("named entity");
  if (rules.protectBosses && signal.isBoss) reasons.push("boss entity");
  if (rules.protectArmorStands && signal.isArmorStand) reasons.push("player-placed armor stand");
  if (rules.protectVillagersAndTraders && signal.isVillagerOrTrader) reasons.push("villager/trader");
  if (
    rules.protectModdedEntities &&
    (signal.isModdedEntity ||
      isModdedNamespace(extractNamespace(signal.typeId)) ||
      (signal.isItemEntity && signal.itemTypeId && isModdedNamespace(extractNamespace(signal.itemTypeId))))
  ) {
    reasons.push("modded entity / machine proxy / modded item");
  }
  if (
    rules.protectEntitiesInCombat &&
    signal.ticksSinceLastCombatInvolvement !== undefined &&
    signal.ticksSinceLastCombatInvolvement <= rules.combatGraceTicks
  ) {
    reasons.push("recently involved in combat");
  }
  if (signal.distanceToNearestPlayer <= rules.nearPlayerSafeRadius) reasons.push("within a player's immediate safe radius");
  if (signal.isItemEntity && signal.ageTicks <= rules.recentItemGraceTicks) reasons.push("recently dropped item grace period");
  if (signal.isItemEntity && signal.itemTypeId && rules.valuableItemTypeIds.includes(signal.itemTypeId)) {
    reasons.push("valuable/rare item contents");
  }

  const protectedFromRemoval = reasons.length > 0;

  // Removal priority: older + farther = safer/more useful to remove first.
  const removalPriority = protectedFromRemoval ? -1 : signal.ageTicks * 0.01 + signal.distanceToNearestPlayer;

  return {
    protectedFromRemoval,
    reasons,
    eligibleForRemoval: !protectedFromRemoval,
    removalPriority,
  };
}

/** Sorts eligible candidates by removal priority (highest first) and applies the aggressiveness fraction from the active profile. */
export function selectForRemoval(
  candidates: Array<{ signal: EntitySignal; classification: ClassificationResult }>,
  removalAggressiveness: number
): string[] {
  const eligible = candidates
    .filter((c) => c.classification.eligibleForRemoval)
    .sort((a, b) => b.classification.removalPriority - a.classification.removalPriority);

  const count = Math.ceil(eligible.length * Math.max(0, Math.min(1, removalAggressiveness)));
  return eligible.slice(0, count).map((c) => c.signal.entityId);
}
