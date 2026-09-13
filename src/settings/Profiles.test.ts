import { describe, it, expect } from "vitest";
import { isValidMode, resolveFogThresholds, resolveOptimizationThresholds } from "./Profiles";

describe("resolveOptimizationThresholds", () => {
  it("gets stricter (smaller radii, higher aggressiveness) balanced -> aggressive -> extreme", () => {
    const balanced = resolveOptimizationThresholds("balanced");
    const aggressive = resolveOptimizationThresholds("aggressive");
    const extreme = resolveOptimizationThresholds("extreme");

    expect(aggressive.mobDespawnRadius).toBeLessThan(balanced.mobDespawnRadius);
    expect(extreme.mobDespawnRadius).toBeLessThan(aggressive.mobDespawnRadius);

    expect(aggressive.removalAggressiveness).toBeGreaterThan(balanced.removalAggressiveness);
    expect(extreme.removalAggressiveness).toBeGreaterThan(aggressive.removalAggressiveness);

    expect(extreme.itemMaxAgeTicks).toBeLessThan(aggressive.itemMaxAgeTicks);
    expect(aggressive.itemMaxAgeTicks).toBeLessThan(balanced.itemMaxAgeTicks);
  });
});

describe("resolveFogThresholds", () => {
  it("increases density reduction with mode aggressiveness", () => {
    expect(resolveFogThresholds("balanced").densityReduction).toBe(0);
    expect(resolveFogThresholds("aggressive").densityReduction).toBeGreaterThan(0);
    expect(resolveFogThresholds("extreme").densityReduction).toBeGreaterThan(
      resolveFogThresholds("aggressive").densityReduction
    );
  });
});

describe("isValidMode", () => {
  it("accepts only the three known modes", () => {
    expect(isValidMode("balanced")).toBe(true);
    expect(isValidMode("aggressive")).toBe(true);
    expect(isValidMode("extreme")).toBe(true);
    expect(isValidMode("ultra")).toBe(false);
    expect(isValidMode("")).toBe(false);
  });
});
