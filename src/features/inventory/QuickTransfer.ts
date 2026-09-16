import { Container, EntityInventoryComponent, ItemStack, Player, world } from "@minecraft/server";
import { planTransfer, SlotSnapshot, TransferMode } from "./QuickTransferPlan";
import { log } from "../../util/Logger";

interface OpenContainerRef {
  dimensionId: string;
  x: number;
  y: number;
  z: number;
}

const lastOpenedByPlayer = new Map<string, OpenContainerRef>();

/** Tracks the most recently opened block container per player so the Hydraulic Control Room's Quick Transfer action knows what to target. Call once during startup wiring. */
export function registerQuickTransferTracking(): void {
  world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    if (!event.block.getComponent("minecraft:inventory")?.container) return;
    lastOpenedByPlayer.set(event.player.id, {
      dimensionId: event.player.dimension.id,
      x: event.block.location.x,
      y: event.block.location.y,
      z: event.block.location.z,
    });
  });
}

function readSnapshot(container: Container): SlotSnapshot[] {
  const slots: SlotSnapshot[] = [];
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item) slots.push({ typeId: item.typeId, count: item.amount });
  }
  return slots;
}

function countFreeSlots(container: Container): number {
  let free = 0;
  for (let i = 0; i < container.size; i++) {
    if (!container.getItem(i)) free++;
  }
  return free;
}

function writeSnapshot(container: Container, snapshot: SlotSnapshot[]): void {
  for (let i = 0; i < container.size; i++) container.setItem(i, undefined);
  let index = 0;
  for (const stack of snapshot) {
    let remaining = stack.count;
    while (remaining > 0 && index < container.size) {
      const amount = Math.min(64, remaining);
      container.setItem(index, new ItemStack(stack.typeId, amount));
      remaining -= amount;
      index++;
    }
  }
}

export function quickTransfer(player: Player, mode: TransferMode): { ok: boolean; message: string } {
  const ref = lastOpenedByPlayer.get(player.id);
  if (!ref) return { ok: false, message: "Open a chest or other container first, then use Quick Transfer." };

  let dimension;
  try {
    dimension = world.getDimension(ref.dimensionId);
  } catch {
    return { ok: false, message: "That container's dimension is no longer available." };
  }

  const block = dimension.getBlock({ x: ref.x, y: ref.y, z: ref.z });
  const containerComponent = block?.getComponent("minecraft:inventory");
  const targetContainer = containerComponent?.container;
  if (!targetContainer) return { ok: false, message: "That container is no longer available." };

  const inventoryComponent = player.getComponent("minecraft:inventory") as EntityInventoryComponent | undefined;
  const playerContainer = inventoryComponent?.container;
  if (!playerContainer) return { ok: false, message: "No player inventory available." };

  try {
    const sourceSnapshot = readSnapshot(playerContainer);
    const destSnapshot = readSnapshot(targetContainer);
    const destFree = countFreeSlots(targetContainer);

    const result = planTransfer(sourceSnapshot, destSnapshot, destFree, mode);

    writeSnapshot(playerContainer, result.source);
    writeSnapshot(targetContainer, result.dest);

    return { ok: true, message: "Quick transfer complete." };
  } catch (err) {
    log(`Quick transfer failed: ${String(err)}`);
    return { ok: false, message: "Quick transfer failed unexpectedly; nothing was changed." };
  }
}
