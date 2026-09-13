import { EntityInventoryComponent, ItemStack, Player } from "@minecraft/server";
import { canCraft, getRecipe, maxCraftable, Recipe } from "./RecipeRegistry";

export interface MassCraftResult {
  ok: boolean;
  message: string;
  crafted: number;
}

interface IndexedSlot {
  index: number;
  typeId: string;
  count: number;
}

function readIndexedSnapshot(inventory: EntityInventoryComponent): IndexedSlot[] {
  const container = inventory.container;
  if (!container) return [];
  const slots: IndexedSlot[] = [];
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item) slots.push({ index: i, typeId: item.typeId, count: item.amount });
  }
  return slots;
}

/** Crafts `recipe` up to `requestedTimes` (clamped to what the player's inventory can actually support), consuming ingredients slot-by-slot and depositing output. */
export function massCraft(player: Player, recipeId: string, requestedTimes: number): MassCraftResult {
  const recipe = getRecipe(recipeId);
  if (!recipe) return { ok: false, message: `Unknown recipe "${recipeId}".`, crafted: 0 };
  if (requestedTimes <= 0) return { ok: false, message: "Quantity must be positive.", crafted: 0 };

  const inventory = player.getComponent("minecraft:inventory") as EntityInventoryComponent | undefined;
  const container = inventory?.container;
  if (!inventory || !container) return { ok: false, message: "No inventory available.", crafted: 0 };

  const snapshot = readIndexedSnapshot(inventory);
  const flatSnapshot = snapshot.map(({ typeId, count }) => ({ typeId, count }));
  const available = maxCraftable(recipe, flatSnapshot);
  const times = Math.min(available, requestedTimes);

  if (times <= 0) {
    return { ok: false, message: "Not enough ingredients to craft even one.", crafted: 0 };
  }
  if (!canCraft(recipe, flatSnapshot, times)) {
    return { ok: false, message: "Not enough ingredients for the requested quantity.", crafted: 0 };
  }

  consumeFromContainer(container, snapshot, recipe, times);

  const outputCount = recipe.outputCount * times;
  depositOutput(player, container, recipe.outputTypeId, outputCount);

  const shortfall = requestedTimes - times;
  const message =
    shortfall > 0
      ? `Crafted ${times}x ${recipe.outputTypeId.replace("minecraft:", "")} (limited by available ingredients).`
      : `Crafted ${times}x ${recipe.outputTypeId.replace("minecraft:", "")}.`;

  return { ok: true, message, crafted: times };
}

function consumeFromContainer(
  container: NonNullable<EntityInventoryComponent["container"]>,
  snapshot: IndexedSlot[],
  recipe: Recipe,
  times: number
): void {
  for (const ingredient of recipe.ingredients) {
    let remaining = ingredient.count * times;
    for (const slot of snapshot) {
      if (remaining <= 0) break;
      if (slot.typeId !== ingredient.typeId || slot.count <= 0) continue;
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      if (slot.count <= 0) {
        container.setItem(slot.index, undefined);
      } else {
        const current = container.getItem(slot.index);
        if (current) {
          current.amount = slot.count;
          container.setItem(slot.index, current);
        }
      }
    }
  }
}

function depositOutput(
  player: Player,
  container: NonNullable<EntityInventoryComponent["container"]>,
  typeId: string,
  count: number
): void {
  const maxStack = 64;
  let remaining = count;
  while (remaining > 0) {
    const stackSize = Math.min(maxStack, remaining);
    const leftover = container.addItem(new ItemStack(typeId, stackSize));
    if (leftover) {
      // Inventory full: drop the remainder at the player's feet instead of destroying it.
      player.dimension.spawnItem(leftover, player.location);
      remaining = 0;
    } else {
      remaining -= stackSize;
    }
  }
}
