export interface MergeItemSnapshot {
  id: string;
  typeId: string;
  count: number;
  x: number;
  y: number;
  z: number;
}

export interface MergeGroup {
  typeId: string;
  anchorId: string;
  consumedIds: string[];
  totalCount: number;
  x: number;
  y: number;
  z: number;
}

function distanceSquared(a: MergeItemSnapshot, b: MergeItemSnapshot): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function bucketKey(typeId: string, x: number, y: number, z: number, cellSize: number): string {
  return `${typeId}:${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}:${Math.floor(z / cellSize)}`;
}

/** Plans capped merges using neighboring spatial buckets instead of comparing every pair. */
export function planItemMerges(items: readonly MergeItemSnapshot[], radius: number, cap: number): MergeGroup[] {
  if (radius <= 0 || cap <= 0) return [];

  const buckets = new Map<string, MergeItemSnapshot[]>();
  for (const item of items) {
    if (item.count <= 0) continue;
    const key = bucketKey(item.typeId, item.x, item.y, item.z, radius);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const consumed = new Set<string>();
  const groups: MergeGroup[] = [];
  const radiusSquared = radius * radius;

  for (const anchor of items) {
    if (consumed.has(anchor.id) || anchor.count <= 0) continue;
    let totalCount = anchor.count;
    const consumedIds: string[] = [];
    const cellX = Math.floor(anchor.x / radius);
    const cellY = Math.floor(anchor.y / radius);
    const cellZ = Math.floor(anchor.z / radius);

    for (let dx = -1; dx <= 1 && totalCount < cap; dx++) {
      for (let dy = -1; dy <= 1 && totalCount < cap; dy++) {
        for (let dz = -1; dz <= 1 && totalCount < cap; dz++) {
          const candidates = buckets.get(`${anchor.typeId}:${cellX + dx}:${cellY + dy}:${cellZ + dz}`) ?? [];
          for (const candidate of candidates) {
            if (candidate.id === anchor.id || consumed.has(candidate.id) || candidate.typeId !== anchor.typeId) continue;
            if (distanceSquared(anchor, candidate) > radiusSquared) continue;
            if (totalCount + candidate.count > cap) continue;
            consumed.add(candidate.id);
            consumedIds.push(candidate.id);
            totalCount += candidate.count;
            if (totalCount >= cap) break;
          }
        }
      }
    }

    if (consumedIds.length > 0) {
      consumed.add(anchor.id);
      groups.push({ typeId: anchor.typeId, anchorId: anchor.id, consumedIds, totalCount, x: anchor.x, y: anchor.y, z: anchor.z });
    }
  }

  return groups;
}