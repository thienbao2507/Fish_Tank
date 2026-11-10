import Phaser from 'phaser';
import { GAME_HEIGHT } from '../config';
import type { Settings, VolumeSetting } from '../core/settings';
import { loadSettings, saveSettings } from '../platform/settingsStorage';
import { setContext, type GameContext } from './context';
import { SOUND_ENABLED_KEY, SOUND_VOLUME_KEY } from './audio/SoundDirector';
import { BLOOM_KEY } from './env/bloom';
import { TILT_SHIFT_KEY, VIGNETTE_KEY } from './env/postfx';
import { SURFACE_RIPPLE_KEY } from './env/surfaceRipple';
import { BootScene } from './scenes/BootScene';
import { IsoPrototypeScene } from './scenes/IsoPrototypeScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';
import { PreloadScene } from './scenes/PreloadScene';
import { RoomPrototypeScene } from './scenes/RoomPrototypeScene';
import { UIScene } from './scenes/UIScene';
import { viewWidthFor } from './viewport';

/**
 * Mỗi khi khung hiển thị đổi kích thước, đổi chiều rộng logic theo tỉ lệ màn hình (spec 12.1).
 * setGameSize phát lại sự kiện RESIZE; lần đó chiều rộng đã khớp nên không lặp vô hạn.
 */
function keepWidthMatchingScreen(game: Phaser.Game): void {
  const scale = game.scale;
  scale.on(Phaser.Scale.Events.RESIZE, () => {
    const width = viewWidthFor(scale.parentSize.width, scale.parentSize.height);
    if (width !== scale.gameSize.width) {
      scale.setGameSize(width, GAME_HEIGHT);
    }
  });
}

const EFFECT_KEYS = new Set<string>([
  BLOOM_KEY,
  TILT_SHIFT_KEY,
  VIGNETTE_KEY,
  SURFACE_RIPPLE_KEY,
  SOUND_ENABLED_KEY,
  SOUND_VOLUME_KEY,
]);

function registryVolume(game: Phaser.Game): VolumeSetting {
  const value: unknown = game.registry.get(SOUND_VOLUME_KEY);
  return value === 'low' || value === 'high' ? value : 'mid';
}

function registrySettings(game: Phaser.Game): Settings {
  return {
    bloom: game.registry.get(BLOOM_KEY) !== false,
    tiltShift: game.registry.get(TILT_SHIFT_KEY) !== false,
    vignette: game.registry.get(VIGNETTE_KEY) !== false,
    surfaceRipple: game.registry.get(SURFACE_RIPPLE_KEY) !== false,
    sound: game.registry.get(SOUND_ENABLED_KEY) !== false,
    volume: registryVolume(game),
  };
}

/** Áp cài đặt trước khi scene đầu tiên tạo filter và lưu lại mọi thay đổi từ UI/debug. */
function setupSettings(game: Phaser.Game, settings: Settings): void {
  game.registry.set(BLOOM_KEY, settings.bloom);
  game.registry.set(TILT_SHIFT_KEY, settings.tiltShift);
  game.registry.set(VIGNETTE_KEY, settings.vignette);
  game.registry.set(SURFACE_RIPPLE_KEY, settings.surfaceRipple);
  game.registry.set(SOUND_ENABLED_KEY, settings.sound);
  game.registry.set(SOUND_VOLUME_KEY, settings.volume);
  game.registry.events.on(Phaser.Data.Events.CHANGE_DATA, (_parent: unknown, key: string) => {
    if (EFFECT_KEYS.has(key)) saveSettings(registrySettings(game));
  });
}

export function createGame(ctx: GameContext): Phaser.Game {
  const settings = loadSettings();
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: viewWidthFor(window.innerWidth, window.innerHeight),
    height: GAME_HEIGHT,
    backgroundColor: '#000000',
    // Nearest-neighbor, tắt khử răng cưa, làm tròn toạ độ pixel.
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: true,
    },
    // Joystick (tay trái) và nút (tay phải) cùng lúc.
    input: { activePointers: 3 },
    callbacks: {
      // Gắn context trước khi scene nào chạy.
      preBoot: (game) => {
        setContext(game, ctx);
        setupSettings(game, settings);
      },
      postBoot: keepWidthMatchingScreen,
    },
    // Thứ tự trong mảng = thứ tự vẽ: UI nằm trên Game.
    scene: [
      BootScene,
      PreloadScene,
      IsoPrototypeScene,
      UIScene,
      RoomPrototypeScene,
      MenuScene,
      PauseScene,
    ],
  });
}
