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
      surfaceRipple: true,
      sound: true,
      volume: 'mid',
    });
  });

  it('điền mặc định cho giá trị sai kiểu nhưng vẫn giữ trường hợp lệ', () => {
    expect(
      parseSettings(
        '{"bloom":"off","tiltShift":false,"vignette":1,"surfaceRipple":"on"}',
      ),
    ).toEqual({
      bloom: true,
      tiltShift: false,
      vignette: true,
      surfaceRipple: true,
      sound: true,
      volume: 'mid',
    });
  });

  it('serialize rồi parse lại không đổi cài đặt', () => {
    const settings: Settings = {
      bloom: false,
      tiltShift: true,
      vignette: false,
      surfaceRipple: false,
      sound: false,
      volume: 'high',
    };
    expect(parseSettings(serializeSettings(settings))).toEqual(settings);
  });

  it('đọc bản lưu cũ thiếu sound và volume bằng giá trị mặc định', () => {
    expect(parseSettings('{"bloom":false,"tiltShift":false,"vignette":false}')).toMatchObject({
      sound: true,
      volume: 'mid',
    });
  });

  it('dùng mặc định khi sound hoặc volume sai kiểu', () => {
    expect(parseSettings('{"sound":"on","volume":2}')).toMatchObject({
      sound: true,
      volume: 'mid',
    });
  });

  it('giữ sound và volume hợp lệ', () => {
    expect(parseSettings('{"sound":false,"volume":"low"}')).toMatchObject({
      sound: false,
      volume: 'low',
    });
  });
});
