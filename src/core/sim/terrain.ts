import type { ZoneDef } from '../content/schemas';

/** Trả về tọa độ y của mặt đáy tại x, với độ nhô được nội suy cosine. */
export function floorAt(zone: ZoneDef, x: number): number {
  const terrain = zone.terrain;
  if (!terrain || terrain.length === 0) return zone.floorY;

  const first = terrain[0] as [number, number];
  if (x <= first[0]) return zone.floorY - first[1];

  for (let i = 1; i < terrain.length; i++) {
    const previous = terrain[i - 1] as [number, number];
    const current = terrain[i] as [number, number];
    if (x > current[0]) continue;

    const progress = (x - previous[0]) / (current[0] - previous[0]);
    const smoothProgress = (1 - Math.cos(Math.PI * progress)) / 2;
    const rise = previous[1] + (current[1] - previous[1]) * smoothProgress;
    return zone.floorY - rise;
  }

  const last = terrain[terrain.length - 1] as [number, number];
  return zone.floorY - last[1];
}

/** Mặt đáy cao nhất (y nhỏ nhất) dưới toàn bộ chiều rộng của một vật. */
export function floorUnder(zone: ZoneDef, x: number, halfWidth: number): number {
  const left = x - halfWidth;
  const right = x + halfWidth;
  let highest = floorAt(zone, left);

  for (let sampleX = left + 2; sampleX < right; sampleX += 2) {
    highest = Math.min(highest, floorAt(zone, sampleX));
  }
  return Math.min(highest, floorAt(zone, right));
}
