/** Recipe registry + pure crafting math (JEI-style browser/mass-craft backing data). */
import { extractNamespace } from "../companion/CompanionDetector";

export interface RecipeIngredient {
  typeId: string;
  count: number;
}

export interface Recipe {
  id: string;
  category: string;
  outputTypeId: string;
  outputCount: number;
  ingredients: RecipeIngredient[];
}

export const BASE_RECIPES: readonly Recipe[] = [
  { id: "planks_oak", category: "building", outputTypeId: "minecraft:oak_planks", outputCount: 4, ingredients: [{ typeId: "minecraft:oak_log", count: 1 }] },
  { id: "stick", category: "building", outputTypeId: "minecraft:stick", outputCount: 4, ingredients: [{ typeId: "minecraft:oak_planks", count: 2 }] },
  { id: "crafting_table", category: "building", outputTypeId: "minecraft:crafting_table", outputCount: 1, ingredients: [{ typeId: "minecraft:oak_planks", count: 4 }] },
  { id: "furnace", category: "building", outputTypeId: "minecraft:furnace", outputCount: 1, ingredients: [{ typeId: "minecraft:cobblestone", count: 8 }] },
  { id: "chest", category: "building", outputTypeId: "minecraft:chest", outputCount: 1, ingredients: [{ typeId: "minecraft:oak_planks", count: 8 }] },
  { id: "torch", category: "building", outputTypeId: "minecraft:torch", outputCount: 4, ingredients: [{ typeId: "minecraft:coal", count: 1 }, { typeId: "minecraft:stick", count: 1 }] },
  { id: "wooden_pickaxe", category: "tools", outputTypeId: "minecraft:wooden_pickaxe", outputCount: 1, ingredients: [{ typeId: "minecraft:oak_planks", count: 3 }, { typeId: "minecraft:stick", count: 2 }] },
  { id: "stone_pickaxe", category: "tools", outputTypeId: "minecraft:stone_pickaxe", outputCount: 1, ingredients: [{ typeId: "minecraft:cobblestone", count: 3 }, { typeId: "minecraft:stick", count: 2 }] },
  { id: "iron_pickaxe", category: "tools", outputTypeId: "minecraft:iron_pickaxe", outputCount: 1, ingredients: [{ typeId: "minecraft:iron_ingot", count: 3 }, { typeId: "minecraft:stick", count: 2 }] },
  { id: "wooden_axe", category: "tools", outputTypeId: "minecraft:wooden_axe", outputCount: 1, ingredients: [{ typeId: "minecraft:oak_planks", count: 3 }, { typeId: "minecraft:stick", count: 2 }] },
  { id: "shears", category: "tools", outputTypeId: "minecraft:shears", outputCount: 1, ingredients: [{ typeId: "minecraft:iron_ingot", count: 2 }] },
  { id: "bread", category: "food", outputTypeId: "minecraft:bread", outputCount: 1, ingredients: [{ typeId: "minecraft:wheat", count: 3 }] },
  { id: "iron_ingot_from_nuggets", category: "misc", outputTypeId: "minecraft:iron_ingot", outputCount: 1, ingredients: [{ typeId: "minecraft:iron_nugget", count: 9 }] },
  { id: "bucket", category: "tools", outputTypeId: "minecraft:bucket", outputCount: 1, ingredients: [{ typeId: "minecraft:iron_ingot", count: 3 }] },
  { id: "bookshelf", category: "building", outputTypeId: "minecraft:bookshelf", outputCount: 1, ingredients: [{ typeId: "minecraft:oak_planks", count: 6 }, { typeId: "minecraft:book", count: 3 }] },
];

let activeRecipes: Recipe[] = [...BASE_RECIPES];

/** Exported mutable alias for backward compatibility. */
export const RECIPES: Recipe[] = activeRecipes;

export function getAllRecipes(): readonly Recipe[] {
  return activeRecipes;
}

export function registerRecipe(recipe: Recipe): void {
  const existingIdx = activeRecipes.findIndex((r) => r.id === recipe.id);
  if (existingIdx >= 0) {
    activeRecipes[existingIdx] = recipe;
  } else {
    activeRecipes.push(recipe);
  }
}

export function registerModdedRecipes(recipes: readonly Recipe[]): void {
  for (const recipe of recipes) {
    registerRecipe(recipe);
  }
}

export function resetRecipesToDefault(): void {
  activeRecipes = [...BASE_RECIPES];
}

export function getRecipesByNamespace(namespace: string): Recipe[] {
  const target = namespace.toLowerCase().trim();
  return activeRecipes.filter((r) => extractNamespace(r.outputTypeId) === target);
}

export function getAvailableCategories(): string[] {
  const cats = new Set<string>();
  for (const r of activeRecipes) cats.add(r.category);
  return [...cats].sort();
}

export function searchRecipes(query: string, namespaceFilter?: string): Recipe[] {
  const q = query.trim().toLowerCase();
  const ns = namespaceFilter?.trim().toLowerCase();

  return activeRecipes.filter((r) => {
    if (ns && extractNamespace(r.outputTypeId) !== ns) {
      return false;
    }
    if (!q) return true;
    return (
      r.outputTypeId.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    );
  });
}

export function recipesByCategory(category: string): Recipe[] {
  return activeRecipes.filter((r) => r.category === category);
}

export function getRecipe(id: string): Recipe | undefined {
  return activeRecipes.find((r) => r.id === id);
}

/** Minimal inventory snapshot used for pure crafting math (mirrors what MassCraft reads from a real Container). */
export interface InventorySlotSnapshot {
  typeId: string;
  count: number;
}

export function countAvailable(inventory: InventorySlotSnapshot[], typeId: string): number {
  return inventory.filter((slot) => slot.typeId === typeId).reduce((sum, slot) => sum + slot.count, 0);
}

/** How many times `recipe` could be crafted given the inventory snapshot. */
export function maxCraftable(recipe: Recipe, inventory: InventorySlotSnapshot[]): number {
  let max = Infinity;
  for (const ingredient of recipe.ingredients) {
    const available = countAvailable(inventory, ingredient.typeId);
    max = Math.min(max, Math.floor(available / ingredient.count));
  }
  return Number.isFinite(max) ? Math.max(0, max) : 0;
}

export function canCraft(recipe: Recipe, inventory: InventorySlotSnapshot[], times = 1): boolean {
  return maxCraftable(recipe, inventory) >= times;
}

/** Consumes `times` crafts worth of ingredients from a snapshot and returns the resulting snapshot (does not mutate input). Throws if there isn't enough. */
export function consumeIngredients(
  recipe: Recipe,
  inventory: InventorySlotSnapshot[],
  times: number
): InventorySlotSnapshot[] {
  if (times <= 0) return inventory.map((s) => ({ ...s }));
  if (!canCraft(recipe, inventory, times)) {
    throw new Error(`Not enough ingredients to craft "${recipe.id}" x${times}`);
  }

  const working = inventory.map((s) => ({ ...s }));
  for (const ingredient of recipe.ingredients) {
    let remaining = ingredient.count * times;
    for (const slot of working) {
      if (remaining <= 0) break;
      if (slot.typeId !== ingredient.typeId || slot.count <= 0) continue;
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
    }
  }
  return working.filter((s) => s.count > 0);
}
