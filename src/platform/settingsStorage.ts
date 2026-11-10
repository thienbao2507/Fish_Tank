import {
  DEFAULT_SETTINGS,
  parseSettings,
  serializeSettings,
  type Settings,
} from '../core/settings';

export const SETTINGS_STORAGE_KEY = 'fishtank.settings';

/** Trình duyệt chặn storage (hoặc môi trường không có storage) thì game vẫn dùng mặc định. */
export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Lỗi quota / quyền riêng tư không được làm gián đoạn game. */
export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, serializeSettings(settings));
  } catch {
    // Không có storage hoặc không thể ghi: giữ cài đặt trong registry cho phiên hiện tại.
  }
}
