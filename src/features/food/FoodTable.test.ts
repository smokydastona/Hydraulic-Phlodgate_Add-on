import { describe, it, expect } from "vitest";
import { isKnownFood, predictFoodEffect } from "./FoodTable";

describe("predictFoodEffect", () => {
  it("returns undefined for unknown items", () => {
    expect(predictFoodEffect("minecraft:diamond", 10, 5)).toBeUndefined();
  });

  it("computes hunger and saturation gain for bread", () => {
    const result = predictFoodEffect("minecraft:bread", 10, 5)!;
    expect(result.hungerGain).toBe(5);
    expect(result.hungerAfter).toBe(15);
    // saturation gain = min(5*0.6*2, 20-10+5) = min(6, 15) = 6
    expect(result.saturationGain).toBeCloseTo(6);
    expect(result.saturationAfter).toBeCloseTo(11);
  });

  it("caps hunger at the max", () => {
    const result = predictFoodEffect("minecraft:cooked_beef", 18, 0)!;
    expect(result.hungerAfter).toBe(20);
  });

  it("caps saturation at the resulting hunger value", () => {
    const result = predictFoodEffect("minecraft:golden_carrot", 19, 20)!;
    expect(result.saturationAfter).toBeLessThanOrEqual(result.hungerAfter);
  });
});

describe("isKnownFood", () => {
  it("recognizes table entries", () => {
    expect(isKnownFood("minecraft:apple")).toBe(true);
    expect(isKnownFood("minecraft:stick")).toBe(false);
  });
});
