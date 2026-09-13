/** Balanced/Aggressive/Extreme profile resolution. Pure data + functions so it is unit-testable without the game runtime. */

export type OptimizationMode = "balanced" | "aggressive" | "extreme";

export interface OptimizationThresholds {
  /** Blocks beyond which a non-protected mob is eligible for despawn. */
  mobDespawnRadius: number;
  /** Ticks a mob/item must be outside player attention before it is eligible for despawn. */
  offScreenGraceTicks: number;
  /** Blocks beyond which a dropped item is eligible for cleanup. */
  itemDespawnRadius: number;
  /** Ticks a dropped item may exist before being eligible for stale cleanup. */
  itemMaxAgeTicks: number;
  /** Radius in blocks within which identical item stacks are merged. */
  itemMergeRadius: number;
  /** Maximum stack size produced by merging. */
  itemMergeCap: number;
  /** Fraction (0-1) of eligible candidates actually removed per scan, after all protections. Lower = more conservative. */
  removalAggressiveness: number;
}

export interface FogThresholds {
  /** 0 = vanilla-like fog, 1 = maximum reduction. */
  densityReduction: number;
  volumetricFogEnabled: boolean;
  fogIdentifier: "phlodgate:balanced_fog" | "phlodgate:aggressive_fog" | "phlodgate:extreme_fog";
}

const OPTIMIZATION_PROFILES: Record<OptimizationMode, OptimizationThresholds> = {
  balanced: {
    mobDespawnRadius: 96,
    offScreenGraceTicks: 20 * 60, // 60s
    itemDespawnRadius: 80,
    itemMaxAgeTicks: 20 * 60 * 5, // 5 minutes
    itemMergeRadius: 2,
    itemMergeCap: 64,
    removalAggressiveness: 0.25,
  },
  aggressive: {
    mobDespawnRadius: 64,
    offScreenGraceTicks: 20 * 30, // 30s
    itemDespawnRadius: 48,
    itemMaxAgeTicks: 20 * 60 * 2, // 2 minutes
    itemMergeRadius: 3,
    itemMergeCap: 64,
    removalAggressiveness: 0.6,
  },
  extreme: {
    mobDespawnRadius: 40,
    offScreenGraceTicks: 20 * 15, // 15s
    itemDespawnRadius: 32,
    itemMaxAgeTicks: 20 * 45, // 45s
    itemMergeRadius: 4,
    itemMergeCap: 64,
    removalAggressiveness: 1,
  },
};

const FOG_PROFILES: Record<OptimizationMode, FogThresholds> = {
  balanced: { densityReduction: 0, volumetricFogEnabled: true, fogIdentifier: "phlodgate:balanced_fog" },
  aggressive: { densityReduction: 0.5, volumetricFogEnabled: false, fogIdentifier: "phlodgate:aggressive_fog" },
  extreme: { densityReduction: 0.85, volumetricFogEnabled: false, fogIdentifier: "phlodgate:extreme_fog" },
};

export function resolveOptimizationThresholds(mode: OptimizationMode): OptimizationThresholds {
  return OPTIMIZATION_PROFILES[mode];
}

export function resolveFogThresholds(mode: OptimizationMode): FogThresholds {
  return FOG_PROFILES[mode];
}

export function isValidMode(value: string): value is OptimizationMode {
  return value === "balanced" || value === "aggressive" || value === "extreme";
}
