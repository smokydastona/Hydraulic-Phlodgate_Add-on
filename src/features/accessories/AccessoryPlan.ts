export type AccessorySlotId =
  | "head"
  | "necklace"
  | "back"
  | "body"
  | "belt"
  | "hands"
  | "bracelet"
  | "ring_1"
  | "ring_2"
  | "charm";

export type AccessoryEffect = {
  effectTypeId: string;
  amplifier: number;
};

export interface AccessorySlotDefinition {
  id: AccessorySlotId;
  label: string;
}

export interface AccessoryDefinition {
  itemTypeId: string;
  label: string;
  description: string;
  icon: string;
  allowedSlots: readonly AccessorySlotId[];
  effects: readonly AccessoryEffect[];
}

export interface EquippedAccessory {
  slotId: AccessorySlotId;
  itemTypeId: string;
}

export interface AccessoryState {
  equipped: EquippedAccessory[];
}

export const ACCESSORY_SLOTS: readonly AccessorySlotDefinition[] = [
  { id: "head", label: "Head" },
  { id: "necklace", label: "Necklace" },
  { id: "back", label: "Back" },
  { id: "body", label: "Body" },
  { id: "belt", label: "Belt" },
  { id: "hands", label: "Hands" },
  { id: "bracelet", label: "Bracelet" },
  { id: "ring_1", label: "Ring 1" },
  { id: "ring_2", label: "Ring 2" },
  { id: "charm", label: "Charm" },
];

export const ACCESSORY_DEFINITIONS: readonly AccessoryDefinition[] = [
  {
    itemTypeId: "phlodgate:speed_ring",
    label: "Swiftstep Ring",
    description: "Grants Speed I while equipped.",
    icon: "gold_nugget",
    allowedSlots: ["ring_1", "ring_2"],
    effects: [{ effectTypeId: "speed", amplifier: 0 }],
  },
  {
    itemTypeId: "phlodgate:water_necklace",
    label: "Tideglass Necklace",
    description: "Grants Water Breathing while equipped.",
    icon: "nautilus_shell",
    allowedSlots: ["necklace"],
    effects: [{ effectTypeId: "water_breathing", amplifier: 0 }],
  },
  {
    itemTypeId: "phlodgate:feather_charm",
    label: "Featherfall Charm",
    description: "Grants Slow Falling while equipped.",
    icon: "feather",
    allowedSlots: ["back", "charm"],
    effects: [{ effectTypeId: "slow_falling", amplifier: 0 }],
  },
  {
    itemTypeId: "phlodgate:fire_charm",
    label: "Emberguard Charm",
    description: "Grants Fire Resistance while equipped.",
    icon: "magma_cream",
    allowedSlots: ["charm"],
    effects: [{ effectTypeId: "fire_resistance", amplifier: 0 }],
  },
  {
    itemTypeId: "phlodgate:night_amulet",
    label: "Moonveil Amulet",
    description: "Grants Night Vision while equipped.",
    icon: "amethyst_shard",
    allowedSlots: ["head", "necklace"],
    effects: [{ effectTypeId: "night_vision", amplifier: 0 }],
  },
  {
    itemTypeId: "phlodgate:vitality_bracelet",
    label: "Vitality Bracelet",
    description: "Grants Resistance I while equipped.",
    icon: "iron_ingot",
    allowedSlots: ["bracelet"],
    effects: [{ effectTypeId: "resistance", amplifier: 0 }],
  },
  {
    itemTypeId: "phlodgate:haste_gloves",
    label: "Haste Gloves",
    description: "Grants Haste I while equipped.",
    icon: "leather",
    allowedSlots: ["hands"],
    effects: [{ effectTypeId: "haste", amplifier: 0 }],
  },
];

export const ACCESSORY_DEFINITIONS_BY_ID = new Map(ACCESSORY_DEFINITIONS.map((definition) => [definition.itemTypeId, definition]));
export const ACCESSORY_SLOTS_BY_ID = new Map(ACCESSORY_SLOTS.map((slot) => [slot.id, slot]));

export function emptyAccessoryState(): AccessoryState {
  return { equipped: [] };
}

export function getAccessoryDefinition(itemTypeId: string): AccessoryDefinition | undefined {
  return ACCESSORY_DEFINITIONS_BY_ID.get(itemTypeId);
}

export function getAccessorySlot(slotId: string): AccessorySlotDefinition | undefined {
  return ACCESSORY_SLOTS_BY_ID.get(slotId as AccessorySlotId);
}

export function normalizeAccessoryState(value: unknown): AccessoryState {
  if (!value || typeof value !== "object") return emptyAccessoryState();
  const entries = Array.isArray((value as { equipped?: unknown }).equipped) ? (value as { equipped: unknown[] }).equipped : [];
  const occupied = new Set<string>();
  const equipped: EquippedAccessory[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const slotId = String((entry as { slotId?: unknown }).slotId ?? "") as AccessorySlotId;
    const itemTypeId = String((entry as { itemTypeId?: unknown }).itemTypeId ?? "");
    const definition = getAccessoryDefinition(itemTypeId);
    if (!getAccessorySlot(slotId) || !definition || !definition.allowedSlots.includes(slotId) || occupied.has(slotId)) continue;
    occupied.add(slotId);
    equipped.push({ slotId, itemTypeId });
  }

  return { equipped };
}

export function canEquipAccessory(state: AccessoryState, itemTypeId: string, slotId: AccessorySlotId): boolean {
  const definition = getAccessoryDefinition(itemTypeId);
  return !!definition && definition.allowedSlots.includes(slotId) && !state.equipped.some((entry) => entry.slotId === slotId);
}

export function equipAccessory(state: AccessoryState, itemTypeId: string, slotId: AccessorySlotId): AccessoryState | undefined {
  if (!canEquipAccessory(state, itemTypeId, slotId)) return undefined;
  return { equipped: [...state.equipped, { slotId, itemTypeId }] };
}

export function unequipAccessory(state: AccessoryState, slotId: AccessorySlotId): { state: AccessoryState; itemTypeId?: string } {
  const removed = state.equipped.find((entry) => entry.slotId === slotId);
  return {
    state: { equipped: state.equipped.filter((entry) => entry.slotId !== slotId) },
    itemTypeId: removed?.itemTypeId,
  };
}

export function aggregateAccessoryEffects(state: AccessoryState): AccessoryEffect[] {
  const effects = new Map<string, number>();
  for (const entry of state.equipped) {
    for (const effect of getAccessoryDefinition(entry.itemTypeId)?.effects ?? []) {
      effects.set(effect.effectTypeId, Math.max(effects.get(effect.effectTypeId) ?? 0, effect.amplifier));
    }
  }
  return [...effects.entries()].map(([effectTypeId, amplifier]) => ({ effectTypeId, amplifier }));
}
