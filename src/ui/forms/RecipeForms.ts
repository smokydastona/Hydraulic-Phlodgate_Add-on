import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { Player } from "@minecraft/server";
import { RECIPES, Recipe, searchRecipes } from "../../features/inventory/RecipeRegistry";
import { massCraft } from "../../features/inventory/MassCraft";
import { quickTransfer } from "../../features/inventory/QuickTransfer";
import { log } from "../../util/Logger";

export async function openInventoryMenu(player: Player): Promise<void> {
  const form = new ActionFormData()
    .title("Inventory & Recipes")
    .button("Browse recipes")
    .button("Search recipes")
    .button("Quick transfer: Move all \u2192 container")
    .button("Quick transfer: Move matching only \u2192 container");

  try {
    const response = await form.show(player);
    if (response.canceled || response.selection === undefined) return;

    switch (response.selection) {
      case 0:
        await openRecipeList(player, RECIPES);
        break;
      case 1:
        await openSearchForm(player);
        break;
      case 2:
        reportTransfer(player, quickTransfer(player, "all"));
        break;
      case 3:
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
  const response = await form.show(player);
  if (response.canceled || !response.formValues) return;

  const query = String(response.formValues[0] ?? "");
  const results = searchRecipes(query);
  await openRecipeList(player, results);
}

async function openRecipeList(player: Player, recipes: Recipe[]): Promise<void> {
  if (recipes.length === 0) {
    player.sendMessage("§7No recipes matched.");
    return;
  }

  const form = new ActionFormData().title(`Recipes (${recipes.length})`);
  for (const recipe of recipes) {
    const ingredientSummary = recipe.ingredients.map((i) => `${i.count}x ${i.typeId.replace("minecraft:", "")}`).join(", ");
    form.button(`${recipe.outputTypeId.replace("minecraft:", "")} x${recipe.outputCount}\n§7${ingredientSummary}`);
  }

  const response = await form.show(player);
  if (response.canceled || response.selection === undefined) return;

  await openRecipeDetail(player, recipes[response.selection]);
}

async function openRecipeDetail(player: Player, recipe: Recipe): Promise<void> {
  const form = new ModalFormData()
    .title(recipe.outputTypeId.replace("minecraft:", ""))
    .slider("Quantity to craft (batches)", 1, 64, { defaultValue: 1, valueStep: 1 });

  const response = await form.show(player);
  if (response.canceled || !response.formValues) return;

  const times = Number(response.formValues[0] ?? 1);
  const result = massCraft(player, recipe.id, times);
  player.sendMessage(result.ok ? `§a${result.message}` : `§c${result.message}`);
}
