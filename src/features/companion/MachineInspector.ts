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

export type GaugeType = "progress" | "energy" | "fluid" | "heat" | "custom";

export interface MachineGaugeInfo {
  label: string;
  type: GaugeType;
  currentValue: number;
  maxValue: number;
  unit?: string;
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
  gauges: MachineGaugeInfo[];
  summaryText: string;
}

export function createInspectionSnapshot(input: {
  blockTypeId: string;
  location: { x: number; y: number; z: number; dimensionId: string };
  slots: MachineSlotInfo[];
  gauges?: MachineGaugeInfo[];
  customName?: string;
}): MachineInspectionData {
  const ns = extractNamespace(input.blockTypeId);
  const isModded = isModdedNamespace(ns);
  const totalSlots = input.slots.length;
  const occupiedSlots = input.slots.filter((s) => s.count > 0).length;
  const gauges = input.gauges ?? [];

  const summary = formatInspectionSummary({
    blockTypeId: input.blockTypeId,
    location: input.location,
    isModded,
    namespace: ns,
    customName: input.customName,
    totalSlots,
    occupiedSlots,
    slots: input.slots,
    gauges,
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
    gauges,
    summaryText: summary,
  };
}

export function renderGaugeBar(current: number, max: number, length = 10): string {
  if (max <= 0) return "[░░░░░░░░░░] 0%";
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const pct = Math.round(ratio * 100);
  return `[${bar}] ${pct}%`;
}

export interface PaginatedSlotsResult {
  pageSlots: MachineSlotInfo[];
  totalFilteredSlots: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export function filterSlots(slots: MachineSlotInfo[], filterQuery?: string): MachineSlotInfo[] {
  if (!filterQuery || filterQuery.trim().length === 0) {
    return slots;
  }
  const q = filterQuery.trim().toLowerCase();
  return slots.filter((slot) => {
    if (slot.typeId.toLowerCase().includes(q)) return true;
    if (slot.nameTag && slot.nameTag.toLowerCase().includes(q)) return true;
    return false;
  });
}

export function paginateSlots(slots: MachineSlotInfo[], page = 1, pageSize = 18, filterQuery?: string): PaginatedSlotsResult {
  const filtered = filterSlots(slots, filterQuery);
  const size = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.max(1, Math.min(totalPages, page));
  const startIndex = (currentPage - 1) * size;
  const pageSlots = filtered.slice(startIndex, startIndex + size);

  return {
    pageSlots,
    totalFilteredSlots: filtered.length,
    totalPages,
    currentPage,
    pageSize: size,
  };
}

export function formatPaginatedInspectionSummary(
  data: Omit<MachineInspectionData, "summaryText">,
  page = 1,
  pageSize = 18,
  filterQuery?: string
): string {
  const lines: string[] = [];
  lines.push(`=== Block & Machine Inspection ===`);
  lines.push(`Block Type: ${data.blockTypeId}`);
  lines.push(`Namespace: ${data.namespace}${data.isModded ? " (Modded)" : " (Vanilla)"}`);
  if (data.customName) {
    lines.push(`Custom Name: ${data.customName}`);
  }
  lines.push(
    `Coordinates: X=${Math.floor(data.location.x)} Y=${Math.floor(data.location.y)} Z=${Math.floor(data.location.z)} (${data.location.dimensionId})`
  );

  if (data.gauges && data.gauges.length > 0) {
    lines.push("");
    lines.push("Live Gauges & Metrics:");
    for (const gauge of data.gauges) {
      const unitPart = gauge.unit ? ` ${gauge.unit}` : "";
      const bar = renderGaugeBar(gauge.currentValue, gauge.maxValue);
      lines.push(`  • ${gauge.label}: ${bar} (${gauge.currentValue}/${gauge.maxValue}${unitPart})`);
    }
  }

  lines.push("");
  if (data.totalSlots > 0) {
    const occupiedOnly = data.slots.filter((s) => s.count > 0);
    if (occupiedOnly.length === 0) {
      lines.push(`Container Slots: 0/${data.totalSlots} occupied`);
      lines.push("Status: Container is empty");
    } else {
      const pagination = paginateSlots(occupiedOnly, page, pageSize, filterQuery);

      lines.push(`Container Slots: ${data.occupiedSlots}/${data.totalSlots} occupied`);
      if (filterQuery && filterQuery.trim().length > 0) {
        lines.push(`Filter: "${filterQuery.trim()}" (${pagination.totalFilteredSlots} match(es))`);
      }
      lines.push(`Page: ${pagination.currentPage}/${pagination.totalPages} (${pagination.pageSize} slots/page)`);

      if (pagination.pageSlots.length === 0) {
        lines.push("Status: No matching items on this page");
      } else {
        lines.push("Contents:");
        for (const slot of pagination.pageSlots) {
          const namePart = slot.nameTag ? ` ("${slot.nameTag}")` : "";
          lines.push(`  - Slot [${slot.slotIndex}]: ${slot.count}x ${slot.typeId}${namePart}`);
        }
      }
    }
  } else {
    lines.push("Container: No inventory container component found");
  }

  return lines.join("\n");
}

export function formatInspectionSummary(data: Omit<MachineInspectionData, "summaryText">): string {
  return formatPaginatedInspectionSummary(data, 1, 16);
}
