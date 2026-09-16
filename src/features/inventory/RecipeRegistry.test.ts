import { describe, it, expect, beforeEach } from "vitest";
import {
  canCraft,
  consumeIngredients,
  countAvailable,
  getAllRecipes,
  getAvailableCategories,
  getRecipe,
  getRecipesByNamespace,
  maxCraftable,
  recipesByCategory,
  registerModdedRecipes,
  registerRecipe,
  RECIPES,
  resetRecipesToDefault,
  searchRecipes,
} from "./RecipeRegistry";
import { HYDRAULIC_TEST_RECIPES } from "./ModdedRecipes";

describe("searchRecipes and dynamic registration", () => {
  beforeEach(() => {
    resetRecipesToDefault();
  });

  it("returns all base recipes initially", () => {
    expect(searchRecipes("").length).toBeGreaterThanOrEqual(15);
  });

  it("filters by output item name", () => {
    const results = searchRecipes("pickaxe");
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.every((r) => r.outputTypeId.includes("pickaxe"))).toBe(true);
  });

  it("registers a new recipe dynamically and allows searching it", () => {
    registerRecipe({
      id: "custom_item",
      category: "custom",
      outputTypeId: "my_mod:magic_wand",
      outputCount: 1,
      ingredients: [{ typeId: "minecraft:stick", count: 2 }],
    });
    expect(getRecipe("custom_item")?.outputTypeId).toBe("my_mod:magic_wand");
    expect(searchRecipes("magic_wand").length).toBe(1);
    expect(getRecipesByNamespace("my_mod").length).toBe(1);
  });

  it("registers modded Hydraulic recipes and filters by namespace", () => {
    registerModdedRecipes(HYDRAULIC_TEST_RECIPES);
    const modRecipes = getRecipesByNamespace("hydraulic_test_mod");
    expect(modRecipes.length).toBe(6);
    expect(getRecipe("hydraulic_golden_barrel")).toBeDefined();
    expect(searchRecipes("golden_barrel", "hydraulic_test_mod").length).toBe(1);
    expect(searchRecipes("golden_barrel", "minecraft").length).toBe(0);
  });

  it("resets back to default recipes", () => {
    registerModdedRecipes(HYDRAULIC_TEST_RECIPES);
    expect(getAllRecipes().length).toBeGreaterThan(15);
    resetRecipesToDefault();
    expect(getRecipe("hydraulic_golden_barrel")).toBeUndefined();
    expect(RECIPES).toBe(getAllRecipes());
  });

  it("lists all available categories", () => {
    registerModdedRecipes(HYDRAULIC_TEST_RECIPES);
    const categories = getAvailableCategories();
    expect(categories).toContain("building");
    expect(categories).toContain("tools");
    expect(categories).toContain("hydraulic_machines");
  });
});

describe("recipesByCategory / getRecipe", () => {
  it("filters by category", () => {
    expect(recipesByCategory("tools").every((r) => r.category === "tools")).toBe(true);
  });
  it("looks up a recipe by id", () => {
    expect(getRecipe("stick")?.outputTypeId).toBe("minecraft:stick");
    expect(getRecipe("nonexistent")).toBeUndefined();
  });
});

describe("countAvailable / maxCraftable / canCraft", () => {
  const inventory = [
    { typeId: "minecraft:oak_log", count: 5 },
    { typeId: "minecraft:oak_log", count: 3 },
    { typeId: "minecraft:cobblestone", count: 2 },
  ];

  it("sums stacks of the same item across slots", () => {
    expect(countAvailable(inventory, "minecraft:oak_log")).toBe(8);
  });

  it("computes max craftable based on the scarcest ingredient", () => {
    const recipe = getRecipe("planks_oak")!;
    expect(maxCraftable(recipe, inventory)).toBe(8); // 8 logs / 1 per craft
  });

  it("returns 0 when an ingredient is entirely missing", () => {
    const recipe = getRecipe("iron_pickaxe")!;
    expect(maxCraftable(recipe, inventory)).toBe(0);
  });

  it("canCraft respects the requested multiple", () => {
    const recipe = getRecipe("planks_oak")!;
    expect(canCraft(recipe, inventory, 8)).toBe(true);
    expect(canCraft(recipe, inventory, 9)).toBe(false);
  });
});

describe("consumeIngredients", () => {
  it("removes the correct quantity across multiple stacks and drops emptied slots", () => {
    const inventory = [
      { typeId: "minecraft:oak_planks", count: 2 },
      { typeId: "minecraft:oak_planks", count: 3 },
      { typeId: "minecraft:stick", count: 10 },
    ];
    const recipe = getRecipe("stick")!; // needs 2 planks per craft
    const result = consumeIngredients(recipe, inventory, 2); // consumes 4 planks total
    const remainingPlanks = result.filter((s) => s.typeId === "minecraft:oak_planks").reduce((a, s) => a + s.count, 0);
    expect(remainingPlanks).toBe(1);
    expect(result.find((s) => s.typeId === "minecraft:stick")?.count).toBe(10);
  });

  it("throws if there are not enough ingredients", () => {
    const inventory = [{ typeId: "minecraft:oak_planks", count: 1 }];
    const recipe = getRecipe("stick")!;
    expect(() => consumeIngredients(recipe, inventory, 5)).toThrow();
  });

  it("is a no-op for times <= 0 and does not mutate the input", () => {
    const inventory = [{ typeId: "minecraft:oak_planks", count: 2 }];
    const recipe = getRecipe("stick")!;
    const result = consumeIngredients(recipe, inventory, 0);
    expect(result).toEqual(inventory);
    expect(result).not.toBe(inventory);
  });
});
