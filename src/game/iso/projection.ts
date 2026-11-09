/** Góc camera ảo nhìn chéo xuống đáy bể. */
export const PITCH = (33 * Math.PI) / 180;
/** Khoảng cách từ camera ảo tới điểm nhìn trên đáy. */
export const DISTANCE = 600;
/** Tiêu cự bằng khoảng cách để điểm nhìn có tỉ lệ 1. */
export const FOCAL = 600;
/** Độ dài trục y của World, dùng để đổi sang chiều sâu của cảnh chéo. */
export const WORLD_DEPTH = 1024;

/** Đổi y trên mặt phẳng của core sang trục chiều sâu của cảnh chéo. */
export function sceneZFromCoreY(coreY: number): number {
  return WORLD_DEPTH - coreY;
}

/** Độ cao hiển thị của một tầng nước: 0 Đáy, 1 Giữa, 2 Mặt. */
export function tierHeight(z: number): number {
  return 34 + z * 34;
}

export interface GroundPoint {
  readonly x: number;
  readonly z: number;
}

export interface Projection {
  readonly sx: number;
  readonly sy: number;
  readonly scale: number;
  readonly zc: number;
}

export interface GroundRow {
  readonly z: number;
  readonly scale: number;
}

const SIN_PITCH = Math.sin(PITCH);
const COS_PITCH = Math.cos(PITCH);

/** Chiếu một điểm thế giới qua camera phối cảnh thật sang toạ độ màn hình. */
export function project(
  x: number,
  y: number,
  z: number,
  focus: GroundPoint,
  viewW: number,
  viewH: number,
): Projection {
  const dx = x - focus.x;
  const dy = y - DISTANCE * SIN_PITCH;
  const dz = z - (focus.z - DISTANCE * COS_PITCH);
  const xc = dx;
  const yc = dy * COS_PITCH + dz * SIN_PITCH;
  const zc = -dy * SIN_PITCH + dz * COS_PITCH;
  const scale = FOCAL / zc;

  return {
    sx: viewW / 2 + xc * scale,
    sy: viewH / 2 - yc * scale,
    scale,
    zc,
  };
}

/**
 * Đổi một hàng màn hình về z trên mặt đáy. Đây là nghịch đảo giải tích của `project`
 * với y = 0, nên không cần dò từng bước và không tích luỹ sai số giữa các dải.
 */
export function groundRow(sy: number, focus: GroundPoint, viewH: number): GroundRow {
  const slope = (viewH / 2 - sy) / FOCAL;
  const offsetZ = (slope * DISTANCE) / (SIN_PITCH - slope * COS_PITCH);
  const zc = DISTANCE + offsetZ * COS_PITCH;
  return { z: focus.z + offsetZ, scale: FOCAL / zc };
}
