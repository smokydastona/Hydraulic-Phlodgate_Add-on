/**
 * Holographic In-World Machine Overlay Engine (Phase 6 / Companion Extension).
 *
 * Provides floating in-world visual status markers (holographic text entity / display tags)
 * for modded machines, displaying real-time gauge metrics (energy, progress, fluid levels)
 * directly above target block coordinates.
 */
import { MachineInspectionData, renderGaugeBar } from "./MachineInspector";

export interface HolographicDisplayTag {
  tagId: string;
  blockLocation: { x: number; y: number; z: number; dimensionId: string };
  displayLocation: { x: number; y: number; z: number };
  lines: string[];
  renderedText: string;
  lifetimeTicks: number;
}

export function createHolographicDisplayTag(
  inspection: MachineInspectionData,
  lifetimeTicks = 200
): HolographicDisplayTag {
  const lines: string[] = [];

  // Header: Name / Block Type
  const name = inspection.customName || inspection.blockTypeId;
  lines.push(`§e§l[ ${name} ]§r`);

  // Gauges
  if (inspection.gauges && inspection.gauges.length > 0) {
    for (const g of inspection.gauges) {
      const color = g.type === "energy" ? "§6" : g.type === "fluid" ? "§9" : g.type === "heat" ? "§c" : "§a";
      const unit = g.unit ? ` ${g.unit}` : "";
      const bar = renderGaugeBar(g.currentValue, g.maxValue, 8);
      lines.push(`${color}${g.label}: ${bar} (${g.currentValue}/${g.maxValue}${unit})§r`);
    }
  }

  // Inventory Summary
  if (inspection.totalSlots > 0) {
    const statusColor = inspection.occupiedSlots === inspection.totalSlots ? "§c" : inspection.occupiedSlots > 0 ? "§a" : "§7";
    lines.push(`§7Slots: ${statusColor}${inspection.occupiedSlots}/${inspection.totalSlots}§r`);
  }

  const renderedText = lines.join("\n");
  const tagId = `holo_${Math.floor(inspection.location.x)}_${Math.floor(inspection.location.y)}_${Math.floor(inspection.location.z)}`;

  return {
    tagId,
    blockLocation: inspection.location,
    displayLocation: {
      x: inspection.location.x + 0.5,
      y: inspection.location.y + 1.35, // Floating right above the block
      z: inspection.location.z + 0.5,
    },
    lines,
    renderedText,
    lifetimeTicks,
  };
}

export class HolographicOverlayManager {
  private readonly activeTags = new Map<string, HolographicDisplayTag>();

  public registerOrUpdateTag(inspection: MachineInspectionData, lifetimeTicks = 200): HolographicDisplayTag {
    const tag = createHolographicDisplayTag(inspection, lifetimeTicks);
    this.activeTags.set(tag.tagId, tag);
    return tag;
  }

  public getTag(tagId: string): HolographicDisplayTag | undefined {
    return this.activeTags.get(tagId);
  }

  public removeTag(tagId: string): boolean {
    return this.activeTags.delete(tagId);
  }

  public activeTagCount(): number {
    return this.activeTags.size;
  }

  public tick(): void {
    for (const [id, tag] of this.activeTags.entries()) {
      tag.lifetimeTicks--;
      if (tag.lifetimeTicks <= 0) {
        this.activeTags.delete(id);
      }
    }
  }

  public clear(): void {
    this.activeTags.clear();
  }
}
