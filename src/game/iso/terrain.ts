import type { Plateau } from './scenePlan';

function contains(plateau: Plateau, x: number, z: number): boolean {
  return Math.abs(x - plateau.x) <= plateau.w / 2 && Math.abs(z - plateau.z) <= plateau.d / 2;
}

/** Trả độ cao mặt cao nguyên chứa điểm, kể cả các điểm nằm đúng trên mép. */
export function heightAt(plateaus: readonly Plateau[], x: number, z: number): number {
  return plateaus.find((plateau) => contains(plateau, x, z))?.height ?? 0;
}

/** Đưa vật trên cao nguyên lên ngay trước vách của chính cao nguyên đó khi xếp độ sâu. */
export function sortZ(plateaus: readonly Plateau[], x: number, z: number): number {
  const plateau = plateaus.find((candidate) => contains(candidate, x, z));
  return plateau ? plateau.z - plateau.d / 2 - 1 : z;
}

export interface AltitudeShadow {
  readonly alpha: number;
  readonly scale: number;
}

const CLEARANCE_NEAR = 8;
const CLEARANCE_FAR = 140;

/** Bóng của vật đang lơ lửng: sát mặt thì nhỏ và đậm, càng cao càng lớn và mờ. */
export function altitudeShadow(clearance: number): AltitudeShadow {
  const raw = (clearance - CLEARANCE_NEAR) / (CLEARANCE_FAR - CLEARANCE_NEAR);
  const t = Math.max(0, Math.min(1, raw));
  return { alpha: 0.72 + (0.22 - 0.72) * t, scale: 0.8 + (1.9 - 0.8) * t };
}
