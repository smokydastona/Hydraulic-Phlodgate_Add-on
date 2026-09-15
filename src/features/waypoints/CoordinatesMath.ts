export interface CoordinateSnapshot {
  x: number;
  y: number;
  z: number;
  dimensionId: string;
}

export function formatCoordinateSnapshot(snapshot: CoordinateSnapshot): string {
  const dimension = snapshot.dimensionId.replace("minecraft:", "");
  return `§bXYZ §f${Math.floor(snapshot.x)}, ${Math.floor(snapshot.y)}, ${Math.floor(snapshot.z)} §7(${dimension})`;
}