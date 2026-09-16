import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { Player } from "@minecraft/server";
import { getAllRecipes, getAvailableCategories, Recipe, recipesByCategory, searchRecipes } from "../../features/inventory/RecipeRegistry";
import { massCraft } from "../../features/inventory/MassCraft";
import { quickTransfer } from "../../features/inventory/QuickTransfer";
import { log } from "../../util/Logger";
import { showFormWithRetry } from "../FormRuntime";
import { readModalValues, readSelection } from "../FormValidation";

export async function openInventoryMenu(player: Player): Promise<void> {
  const form = new ActionFormData()
    .title("Inventory & Recipes")
    .button("Browse recipes")
    .button("Browse by category")
    .button("Search recipes")
    .button("Quick transfer: Move all \u2192 container")
    .button("Quick transfer: Move matching only \u2192 container");

  try {
    const response = await showFormWithRetry(player, () => form, { context: "Inventory menu" });
    if (!response) return;
    const selection = readSelection(response);
    if (selection === undefined) return;

    switch (selection) {
      case 0:
        await openRecipeList(player, [...getAllRecipes()], 1, "All recipes");
        break;
      case 1:
        await openCategoryList(player);
        break;
      case 2:
        await openSearchForm(player);
        break;
      case 3:
        reportTransfer(player, quickTransfer(player, "all"));
        break;
      case 4:
        reportTransfer(player, quickTransfer(player, "matching-only"));
        break;
    }
  } catch (err) {
    log(`Inventory menu failed: ${String(err)}`);
  }
}

function reportTransfer(player: Player, result: { ok: boolean; message: string }): void {
  player.sendMessage(result.ok ? `§a${result.message}` : `§c${result.message}`);
}

async function openSearchForm(player: Player): Promise<void> {
  const form = new ModalFormData().title("Search Recipes").textField("Item name / recipe id / category", "e.g. pickaxe");
  const response = await showFormWithRetry(player, () => form, { context: "Recipe search" });
  if (!response) return;
  const values = readModalValues(response, 1);
  if (!values) return;

  const query = String(values[0] ?? "").trim().slice(0, 64);
  const results = searchRecipes(query);
  await openRecipeList(player, results, 1, `Search: ${query || "all"}`);
}

async function openCategoryList(player: Player): Promise<void> {
  const categories = getAvailableCategories();
  const form = new ActionFormData().title("Recipe Categories").button("All recipes");
  for (const category of categories) form.button(category);

  const response = await showFormWithRetry(player, () => form, { context: "Recipe categories" });
  if (!response) return;
  const selection = readSelection(response);
  if (selection === undefined) return;
  const category = selection === 0 ? undefined : categories[selection - 1];
  await openRecipeList(player, category ? recipesByCategory(category) : [...getAllRecipes()], 1, category ?? "All recipes");
}

async function openRecipeList(player: Player, recipes: Recipe[], page = 1, label = "Recipes"): Promise<void> {
  if (recipes.length === 0) {
    player.sendMessage("§7No recipes matched.");
    return;
  }

  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(recipes.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, page));
  const pageRecipes = recipes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const form = new ActionFormData().title(`${label} (${currentPage}/${totalPages})`);
  for (const recipe of pageRecipes) {
    const ingredientSummary = recipe.ingredients.map((i) => `${i.count}x ${i.typeId.replace("minecraft:", "")}`).join(", ");
    form.button(`${recipe.outputTypeId.replace("minecraft:", "")} x${recipe.outputCount}\n§7${ingredientSummary}`);
  }
  if (currentPage < totalPages) form.button(`Next page (${currentPage + 1}/${totalPages})`);
  if (currentPage > 1) form.button(`Previous page (${currentPage - 1}/${totalPages})`);

  const response = await showFormWithRetry(player, () => form, { context: "Recipe list" });
  if (!response) return;
  const selection = readSelection(response);
  if (selection === undefined) return;

  if (selection < pageRecipes.length) {
    await openRecipeDetail(player, pageRecipes[selection]);
    return;
  }
  const nextIndex = pageRecipes.length;
  if (currentPage < totalPages && selection === nextIndex) {
    await openRecipeList(player, recipes, currentPage + 1, label);
    return;
  }
  if (currentPage > 1 && selection === nextIndex + (currentPage < totalPages ? 1 : 0)) {
    await openRecipeList(player, recipes, currentPage - 1, label);
  }
}

async function openRecipeDetail(player: Player, recipe: Recipe): Promise<void> {
  const form = new ModalFormData()
    .title(recipe.outputTypeId.replace("minecraft:", ""))
    .slider("Quantity to craft (batches)", 1, 64, { defaultValue: 1, valueStep: 1 });

  const response = await showFormWithRetry(player, () => form, { context: "Recipe detail" });
  if (!response) return;
  const values = readModalValues(response, 1);
  if (!values) return;

  const times = Math.max(1, Math.min(64, Math.floor(Number(values[0] ?? 1))));
  const result = massCraft(player, recipe.id, times);
  player.sendMessage(result.ok ? `§a${result.message}` : `§c${result.message}`);
}
