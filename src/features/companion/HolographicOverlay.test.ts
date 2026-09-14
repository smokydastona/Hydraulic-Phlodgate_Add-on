import { describe, expect, it } from "vitest";
import {
  createHolographicDisplayTag,
  HolographicOverlayManager,
} from "./HolographicOverlay";
import { createInspectionSnapshot } from "./MachineInspector";

describe("HolographicOverlay in-world floating tag engine", () => {
  it("creates a formatted holographic display tag from inspection snapshot", () => {
    const snapshot = createInspectionSnapshot({
      blockTypeId: "hydraulic_test_mod:processing_machine",
      location: { x: 10, y: 64, z: 20, dimensionId: "minecraft:overworld" },
      slots: [{ slotIndex: 0, typeId: "minecraft:iron_ore", count: 8 }],
      gauges: [
        { label: "Energy", type: "energy", currentValue: 5000, maxValue: 10000, unit: "FE" },
        { label: "Progress", type: "progress", currentValue: 50, maxValue: 100, unit: "ticks" },
      ],
      customName: "Crusher Alpha",
    });

    const tag = createHolographicDisplayTag(snapshot, 300);

    expect(tag.tagId).toBe("holo_10_64_20");
    expect(tag.displayLocation.x).toBe(10.5);
    expect(tag.displayLocation.y).toBe(65.35); // 64 + 1.35
    expect(tag.displayLocation.z).toBe(20.5);
    expect(tag.renderedText).toContain("[ Crusher Alpha ]");
    expect(tag.renderedText).toContain("Energy:");
    expect(tag.renderedText).toContain("Progress:");
    expect(tag.renderedText).toContain("Slots: §c1/1");
    expect(tag.lifetimeTicks).toBe(300);
  });

  it("HolographicOverlayManager tracks, ticks, and expires tags", () => {
    const manager = new HolographicOverlayManager();

    const snapshot = createInspectionSnapshot({
      blockTypeId: "minecraft:furnace",
      location: { x: 5, y: 70, z: 15, dimensionId: "minecraft:overworld" },
      slots: [],
    });

    const tag = manager.registerOrUpdateTag(snapshot, 2);
    expect(manager.activeTagCount()).toBe(1);
    expect(manager.getTag(tag.tagId)).toBeDefined();

    manager.tick();
    expect(manager.activeTagCount()).toBe(1);

    manager.tick();
    expect(manager.activeTagCount()).toBe(0); // Expired after 2 ticks
  });
});
