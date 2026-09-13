import { describe, expect, it } from "vitest";
import {
  createInspectionSnapshot,
  formatInspectionSummary,
  MachineSlotInfo,
} from "./MachineInspector";

describe("MachineInspector formatting and snapshot logic", () => {
  it("creates an inspection snapshot for a modded container block", () => {
    const slots: MachineSlotInfo[] = [
      { slotIndex: 0, typeId: "minecraft:iron_ingot", count: 16 },
      { slotIndex: 1, typeId: "hydraulic:gear", count: 4 },
      { slotIndex: 2, typeId: "minecraft:air", count: 0 },
    ];

    const snapshot = createInspectionSnapshot({
      blockTypeId: "hydraulic_test_mod:processing_machine",
      location: { x: 100, y: 64, z: -200, dimensionId: "minecraft:overworld" },
      slots,
      customName: "Primary Crusher",
    });

    expect(snapshot.blockTypeId).toBe("hydraulic_test_mod:processing_machine");
    expect(snapshot.isModded).toBe(true);
    expect(snapshot.namespace).toBe("hydraulic_test_mod");
    expect(snapshot.totalSlots).toBe(3);
    expect(snapshot.occupiedSlots).toBe(2);
    expect(snapshot.summaryText).toContain("Block Type: hydraulic_test_mod:processing_machine");
    expect(snapshot.summaryText).toContain("Namespace: hydraulic_test_mod (Modded)");
    expect(snapshot.summaryText).toContain("Custom Name: Primary Crusher");
    expect(snapshot.summaryText).toContain("Container Slots: 2/3 occupied");
    expect(snapshot.summaryText).toContain("Slot [0]: 16x minecraft:iron_ingot");
    expect(snapshot.summaryText).toContain("Slot [1]: 4x hydraulic:gear");
  });

  it("handles non-container blocks gracefully", () => {
    const snapshot = createInspectionSnapshot({
      blockTypeId: "minecraft:stone",
      location: { x: 0, y: 10, z: 0, dimensionId: "minecraft:overworld" },
      slots: [],
    });

    expect(snapshot.isModded).toBe(false);
    expect(snapshot.totalSlots).toBe(0);
    expect(snapshot.occupiedSlots).toBe(0);
    expect(snapshot.summaryText).toContain("Container: No inventory container component found");
  });

  it("handles empty containers cleanly", () => {
    const slots: MachineSlotInfo[] = [
      { slotIndex: 0, typeId: "minecraft:air", count: 0 },
      { slotIndex: 1, typeId: "minecraft:air", count: 0 },
    ];
    const snapshot = createInspectionSnapshot({
      blockTypeId: "minecraft:chest",
      location: { x: 12, y: 65, z: 42, dimensionId: "minecraft:overworld" },
      slots,
    });

    expect(snapshot.occupiedSlots).toBe(0);
    expect(snapshot.summaryText).toContain("Status: Container is empty");
  });

  it("formats standalone inspection summaries", () => {
    const summary = formatInspectionSummary({
      blockTypeId: "minecraft:barrel",
      location: { x: 5, y: 70, z: 15, dimensionId: "minecraft:overworld" },
      isModded: false,
      namespace: "minecraft",
      totalSlots: 27,
      occupiedSlots: 1,
      slots: [{ slotIndex: 0, typeId: "minecraft:apple", count: 5 }],
    });
    expect(summary).toContain("Block Type: minecraft:barrel");
    expect(summary).toContain("Namespace: minecraft (Vanilla)");
    expect(summary).toContain("Slot [0]: 5x minecraft:apple");
  });
});
