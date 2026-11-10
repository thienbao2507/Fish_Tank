import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings, serializeSettings, type Settings } from './settings';

describe('settings', () => {
  it('dùng mặc định khi chưa có dữ liệu', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('dùng mặc định khi JSON hỏng', () => {
    expect(parseSettings('{"bloom":')).toEqual(DEFAULT_SETTINGS);
  });

  it('giữ trường hợp lệ và điền mặc định cho trường bị thiếu', () => {
    expect(parseSettings('{"bloom":false}')).toEqual({
      bloom: false,
      tiltShift: true,
      vignette: true,
    });
  });

  it('điền mặc định cho giá trị sai kiểu nhưng vẫn giữ trường hợp lệ', () => {
    expect(parseSettings('{"bloom":"off","tiltShift":false,"vignette":1}')).toEqual({
      bloom: true,
      tiltShift: false,
      vignette: true,
    });
  });

  it('serialize rồi parse lại không đổi cài đặt', () => {
    const settings: Settings = { bloom: false, tiltShift: true, vignette: false };
    expect(parseSettings(serializeSettings(settings))).toEqual(settings);
  });
});
