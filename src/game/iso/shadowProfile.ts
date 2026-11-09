import { TextureKeys } from '../art/keys';

/** Hình dáng chân và thân vật quyết định kiểu bóng. */
export type ShadowKind = 'column' | 'mound' | 'branch' | 'canopy' | 'soft';

export interface ShadowProfile {
  /** Bóng tiếp xúc: rộng = chân × footScale; cao = rộng × heightRatio, không quá maxHeight (px). */
  readonly footScale: number;
  readonly heightRatio: number;
  readonly maxHeight: number;
  /** Bóng đổ: `oval` mềm, `silhouette` theo hình vật, `none` không có. */
  readonly cast: 'oval' | 'silhouette' | 'none';
  /** Chiều dài bóng đổ so với chiều cao vật. */
  readonly castLength: number;
  readonly castAlpha: number;
}

export const SHADOW_PROFILES: Readonly<Record<ShadowKind, ShadowProfile>> = {
  // Thùng, bọt biển, cột: đáy đặc nên bóng tiếp xúc ôm khít, bóng đổ dài.
  column: {
    footScale: 1.25,
    heightRatio: 0.5,
    maxHeight: 14,
    cast: 'oval',
    castLength: 0.7,
    castAlpha: 0.3,
  },
  // Đá, san hô não, trai: chân rộng và thấp, bóng tiếp xúc dẹt, bóng đổ ngắn.
  mound: {
    footScale: 1.15,
    heightRatio: 0.38,
    maxHeight: 12,
    cast: 'oval',
    castLength: 0.55,
    castAlpha: 0.26,
  },
  // San hô nhánh, quạt, tảo: chỉ gốc chạm đất; bóng đổ theo hình để có khe giữa các nhánh.
  branch: {
    footScale: 1.7,
    heightRatio: 0.45,
    maxHeight: 8,
    cast: 'silhouette',
    castLength: 0.5,
    castAlpha: 0.2,
  },
  // San hô bàn, nấm: chân nhỏ, tán rộng che sáng.
  canopy: {
    footScale: 1.5,
    heightRatio: 0.45,
    maxHeight: 9,
    cast: 'oval',
    castLength: 0.6,
    castAlpha: 0.24,
  },
  // Cỏ, rau biển: mềm và thấp, chỉ cần bóng tiếp xúc.
  soft: {
    footScale: 1.05,
    heightRatio: 0.36,
    maxHeight: 9,
    cast: 'none',
    castLength: 0,
    castAlpha: 0,
  },
};

const KIND_BY_KEY: Readonly<Record<string, ShadowKind>> = {
  [TextureKeys.decoTubeSponge]: 'column',
  [TextureKeys.decoBarrelSponge]: 'column',
  [TextureKeys.decoVaseSponge]: 'column',
  [TextureKeys.decoPillarCoral]: 'column',
  [TextureKeys.decoCoralPurple]: 'branch',
  [TextureKeys.decoCoralPink]: 'branch',
  [TextureKeys.decoCoralOrange]: 'branch',
  [TextureKeys.decoSeaFan]: 'branch',
  [TextureKeys.decoElkhorn]: 'branch',
  [TextureKeys.decoGoldKelpA]: 'branch',
  [TextureKeys.decoGoldKelpB]: 'branch',
  [TextureKeys.decoSeaWhip]: 'branch',
  [TextureKeys.decoGlowCoral]: 'branch',
  [TextureKeys.decoTableCoral]: 'canopy',
  [TextureKeys.decoMushroomCoral]: 'canopy',
  [TextureKeys.decoSeaGrass]: 'soft',
  [TextureKeys.decoSeaLettuce]: 'soft',
  [TextureKeys.decoCaulerpa]: 'soft',
};

/** Kiểu bóng theo texture; vật chưa khai báo (đá, gò san hô, đền…) coi là khối thấp. */
export function shadowProfileOf(key: string): ShadowProfile {
  return SHADOW_PROFILES[KIND_BY_KEY[key] ?? 'mound'];
}
