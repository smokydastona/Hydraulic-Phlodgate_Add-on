/** Pure logic for Lootr-style per-player container loot and natural trinket seeding.
 *  No @minecraft/server imports, so every decision here is unit-testable without a Bedrock runtime. */

export interface ItemDescriptor {
  slot: number;
  typeId: string;
  amount: number;
  nameTag?: string;
  lore?: string[];
  damage?: number;
  enchantments?: Array<{ id: string; level: number }>;
}

export interface LootrRecord {
  /** The generated loot as it existed the first time any player opened this container. */
  snapshot: ItemDescriptor[];
  /** Per-player working copies, keyed by player id. */
  players: Record<string, ItemDescriptor[]>;
  /** Whose copy is currently loaded into the real container. */
  lastOpener?: string;
  /** Monotonic counter used for bounded eviction; higher means more recently touched. */
  touched: number;
}

export type LootrState = Record<string, LootrRecord>;

/** Dynamic properties are size-limited, so the whole store is capped and the least recently used
 *  containers are evicted rather than allowed to grow without bound. */
export const MAX_TRACKED_CONTAINERS = 192;
export const MAX_SERIALIZED_LENGTH = 28000;

export function containerKey(dimensionId: string, x: number, y: number, z: number): string {
  return `${dimensionId}:${Math.floor(x)}:${Math.floor(y)}:${Math.floor(z)}`;
}

function sanitizeEnchantments(raw: unknown): Array<{ id: string; level: number }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const result: Array<{ id: string; level: number }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as { id?: unknown; level?: unknown };
    const id = typeof candidate.id === "string" ? candidate.id : undefined;
    const level = Number(candidate.level);
    if (!id || !Number.isFinite(level) || level <= 0) continue;
    result.push({ id, level: Math.min(255, Math.floor(level)) });
  }
  return result.length > 0 ? result : undefined;
}

export function sanitizeDescriptor(raw: unknown): ItemDescriptor | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const candidate = raw as Record<string, unknown>;
  const typeId = typeof candidate.typeId === "string" ? candidate.typeId.trim() : "";
  const slot = Number(candidate.slot);
  const amount = Number(candidate.amount);
  if (!typeId || !Number.isInteger(slot) || slot < 0 || !Number.isFinite(amount) || amount <= 0) return undefined;

  const descriptor: ItemDescriptor = { slot, typeId, amount: Math.min(255, Math.floor(amount)) };
  if (typeof candidate.nameTag === "string" && candidate.nameTag.length > 0) {
    descriptor.nameTag = candidate.nameTag.slice(0, 64);
  }
  if (Array.isArray(candidate.lore)) {
    const lore = candidate.lore.filter((line): line is string => typeof line === "string").slice(0, 8);
    if (lore.length > 0) descriptor.lore = lore;
  }
  const damage = Number(candidate.damage);
  if (Number.isFinite(damage) && damage > 0) descriptor.damage = Math.floor(damage);
  const enchantments = sanitizeEnchantments(candidate.enchantments);
  if (enchantments) descriptor.enchantments = enchantments;
  return descriptor;
}

function sanitizeDescriptorList(raw: unknown): ItemDescriptor[] {
  if (!Array.isArray(raw)) return [];
  const result: ItemDescriptor[] = [];
  for (const entry of raw) {
    const descriptor = sanitizeDescriptor(entry);
    if (descriptor) result.push(descriptor);
  }
  return result;
}

export function parseLootrState(raw: string | undefined): LootrState {
  if (!raw || raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const state: LootrState = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const record = value as Record<string, unknown>;
      const players: Record<string, ItemDescriptor[]> = {};
      if (record.players && typeof record.players === "object" && !Array.isArray(record.players)) {
        for (const [playerId, items] of Object.entries(record.players as Record<string, unknown>)) {
          if (typeof playerId !== "string" || playerId.length === 0) continue;
          players[playerId] = sanitizeDescriptorList(items);
        }
      }
      const touched = Number(record.touched);
      state[key] = {
        snapshot: sanitizeDescriptorList(record.snapshot),
        players,
        lastOpener: typeof record.lastOpener === "string" ? record.lastOpener : undefined,
        touched: Number.isFinite(touched) ? touched : 0,
      };
    }
    return state;
  } catch {
    return {};
  }
}

/** Serializes the store, evicting least recently touched containers until it fits the property budget. */
export function serializeLootrState(state: LootrState): string {
  const entries = Object.entries(state).sort((a, b) => b[1].touched - a[1].touched);
  let kept = entries.slice(0, MAX_TRACKED_CONTAINERS);

  let serialized = JSON.stringify(Object.fromEntries(kept));
  while (serialized.length > MAX_SERIALIZED_LENGTH && kept.length > 0) {
    kept = kept.slice(0, kept.length - 1);
    serialized = JSON.stringify(Object.fromEntries(kept));
  }
  return serialized;
}

export type LootrOpenAction =
  | { kind: "snapshot"; loadFor: string }
  | { kind: "load"; loadFor: string; persistFor?: string }
  | { kind: "none" };

/** Decides what must happen when `playerId` opens a tracked container.
 *  - no record yet: capture the generated loot, then load it for this player.
 *  - a different player last held the container: persist their working copy first, then load this player's.
 *  - the same player re-opens: the container already holds their copy, so nothing moves. */
export function decideOpenAction(record: LootrRecord | undefined, playerId: string): LootrOpenAction {
  if (!playerId) return { kind: "none" };
  if (!record) return { kind: "snapshot", loadFor: playerId };
  if (record.lastOpener === playerId) return { kind: "none" };
  return { kind: "load", loadFor: playerId, persistFor: record.lastOpener };
}

/** Returns the working copy a player should see: their own if they have one, otherwise a fresh
 *  copy of the original generated loot. */
export function copyForPlayer(record: LootrRecord, playerId: string): ItemDescriptor[] {
  const existing = record.players[playerId];
  const source = existing ?? record.snapshot;
  return source.map((item) => ({ ...item }));
}

/** Weighted, deterministic trinket selection. `roll` and `pick` are caller-supplied in [0, 1) so the
 *  behavior is reproducible in tests instead of depending on Math.random. */
export function rollTrinketDrop(
  roll: number,
  pick: number,
  chancePercent: number,
  trinketIds: readonly string[]
): string | undefined {
  if (trinketIds.length === 0) return undefined;
  if (!Number.isFinite(roll) || !Number.isFinite(pick)) return undefined;
  const chance = Math.min(100, Math.max(0, chancePercent));
  if (chance <= 0) return undefined;
  if (roll * 100 >= chance) return undefined;

  const index = Math.min(trinketIds.length - 1, Math.max(0, Math.floor(pick * trinketIds.length)));
  return trinketIds[index];
}

/** Places a trinket into the first free slot below `containerSize`, or returns the list unchanged when
 *  the generated loot already fills the container. */
export function withTrinketInserted(
  items: readonly ItemDescriptor[],
  trinketTypeId: string,
  containerSize: number
): ItemDescriptor[] {
  const used = new Set(items.map((item) => item.slot));
  for (let slot = 0; slot < containerSize; slot++) {
    if (used.has(slot)) continue;
    return [...items.map((item) => ({ ...item })), { slot, typeId: trinketTypeId, amount: 1 }];
  }
  return items.map((item) => ({ ...item }));
}
