/** Pure durability calculations, unit-testable without the game runtime. */

export interface DurabilityReading {
  slot: string;
  itemName: string;
  damage: number;
  maxDurability: number;
}

export function percentRemaining(damage: number, maxDurability: number): number {
  if (maxDurability <= 0) return 100;
  const remaining = maxDurability - damage;
  return Math.max(0, Math.min(100, (remaining / maxDurability) * 100));
}

export function isLowDurability(damage: number, maxDurability: number, thresholdPercent: number): boolean {
  return percentRemaining(damage, maxDurability) <= thresholdPercent;
}

export function formatDurabilityLine(reading: DurabilityReading, thresholdPercent: number): string {
  const pct = percentRemaining(reading.damage, reading.maxDurability);
  const rounded = Math.round(pct);
  const color = pct <= thresholdPercent ? "\u00a7c" : pct <= thresholdPercent * 2 ? "\u00a7e" : "\u00a7a";
  return `${color}${reading.slot}: ${reading.itemName} ${rounded}%\u00a7r`;
}

export function sortByLowestFirst(readings: DurabilityReading[]): DurabilityReading[] {
  return [...readings].sort(
    (a, b) => percentRemaining(a.damage, a.maxDurability) - percentRemaining(b.damage, b.maxDurability)
  );
}
