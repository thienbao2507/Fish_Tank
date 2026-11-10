import Phaser from 'phaser';
import type { MusicCatalog } from '../../core/content/schemas';
import { VOLUME_MULTIPLIER, type VolumeSetting } from '../../core/settings';
import { SOUND_ENABLED_KEY, SOUND_VOLUME_KEY } from './SoundDirector';
import { nextTrackIndex } from './musicOrder';

export const MUSIC_ENABLED_KEY = 'settings.music';

const REGISTRY_KEY = 'musicPlayer';
const TICK_MS = 100;

/**
 * Nhạc nền phát bằng HTMLAudioElement (stream, không giải mã cả bài vào RAM).
 * Một instance cho cả game nên đổi cảnh không phát lại từ đầu.
 */
export class MusicPlayer {
  private readonly game: Phaser.Game;
  private readonly music: MusicCatalog;
  private audio?: HTMLAudioElement;
  private index = 0;
  private started = false;
  private waitingForGesture = false;
  private hiddenPaused = false;
  private consecutiveErrors = 0;
  private timer?: number;

  constructor(game: Phaser.Game, music: MusicCatalog) {
    this.game = game;
    this.music = music;
    game.registry.events.on(Phaser.Data.Events.CHANGE_DATA, this.onRegistryChange, this);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Bắt đầu phát bài đầu tiên; gọi nhiều lần không phát lại. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.timer = window.setInterval(() => this.applyVolume(), TICK_MS);
    this.load(0);
  }

  destroy(): void {
    this.game.registry.events.off(Phaser.Data.Events.CHANGE_DATA, this.onRegistryChange, this);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.removeGestureListeners();
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.discard();
  }

  private baseVolume(): number {
    const registry = this.game.registry;
    if (registry.get(SOUND_ENABLED_KEY) === false) return 0;
    if (registry.get(MUSIC_ENABLED_KEY) === false) return 0;
    const level: unknown = registry.get(SOUND_VOLUME_KEY);
    const setting: VolumeSetting = level === 'low' || level === 'high' ? level : 'mid';
    return this.music.volume * VOLUME_MULTIPLIER[setting];
  }

  /** Đường bao fade vào đầu bài và ra cuối bài. */
  private envelope(audio: HTMLAudioElement): number {
    const fade = this.music.fadeSeconds;
    if (fade <= 0) return 1;
    let gain = Math.min(1, audio.currentTime / fade);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      gain = Math.min(gain, Math.max(0, (audio.duration - audio.currentTime) / fade));
    }
    return gain;
  }

  private applyVolume(): void {
    const audio = this.audio;
    if (!audio) return;
    audio.volume = Phaser.Math.Clamp(this.baseVolume() * this.envelope(audio), 0, 1);
  }

  private load(index: number): void {
    this.discard();
    this.index = index;
    const track = this.music.tracks[index];
    if (!track) return;
    const audio = new Audio(track.file);
    audio.preload = 'auto';
    audio.volume = 0;
    audio.addEventListener('ended', this.onEnded);
    audio.addEventListener('error', this.onError);
    this.audio = audio;
    if (!this.hiddenPaused) this.tryPlay();
  }

  private discard(): void {
    const audio = this.audio;
    if (!audio) return;
    audio.removeEventListener('ended', this.onEnded);
    audio.removeEventListener('error', this.onError);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    this.audio = undefined;
  }

  private tryPlay(): void {
    const audio = this.audio;
    if (!audio) return;
    audio.play().then(
      () => {
        this.consecutiveErrors = 0;
      },
      (err: unknown) => {
        if (this.audio !== audio) return;
        if (err instanceof DOMException && err.name === 'NotAllowedError') {
          this.waitForGesture();
        }
        // Lỗi khác (AbortError khi pause/đổi bài): bỏ qua, sự kiện 'error' của audio lo nguồn hỏng.
      },
    );
  }

  private waitForGesture(): void {
    if (this.waitingForGesture) return;
    this.waitingForGesture = true;
    window.addEventListener('pointerdown', this.onGesture);
    window.addEventListener('keydown', this.onGesture);
  }

  private removeGestureListeners(): void {
    this.waitingForGesture = false;
    window.removeEventListener('pointerdown', this.onGesture);
    window.removeEventListener('keydown', this.onGesture);
  }

  private readonly onGesture = (): void => {
    this.removeGestureListeners();
    if (!this.hiddenPaused) this.tryPlay();
  };

  private readonly onEnded = (): void => {
    this.load(nextTrackIndex(this.index, this.music.tracks.length));
  };

  private readonly onError = (): void => {
    this.consecutiveErrors += 1;
    // Mọi bài đều lỗi thì dừng hẳn, không lặp vô hạn.
    if (this.consecutiveErrors >= this.music.tracks.length) {
      this.discard();
      return;
    }
    this.load(nextTrackIndex(this.index, this.music.tracks.length));
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      this.hiddenPaused = true;
      this.audio?.pause();
    } else if (this.hiddenPaused) {
      this.hiddenPaused = false;
      this.tryPlay();
    }
  };

  private onRegistryChange(_parent: unknown, key: string): void {
    if (key === SOUND_ENABLED_KEY || key === SOUND_VOLUME_KEY || key === MUSIC_ENABLED_KEY) {
      this.applyVolume();
    }
  }
}

/** Cài một lần sau preload và bắt đầu phát; gọi lại thì dùng instance cũ. */
export function installMusicPlayer(scene: Phaser.Scene, music: MusicCatalog): MusicPlayer {
  const existing: unknown = scene.registry.get(REGISTRY_KEY);
  if (existing instanceof MusicPlayer) return existing;
  const player = new MusicPlayer(scene.game, music);
  scene.registry.set(REGISTRY_KEY, player);
  player.start();
  return player;
}
