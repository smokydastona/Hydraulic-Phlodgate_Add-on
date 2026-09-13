/** Static food data table + prediction math (mirrors the public Minecraft food mechanics formula that AppleSkin itself relies on). Pure/testable. */

export interface FoodProperties {
  nutrition: number;
  saturationModifier: number;
}

export const FOOD_TABLE: Record<string, FoodProperties> = {
  "minecraft:apple": { nutrition: 4, saturationModifier: 0.3 },
  "minecraft:baked_potato": { nutrition: 5, saturationModifier: 0.6 },
  "minecraft:beef": { nutrition: 3, saturationModifier: 0.3 },
  "minecraft:beetroot": { nutrition: 1, saturationModifier: 0.6 },
  "minecraft:beetroot_soup": { nutrition: 6, saturationModifier: 0.6 },
  "minecraft:bread": { nutrition: 5, saturationModifier: 0.6 },
  "minecraft:carrot": { nutrition: 3, saturationModifier: 0.6 },
  "minecraft:chicken": { nutrition: 2, saturationModifier: 0.3 },
  "minecraft:cooked_beef": { nutrition: 8, saturationModifier: 0.8 },
  "minecraft:cooked_chicken": { nutrition: 6, saturationModifier: 0.6 },
  "minecraft:cooked_cod": { nutrition: 5, saturationModifier: 0.6 },
  "minecraft:cooked_mutton": { nutrition: 6, saturationModifier: 0.8 },
  "minecraft:cooked_porkchop": { nutrition: 8, saturationModifier: 0.8 },
  "minecraft:cooked_rabbit": { nutrition: 5, saturationModifier: 0.6 },
  "minecraft:cooked_salmon": { nutrition: 6, saturationModifier: 0.8 },
  "minecraft:cookie": { nutrition: 2, saturationModifier: 0.1 },
  "minecraft:golden_apple": { nutrition: 4, saturationModifier: 1.2 },
  "minecraft:golden_carrot": { nutrition: 6, saturationModifier: 1.2 },
  "minecraft:melon_slice": { nutrition: 2, saturationModifier: 0.3 },
  "minecraft:mushroom_stew": { nutrition: 6, saturationModifier: 0.6 },
  "minecraft:mutton": { nutrition: 2, saturationModifier: 0.3 },
  "minecraft:porkchop": { nutrition: 3, saturationModifier: 0.3 },
  "minecraft:potato": { nutrition: 1, saturationModifier: 0.3 },
  "minecraft:pumpkin_pie": { nutrition: 8, saturationModifier: 0.3 },
  "minecraft:rabbit": { nutrition: 3, saturationModifier: 0.3 },
  "minecraft:rabbit_stew": { nutrition: 10, saturationModifier: 0.6 },
  "minecraft:cod": { nutrition: 2, saturationModifier: 0.1 },
  "minecraft:salmon": { nutrition: 2, saturationModifier: 0.1 },
  "minecraft:suspicious_stew": { nutrition: 6, saturationModifier: 0.3 },
  "minecraft:sweet_berries": { nutrition: 2, saturationModifier: 0.1 },
  "minecraft:dried_kelp": { nutrition: 1, saturationModifier: 0.3 },
  "minecraft:honey_bottle": { nutrition: 6, saturationModifier: 0.1 },
};

export interface FoodPrediction {
  hungerAfter: number;
  saturationAfter: number;
  hungerGain: number;
  saturationGain: number;
}

/** Predicts hunger/saturation after eating one unit of `itemId`, given current values and the vanilla 0-20 caps. */
export function predictFoodEffect(
  itemId: string,
  currentHunger: number,
  currentSaturation: number,
  hungerMax = 20
): FoodPrediction | undefined {
  const props = FOOD_TABLE[itemId];
  if (!props) return undefined;

  const hungerGain = props.nutrition;
  const saturationGain = Math.min(props.nutrition * props.saturationModifier * 2, hungerMax - currentHunger + props.nutrition);

  const hungerAfter = Math.min(hungerMax, currentHunger + hungerGain);
  const saturationAfter = Math.min(hungerAfter, currentSaturation + saturationGain);

  return { hungerAfter, saturationAfter, hungerGain, saturationGain };
}

export function isKnownFood(itemId: string): boolean {
  return itemId in FOOD_TABLE;
}
