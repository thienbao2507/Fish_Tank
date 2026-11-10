export interface Settings {
  readonly bloom: boolean;
  readonly tiltShift: boolean;
  readonly vignette: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  bloom: true,
  tiltShift: true,
  vignette: true,
};

function booleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Đọc cài đặt từng trường; dữ liệu thiếu hoặc sai kiểu dùng lại giá trị mặc định. */
export function parseSettings(raw: string | null): Settings {
  if (raw === null) return { ...DEFAULT_SETTINGS };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULT_SETTINGS };
    }
    const values = parsed as Record<string, unknown>;
    return {
      bloom: booleanSetting(values.bloom, DEFAULT_SETTINGS.bloom),
      tiltShift: booleanSetting(values.tiltShift, DEFAULT_SETTINGS.tiltShift),
      vignette: booleanSetting(values.vignette, DEFAULT_SETTINGS.vignette),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify({
    bloom: settings.bloom,
    tiltShift: settings.tiltShift,
    vignette: settings.vignette,
  });
}
