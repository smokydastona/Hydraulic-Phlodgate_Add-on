/** Lootr-style per-player container loot. Each player who opens a naturally generated container gets
 *  their own working copy of the generated loot, so one player cannot empty a structure chest for everyone.
 *  Pure decisions live in LootrPlan.ts; this module only wires them to @minecraft/server side effects. */
import {
  Block,
  Container,
  ItemDurabilityComponent,
  ItemEnchantableComponent,
  ItemStack,
  Player,
  system,
  world,
} from "@minecraft/server";
import { getWorldSettings } from "../../settings/SettingsStore";
import { ACCESSORY_DEFINITIONS } from "../accessories/AccessoryPlan";
import { log } from "../../util/Logger";
import {
  containerKey,
  copyForPlayer,
  decideOpenAction,
  ItemDescriptor,
  LootrRecord,
  LootrState,
  parseLootrState,
  rollTrinketDrop,
  serializeLootrState,
  withTrinketInserted,
} from "./LootrPlan";

const LOOTR_STATE_PROPERTY = "phlodgate:lootr_state";
const PLACED_CONTAINERS_PROPERTY = "phlodgate:lootr_placed";
const MAX_PLACED_TRACKED = 512;

/** Containers a player built are ordinary storage and must never be virtualized. */
let placedContainers = new Set<string>();
let touchCounter = 0;

function readState(): LootrState {
  return parseLootrState(world.getDynamicProperty(LOOTR_STATE_PROPERTY) as string | undefined);
}

function writeState(state: LootrState): void {
  try {
    world.setDynamicProperty(LOOTR_STATE_PROPERTY, serializeLootrState(state));
  } catch (err) {
    log(`Failed to persist Lootr state: ${String(err)}`);
  }
}

function loadPlacedContainers(): void {
  try {
    const raw = world.getDynamicProperty(PLACED_CONTAINERS_PROPERTY) as string | undefined;
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    placedContainers = new Set(Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : []);
  } catch {
    placedContainers = new Set();
  }
}

function savePlacedContainers(): void {
  try {
    world.setDynamicProperty(PLACED_CONTAINERS_PROPERTY, JSON.stringify([...placedContainers]));
  } catch (err) {
    log(`Failed to persist player-placed container list: ${String(err)}`);
  }
}

function getContainer(block: Block): Container | undefined {
  try {
    const inventory = block.getComponent("minecraft:inventory");
    return inventory?.container ?? undefined;
  } catch {
    return undefined;
  }
}

function describeItem(item: ItemStack, slot: number): ItemDescriptor {
  const descriptor: ItemDescriptor = { slot, typeId: item.typeId, amount: item.amount };

  if (item.nameTag) descriptor.nameTag = item.nameTag;
  const lore = item.getLore();
  if (lore.length > 0) descriptor.lore = lore;

  try {
    const durability = item.getComponent("minecraft:durability") as ItemDurabilityComponent | undefined;
    if (durability && durability.damage > 0) descriptor.damage = durability.damage;
  } catch {
    // Item has no durability component; nothing to record.
  }

  try {
    const enchantable = item.getComponent("minecraft:enchantable") as ItemEnchantableComponent | undefined;
    const enchantments = enchantable?.getEnchantments() ?? [];
    if (enchantments.length > 0) {
      descriptor.enchantments = enchantments.map((entry) => ({ id: entry.type.id, level: entry.level }));
    }
  } catch {
    // Item cannot be enchanted; nothing to record.
  }

  return descriptor;
}

function buildItem(descriptor: ItemDescriptor): ItemStack | undefined {
  let item: ItemStack;
  try {
    item = new ItemStack(descriptor.typeId, descriptor.amount);
  } catch {
    // The item no longer exists in this Bedrock version or came from a removed pack.
    return undefined;
  }

  if (descriptor.nameTag) item.nameTag = descriptor.nameTag;
  if (descriptor.lore) item.setLore(descriptor.lore);

  if (descriptor.damage !== undefined) {
    try {
      const durability = item.getComponent("minecraft:durability") as ItemDurabilityComponent | undefined;
      if (durability) durability.damage = Math.min(durability.maxDurability, descriptor.damage);
    } catch {
      // Restoring wear is best-effort; the item itself is still valid.
    }
  }

  if (descriptor.enchantments) {
    try {
      const enchantable = item.getComponent("minecraft:enchantable") as ItemEnchantableComponent | undefined;
      for (const entry of descriptor.enchantments) {
        try {
          enchantable?.addEnchantment({ type: entry.id, level: entry.level } as never);
        } catch {
          // One unknown/incompatible enchantment must not discard the whole item.
        }
      }
    } catch {
      // Item cannot be enchanted in this version.
    }
  }

  return item;
}

