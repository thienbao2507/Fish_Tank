import { describe, expect, it } from 'vitest';
import { TextureKeys } from '../art/keys';
import { SHADOW_PROFILES, shadowProfileOf } from './shadowProfile';

describe('shadowProfileOf', () => {
  it('mỗi loại vật có kiểu bóng riêng', () => {
    expect(shadowProfileOf(TextureKeys.decoBarrelSponge)).toBe(SHADOW_PROFILES.column);
    expect(shadowProfileOf(TextureKeys.decoCoralPink)).toBe(SHADOW_PROFILES.branch);
    expect(shadowProfileOf(TextureKeys.decoTableCoral)).toBe(SHADOW_PROFILES.canopy);
    expect(shadowProfileOf(TextureKeys.decoSeaGrass)).toBe(SHADOW_PROFILES.soft);
  });

  it('vật chưa khai báo được coi là khối thấp', () => {
    expect(shadowProfileOf(TextureKeys.isoRockA)).toBe(SHADOW_PROFILES.mound);
    expect(shadowProfileOf('khong.co')).toBe(SHADOW_PROFILES.mound);
  });

  it('cỏ mềm không có bóng đổ, còn lại có', () => {
    expect(SHADOW_PROFILES.soft.cast).toBe('none');
    expect(SHADOW_PROFILES.column.cast).toBe('oval');
    expect(SHADOW_PROFILES.branch.cast).toBe('silhouette');
  });
});
