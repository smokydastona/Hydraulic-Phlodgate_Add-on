/**
 * Machine & Container Inspector for Modded and Vanilla Blocks.
 *
 * Pure, deterministic data structures and formatting logic (unit-tested).
 */
import { extractNamespace, isModdedNamespace } from "./CompanionDetector";

export interface MachineSlotInfo {
  slotIndex: number;
  typeId: string;
  count: number;
  nameTag?: string;
}

export interface MachineInspectionData {
  blockTypeId: string;
  location: { x: number; y: number; z: number; dimensionId: string };
  isModded: boolean;
  namespace: string;
  customName?: string;
  totalSlots: number;
  occupiedSlots: number;
  slots: MachineSlotInfo[];
  summaryText: string;
}

export function createInspectionSnapshot(input: {
  blockTypeId: string;
  location: { x: number; y: number; z: number; dimensionId: string };
  slots: MachineSlotInfo[];
  customName?: string;
}): MachineInspectionData {
  const ns = extractNamespace(input.blockTypeId);
  const isModded = isModdedNamespace(ns);
  const totalSlots = input.slots.length;
  const occupiedSlots = input.slots.filter((s) => s.count > 0).length;

  const summary = formatInspectionSummary({
    blockTypeId: input.blockTypeId,
    location: input.location,
    isModded,
    namespace: ns,
    customName: input.customName,
    totalSlots,
    occupiedSlots,
    slots: input.slots,
  });

  return {
    blockTypeId: input.blockTypeId,
    location: input.location,
    isModded,
    namespace: ns,
    customName: input.customName,
    totalSlots,
    occupiedSlots,
    slots: input.slots,
    summaryText: summary,
  };
}

export function formatInspectionSummary(data: Omit<MachineInspectionData, "summaryText">): string {
  const lines: string[] = [];
  lines.push(`=== Block Inspection ===`);
  lines.push(`Block Type: ${data.blockTypeId}`);
  lines.push(`Namespace: ${data.namespace}${data.isModded ? " (Modded)" : " (Vanilla)"}`);
  if (data.customName) {
    lines.push(`Custom Name: ${data.customName}`);
  }
  lines.push(
    `Coordinates: X=${Math.floor(data.location.x)} Y=${Math.floor(data.location.y)} Z=${Math.floor(data.location.z)} (${data.location.dimensionId})`
  );

  if (data.totalSlots > 0) {
    lines.push(`Container Slots: ${data.occupiedSlots}/${data.totalSlots} occupied`);
    const occupied = data.slots.filter((s) => s.count > 0);
    if (occupied.length === 0) {
      lines.push("Status: Container is empty");
    } else {
      lines.push("Contents:");
      for (const slot of occupied.slice(0, 16)) {
        const namePart = slot.nameTag ? ` ("${slot.nameTag}")` : "";
        lines.push(`  - Slot [${slot.slotIndex}]: ${slot.count}x ${slot.typeId}${namePart}`);
      }
      if (occupied.length > 16) {
        lines.push(`  ... and ${occupied.length - 16} more occupied slot(s)`);
      }
    }
  } else {
    lines.push("Container: No inventory container component found");
  }

  return lines.join("\n");
}