function snapshotContainer(container: Container): ItemDescriptor[] {
  const items: ItemDescriptor[] = [];
  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (item) items.push(describeItem(item, slot));
  }
  return items;
}

function applyToContainer(container: Container, items: readonly ItemDescriptor[]): void {
  for (let slot = 0; slot < container.size; slot++) container.setItem(slot, undefined);
  for (const descriptor of items) {
    if (descriptor.slot >= container.size) continue;
    const item = buildItem(descriptor);
    if (item) container.setItem(descriptor.slot, item);
  }
}

function seedTrinket(items: ItemDescriptor[], containerSize: number): ItemDescriptor[] {
  const settings = getWorldSettings();
  if (!settings.trinketWorldLootEnabled) return items;

  const trinketIds = ACCESSORY_DEFINITIONS.map((entry) => entry.itemTypeId);
  const chosen = rollTrinketDrop(Math.random(), Math.random(), settings.trinketLootChancePercent, trinketIds);
  if (!chosen) return items;
  return withTrinketInserted(items, chosen, containerSize);
}

function handleContainerOpen(player: Player, block: Block): void {
  const settings = getWorldSettings();
  if (!settings.lootrChestsEnabled) return;

  let key: string;
  let container: Container | undefined;
  try {
    if (!block.isValid || !player.isValid) return;
    key = containerKey(block.dimension.id, block.location.x, block.location.y, block.location.z);
    if (placedContainers.has(key)) return;
    container = getContainer(block);
  } catch (err) {
    log(`Lootr could not inspect a container: ${String(err)}`);
    return;
  }
  if (!container) return;

  const state = readState();
  const existing: LootrRecord | undefined = state[key];
  const action = decideOpenAction(existing, player.id);
  if (action.kind === "none") return;

  try {
    if (action.kind === "snapshot") {
      const generated = seedTrinket(snapshotContainer(container), container.size);
      // An empty natural container has nothing worth virtualizing, and tracking it would waste budget.
      if (generated.length === 0) return;
      state[key] = { snapshot: generated, players: {}, lastOpener: player.id, touched: ++touchCounter };
      applyToContainer(container, copyForPlayer(state[key], player.id));
      writeState(state);
      return;
    }

    const record = existing!;
    if (action.persistFor) record.players[action.persistFor] = snapshotContainer(container);
    applyToContainer(container, copyForPlayer(record, action.loadFor));
    record.lastOpener = action.loadFor;
    record.touched = ++touchCounter;
    state[key] = record;
    writeState(state);
  } catch (err) {
    log(`Lootr failed to swap container contents for ${player.name}: ${String(err)}`);
  }
}

function forgetContainer(dimensionId: string, x: number, y: number, z: number): void {
  const key = containerKey(dimensionId, x, y, z);
  let changed = false;

  if (placedContainers.delete(key)) {
    savePlacedContainers();
    changed = true;
  }

  const state = readState();
  if (state[key]) {
    delete state[key];
    writeState(state);
    changed = true;
  }
  if (!changed) return;
}

export function registerLootrSystem(): void {
  loadPlacedContainers();

  world.afterEvents.playerPlaceBlock.subscribe((event) => {
    try {
      if (!getContainer(event.block)) return;
      const key = containerKey(event.block.dimension.id, event.block.location.x, event.block.location.y, event.block.location.z);
      if (placedContainers.size >= MAX_PLACED_TRACKED) {
        // Oldest insertion order first; a evicted entry simply becomes eligible for virtualization again.
        const oldest = placedContainers.values().next().value;
        if (typeof oldest === "string") placedContainers.delete(oldest);
      }
      placedContainers.add(key);
      savePlacedContainers();
    } catch (err) {
      log(`Lootr failed to record a player-placed container: ${String(err)}`);
    }
  });

  world.afterEvents.playerBreakBlock.subscribe((event) => {
    try {
      forgetContainer(
        event.dimension.id,
        event.block.location.x,
        event.block.location.y,
        event.block.location.z
      );
    } catch (err) {
      log(`Lootr failed to release a broken container: ${String(err)}`);
    }
  });

  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    if (event.player.isSneaking) return;
    const player = event.player;
    const block = event.block;
    // The swap must happen outside the read-only before-event phase, but still before the client
    // finishes opening the container.
    system.run(() => handleContainerOpen(player, block));
  });
}
