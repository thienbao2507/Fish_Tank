import { TextureKeys } from '../art/keys';

/** Cao nguyên: chữ nhật trên đáy, tâm (x, z), rộng w, sâu d, cao `height`. Sprite đứng ở mép trước. */
export interface Plateau {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly height: number;
  readonly key: string;
  /** Chiều rộng ảnh (px); sprite được co theo w / texW. */
  readonly texW: number;
}

/** Vùng trống hình chữ nhật: không vật trang trí nào được mọc trong đó. */
export interface Clearing {
  readonly x: number;
  readonly z: number;
  readonly halfW: number;
  readonly halfD: number;
}

export type PaletteName = 'reef' | 'grass' | 'gold' | 'rocks';

/** Một cụm tự đặt: `count` vật rải trong bán kính `radius` quanh (x, z). */
export interface ReefCluster {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly count: number;
  readonly palette: PaletteName;
}

export interface PaletteEntry {
  readonly key: string;
  readonly sway: boolean;
  readonly minScale: number;
  readonly maxScale: number;
}

/** Vật điểm nhấn đặt tay, cỡ cố định. */
export interface HeroProp {
  readonly key: string;
  readonly x: number;
  readonly z: number;
  readonly scale: number;
}

const coral = (key: string, minScale = 0.8, maxScale = 1.5): PaletteEntry => ({
  key,
  sway: false,
  minScale,
  maxScale,
});
const soft = (key: string, minScale = 0.8, maxScale = 1.3): PaletteEntry => ({
  key,
  sway: true,
  minScale,
  maxScale,
});

export const PALETTES: Readonly<Record<PaletteName, readonly PaletteEntry[]>> = {
  reef: [
    coral(TextureKeys.decoCoralPurple),
    coral(TextureKeys.decoCoralPink),
    coral(TextureKeys.decoCoralOrange),
    coral(TextureKeys.decoCoralPink),
    coral(TextureKeys.decoBrainCoral),
    coral(TextureKeys.decoPinkBall),
    coral(TextureKeys.decoTubeSponge),
    coral(TextureKeys.decoTableCoral),
    coral(TextureKeys.decoSeaFan),
    coral(TextureKeys.decoElkhorn),
    coral(TextureKeys.decoEncrustBlue),
    coral(TextureKeys.decoBubbleCoral),
    coral(TextureKeys.decoZoanthids),
    coral(TextureKeys.decoGiantClam, 0.8, 1.1),
    coral(TextureKeys.decoStarfish, 0.8, 1.1),
    soft(TextureKeys.decoSeaGrass),
  ],
  grass: [
    soft(TextureKeys.decoSeaGrass),
    soft(TextureKeys.decoSeaLettuce),
    soft(TextureKeys.decoCaulerpa),
    coral(TextureKeys.decoGlowCoral, 0.8, 1.2),
    coral(TextureKeys.decoAnemone, 0.8, 1.2),
  ],
  gold: [
    soft(TextureKeys.decoGoldKelpA, 0.9, 1.5),
    soft(TextureKeys.decoGoldKelpB, 0.9, 1.5),
    soft(TextureKeys.decoSeaWhip, 0.9, 1.4),
    coral(TextureKeys.decoVaseSponge),
    coral(TextureKeys.decoBarrelSponge),
  ],
  rocks: [
    coral(TextureKeys.isoRockA, 0.7, 1.2),
    coral(TextureKeys.isoRockB, 0.7, 1.3),
    coral(TextureKeys.isoRockC, 0.6, 0.9),
    coral(TextureKeys.decoUrchin, 0.8, 1.1),
    coral(TextureKeys.decoPillarCoral),
  ],
};

/** Chỗ tàu xuất phát nằm ở (512, 512); lối cát chạy thẳng về đền ở phía xa. */
export const PLATEAUS: readonly Plateau[] = [
  { x: 512, z: 870, w: 360, d: 170, height: 100, key: TextureKeys.isoCliffC, texW: 360 },
  { x: 190, z: 640, w: 240, d: 130, height: 70, key: TextureKeys.isoCliffB, texW: 240 },
  { x: 835, z: 655, w: 260, d: 150, height: 84, key: TextureKeys.isoCliffA, texW: 260 },
  { x: 850, z: 290, w: 240, d: 120, height: 110, key: TextureKeys.isoCave, texW: 240 },
  { x: 165, z: 280, w: 200, d: 100, height: 60, key: TextureKeys.isoCliffB, texW: 240 },
  { x: 695, z: 755, w: 120, d: 60, height: 40, key: TextureKeys.isoLedge, texW: 120 },
];

export const CLEARINGS: readonly Clearing[] = [
  { x: 512, z: 640, halfW: 75, halfD: 170 },
  { x: 512, z: 500, halfW: 120, halfD: 85 },
];

export const REEFS: readonly ReefCluster[] = [
  // Chân cao nguyên đền.
  { x: 305, z: 735, radius: 72, count: 34, palette: 'reef' },
  { x: 725, z: 690, radius: 58, count: 28, palette: 'reef' },
  { x: 345, z: 900, radius: 30, count: 10, palette: 'grass' },
  { x: 665, z: 895, radius: 32, count: 12, palette: 'reef' },
  // Cao nguyên trái.
  { x: 135, z: 535, radius: 62, count: 26, palette: 'reef' },
  { x: 290, z: 545, radius: 38, count: 14, palette: 'gold' },
  { x: 190, z: 650, radius: 46, count: 12, palette: 'grass' },
  // Cao nguyên phải.
  { x: 885, z: 540, radius: 70, count: 30, palette: 'reef' },
  { x: 735, z: 560, radius: 34, count: 10, palette: 'rocks' },
  { x: 840, z: 665, radius: 46, count: 14, palette: 'reef' },
  // Hang đá.
  { x: 790, z: 195, radius: 54, count: 20, palette: 'gold' },
  { x: 930, z: 190, radius: 44, count: 16, palette: 'reef' },
  // Phía trước bên trái.
  { x: 165, z: 180, radius: 58, count: 22, palette: 'reef' },
  { x: 300, z: 195, radius: 36, count: 10, palette: 'rocks' },
  // Điểm xuyết giữa cảnh, để phần cát còn thoáng.
  { x: 385, z: 375, radius: 26, count: 8, palette: 'grass' },
  { x: 645, z: 395, radius: 30, count: 10, palette: 'reef' },
  { x: 512, z: 150, radius: 44, count: 14, palette: 'reef' },
];

/** Điểm nhấn: đền trên cao nguyên chính và vài san hô khổng lồ dẫn mắt về đó. */
export const HEROES: readonly HeroProp[] = [
  // Đền đứng cuối lối cát, đủ gần để nằm trọn trong khung hình ngay lúc xuất phát.
  { key: TextureKeys.isoTemple, x: 512, z: 665, scale: 0.82 },
  { key: TextureKeys.decoCoralPink, x: 405, z: 640, scale: 1.6 },
  { key: TextureKeys.decoCoralOrange, x: 620, z: 632, scale: 1.6 },
  { key: TextureKeys.decoSeaFan, x: 250, z: 500, scale: 1.6 },
  { key: TextureKeys.decoElkhorn, x: 770, z: 480, scale: 1.5 },
];
