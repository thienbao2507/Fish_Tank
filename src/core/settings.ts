export interface Settings {
  readonly bloom: boolean;
  readonly tiltShift: boolean;
  readonly vignette: boolean;
  readonly surfaceRipple: boolean;
  readonly sound: boolean;
  readonly music: boolean;
  readonly volume: VolumeSetting;
}

export type VolumeSetting = 'low' | 'mid' | 'high';

export const VOLUME_MULTIPLIER: Readonly<Record<VolumeSetting, number>> = {
  low: 0.35,
  mid: 0.65,
  high: 1,
};

export const DEFAULT_SETTINGS: Settings = {
  bloom: true,
  tiltShift: true,
  vignette: true,
  surfaceRipple: true,
  sound: true,
  music: true,
  volume: 'mid',
};

function booleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function volumeSetting(value: unknown): VolumeSetting {
  return value === 'low' || value === 'mid' || value === 'high'
    ? value
    : DEFAULT_SETTINGS.volume;
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
      surfaceRipple: booleanSetting(values.surfaceRipple, DEFAULT_SETTINGS.surfaceRipple),
      sound: booleanSetting(values.sound, DEFAULT_SETTINGS.sound),
      music: booleanSetting(values.music, DEFAULT_SETTINGS.music),
      volume: volumeSetting(values.volume),
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
    surfaceRipple: settings.surfaceRipple,
    sound: settings.sound,
    music: settings.music,
    volume: settings.volume,
  });
}
