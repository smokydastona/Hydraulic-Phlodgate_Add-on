import { describe, expect, it } from "vitest";
import {
  createInspectionSnapshot,
  filterSlots,
  formatInspectionSummary,
  MachineSlotInfo,
  paginateSlots,
} from "./MachineInspector";

describe("MachineInspector formatting and snapshot logic", () => {
  it("creates an inspection snapshot for a modded container block with live gauges", () => {
    const slots: MachineSlotInfo[] = [
      { slotIndex: 0, typeId: "minecraft:iron_ingot", count: 16 },
      { slotIndex: 1, typeId: "hydraulic:gear", count: 4 },
      { slotIndex: 2, typeId: "minecraft:air", count: 0 },
    ];

    const snapshot = createInspectionSnapshot({
      blockTypeId: "hydraulic_test_mod:processing_machine",
      location: { x: 100, y: 64, z: -200, dimensionId: "minecraft:overworld" },
      slots,
      gauges: [
        { label: "Energy Buffer", type: "energy", currentValue: 8000, maxValue: 10000, unit: "FE" },
        { label: "Cook Progress", type: "progress", currentValue: 75, maxValue: 100, unit: "ticks" },
      ],
      customName: "Primary Crusher",
    });

    expect(snapshot.blockTypeId).toBe("hydraulic_test_mod:processing_machine");
    expect(snapshot.isModded).toBe(true);
    expect(snapshot.namespace).toBe("hydraulic_test_mod");
    expect(snapshot.totalSlots).toBe(3);
    expect(snapshot.occupiedSlots).toBe(2);
    expect(snapshot.gauges.length).toBe(2);
    expect(snapshot.summaryText).toContain("Live Gauges & Metrics:");
    expect(snapshot.summaryText).toContain("Energy Buffer: [████████░░] 80% (8000/10000 FE)");
    expect(snapshot.summaryText).toContain("Cook Progress: [████████░░] 75% (75/100 ticks)");
    expect(snapshot.summaryText).toContain("Container Slots: 2/3 occupied");
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
      gauges: [],
    });
    expect(summary).toContain("Block Type: minecraft:barrel");
    expect(summary).toContain("Namespace: minecraft (Vanilla)");
    expect(summary).toContain("Slot [0]: 5x minecraft:apple");
  });

  it("paginates and filters slots in large modded chests", () => {
    const slots: MachineSlotInfo[] = [];
    for (let i = 0; i < 54; i++) {
      slots.push({
        slotIndex: i,
        typeId: i % 2 === 0 ? "minecraft:copper_ingot" : "minecraft:gold_ingot",
        count: i + 1,
      });
    }

    const paginated = paginateSlots(slots, 1, 10);
    expect(paginated.totalFilteredSlots).toBe(54);
    expect(paginated.totalPages).toBe(6);
    expect(paginated.currentPage).toBe(1);
    expect(paginated.pageSlots.length).toBe(10);
    expect(paginated.pageSlots[0].slotIndex).toBe(0);

    const page2 = paginateSlots(slots, 2, 10);
    expect(page2.currentPage).toBe(2);
    expect(page2.pageSlots[0].slotIndex).toBe(10);

    const filtered = filterSlots(slots, "copper");
    expect(filtered.length).toBe(27);
  });
});
