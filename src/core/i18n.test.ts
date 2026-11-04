import { describe, expect, it } from 'vitest';
import { initI18n, t, translate } from './i18n';

describe('translate', () => {
  const strings = { greet: 'Xin chào {name}!', plain: 'Không tham số' };

  it('trả về chuỗi gốc khi không có tham số', () => {
    expect(translate(strings, 'plain')).toBe('Không tham số');
  });

  it('thay tham số vào chỗ {ten}', () => {
    expect(translate(strings, 'greet', { name: 'Robot' })).toBe('Xin chào Robot!');
  });

  it('giữ nguyên {ten} khi thiếu tham số', () => {
    expect(translate(strings, 'greet', {})).toBe('Xin chào {name}!');
  });

  it('trả về chính khoá khi không tìm thấy chuỗi', () => {
    expect(translate(strings, 'missing.key')).toBe('missing.key');
  });
});

describe('t', () => {
  it('đọc từ từ điển đã khởi tạo', () => {
    initI18n({ 'debug.fps': 'FPS: {fps}' });
    expect(t('debug.fps', { fps: 60 })).toBe('FPS: 60');
  });
});
