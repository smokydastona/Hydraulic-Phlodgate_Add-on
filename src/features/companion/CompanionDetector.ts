/**
 * Hydraulic-Phlodgate Companion Detector & Environment Model.
 *
 * Pure, deterministic, unit-testable module. Contains companion mode definitions,
 * namespace extraction, evidence evaluation, and cached status tracking.
 */

export type CompanionMode = "auto" | "enabled" | "disabled";

/** Canonical scoreboard objective installed by Hydraulic's CompanionSignalBridge. */
export const COMPANION_SIGNAL_OBJECTIVE = "phlodgate_bridge";

export interface CompanionDetectionEvidence {
  hasWorldDynamicProperty: boolean;
  dynamicPropertyKey?: string;
  dynamicPropertyValue?: string;
  worldTags: string[];
  moddedNamespacesInInventory: string[];
  moddedNamespacesInWorld: string[];
  scoreboards: string[];
}

export interface CompanionStatus {
  /** Whether companion mode is currently active (governed by mode + detection). */
  active: boolean;
  /** The configured mode: auto, enabled (forced), or disabled (forced). */
  mode: CompanionMode;
  /** Whether an authentic Hydraulic-Phlodgate / modded environment was detected. */
  detected: boolean;
  /** Explanatory findings / evidence list. */
  evidence: string[];
  /** Non-vanilla mod namespaces detected in the current session. */
  detectedNamespaces: string[];
  /** The tick number when this status was last updated. */
  lastCheckedTick: number;
}

const BUILTIN_NAMESPACES = new Set(["minecraft", "phlodgate"]);

/** Extracts unique namespace prefixes from an array of type identifiers (e.g. "hydraulic:machine" -> "hydraulic"). */
export function extractNamespace(typeId: string): string {
  const colonIndex = typeId.indexOf(":");
  if (colonIndex <= 0) return "minecraft";
  return typeId.slice(0, colonIndex).toLowerCase();
}

/** Checks whether a namespace represents an external mod (not vanilla and not this add-on's internal namespace). */
export function isModdedNamespace(namespace: string): boolean {
  return !BUILTIN_NAMESPACES.has(namespace.toLowerCase().trim());
}

/** Filters a list of type IDs to unique modded namespaces. */
export function extractModdedNamespaces(typeIds: readonly string[]): string[] {
  const namespaces = new Set<string>();
  for (const id of typeIds) {
    const ns = extractNamespace(id);
    if (isModdedNamespace(ns)) {
      namespaces.add(ns);
    }
  }
  return [...namespaces].sort();
}

/** Returns the canonical objective when it is present in the observed objective IDs. */
export function findCompanionSignalObjective(objectiveIds: readonly string[]): string | undefined {
  return objectiveIds.find((objectiveId) => objectiveId.toLowerCase() === COMPANION_SIGNAL_OBJECTIVE);
}

/**
 * Pure evaluation of companion environment status based on configured mode and discovered evidence.
 */
export function evaluateCompanionStatus(
  mode: CompanionMode,
  evidence: Partial<CompanionDetectionEvidence> = {},
  tick = 0
): CompanionStatus {
  const reasons: string[] = [];
  const detectedNamespacesSet = new Set<string>();

  // 1. Dynamic property evidence
  if (evidence.hasWorldDynamicProperty) {
    const key = evidence.dynamicPropertyKey ?? "phlodgate:bridge";
    const val = evidence.dynamicPropertyValue ? ` (${evidence.dynamicPropertyValue})` : "";
    reasons.push(`World dynamic property '${key}' detected${val}`);
  }

  // 2. World tags evidence
  if (evidence.worldTags && evidence.worldTags.length > 0) {
    for (const tag of evidence.worldTags) {
      if (tag.toLowerCase().includes("hydraulic") || tag.toLowerCase().includes("phlodgate")) {
        reasons.push(`World tag '${tag}' detected`);
      }
    }
  }

  // 3. Inventory modded namespaces
  if (evidence.moddedNamespacesInInventory && evidence.moddedNamespacesInInventory.length > 0) {
    for (const ns of evidence.moddedNamespacesInInventory) {
      detectedNamespacesSet.add(ns);
    }
    reasons.push(`Modded item namespaces found in inventory: ${evidence.moddedNamespacesInInventory.join(", ")}`);
  }

  // 4. World entities modded namespaces
  if (evidence.moddedNamespacesInWorld && evidence.moddedNamespacesInWorld.length > 0) {
    for (const ns of evidence.moddedNamespacesInWorld) {
      detectedNamespacesSet.add(ns);
    }
    reasons.push(`Modded entity namespaces found in world: ${evidence.moddedNamespacesInWorld.join(", ")}`);
  }

  // 5. Scoreboards
  if (evidence.scoreboards && evidence.scoreboards.length > 0) {
    for (const sb of evidence.scoreboards) {
      if (sb.toLowerCase().includes("hydraulic") || sb.toLowerCase().includes("phlodgate")) {
        reasons.push(`Scoreboard objective '${sb}' detected`);
      }
    }
  }

  const detected = reasons.length > 0;
  const detectedNamespaces = [...detectedNamespacesSet].sort();

  let active = false;
  if (mode === "enabled") {
    active = true;
    if (!detected) {
      reasons.push("Companion mode manually forced enabled (standalone fallback available)");
    }
  } else if (mode === "disabled") {
    active = false;
    reasons.push("Companion mode manually disabled (running pure standalone mode)");
  } else {
    // "auto"
    active = detected;
    if (!detected) {
      reasons.push("No Hydraulic-Phlodgate server signal detected; running in standalone mode");
    }
  }

  return {
    active,
    mode,
    detected,
    evidence: reasons,
    detectedNamespaces,
    lastCheckedTick: tick,
  };
}

let cachedStatus: CompanionStatus = {
  active: false,
  mode: "auto",
  detected: false,
  evidence: ["Initial state before scan"],
  detectedNamespaces: [],
  lastCheckedTick: 0,
};

export function getCurrentCompanionStatus(): CompanionStatus {
  return cachedStatus;
}

export function updateCachedCompanionStatus(status: CompanionStatus): void {
  cachedStatus = status;
}
