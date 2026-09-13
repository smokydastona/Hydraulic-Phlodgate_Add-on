/**
 * Bundled Modded Recipe Definitions for Hydraulic-Phlodgate Companion Mode.
 */
import { Recipe } from "./RecipeRegistry";

export const HYDRAULIC_TEST_RECIPES: readonly Recipe[] = [
  {
    id: "hydraulic_golden_barrel",
    category: "hydraulic_machines",
    outputTypeId: "hydraulic_test_mod:golden_barrel",
    outputCount: 1,
    ingredients: [
      { typeId: "minecraft:gold_ingot", count: 8 },
      { typeId: "minecraft:barrel", count: 1 },
    ],
  },
  {
    id: "hydraulic_item_transfer_machine",
    category: "hydraulic_machines",
    outputTypeId: "hydraulic_test_mod:item_transfer_machine",
    outputCount: 1,
    ingredients: [
      { typeId: "minecraft:iron_ingot", count: 4 },
      { typeId: "minecraft:hopper", count: 1 },
      { typeId: "minecraft:redstone", count: 2 },
    ],
  },
  {
    id: "hydraulic_processing_machine",
    category: "hydraulic_machines",
    outputTypeId: "hydraulic_test_mod:processing_machine",
    outputCount: 1,
    ingredients: [
      { typeId: "minecraft:cobblestone", count: 4 },
      { typeId: "minecraft:furnace", count: 1 },
      { typeId: "minecraft:iron_ingot", count: 2 },
    ],
  },
  {
    id: "hydraulic_fluid_machine",
    category: "hydraulic_machines",
    outputTypeId: "hydraulic_test_mod:fluid_machine",
    outputCount: 1,
    ingredients: [
      { typeId: "minecraft:bucket", count: 2 },
      { typeId: "minecraft:iron_ingot", count: 4 },
      { typeId: "minecraft:glass", count: 1 },
    ],
  },
  {
    id: "hydraulic_energy_machine",
    category: "hydraulic_machines",
    outputTypeId: "hydraulic_test_mod:energy_machine",
    outputCount: 1,
    ingredients: [
      { typeId: "minecraft:copper_ingot", count: 4 },
      { typeId: "minecraft:redstone_block", count: 1 },
      { typeId: "minecraft:iron_ingot", count: 2 },
    ],
  },
  {
    id: "hydraulic_menu_machine",
    category: "hydraulic_machines",
    outputTypeId: "hydraulic_test_mod:menu_machine",
    outputCount: 1,
    ingredients: [
      { typeId: "minecraft:iron_ingot", count: 4 },
      { typeId: "minecraft:comparator", count: 1 },
      { typeId: "minecraft:crafting_table", count: 1 },
    ],
  },
];
