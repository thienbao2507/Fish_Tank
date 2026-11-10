import Phaser from 'phaser';
import type { SoundCatalog, SoundCue } from '../../core/content/schemas';
import type { EventBus, GameEvents } from '../../core/events';
import { VOLUME_MULTIPLIER, type VolumeSetting } from '../../core/settings';
import type { World } from '../../core/world';

export const SOUND_ENABLED_KEY = 'settings.sound';
export const SOUND_VOLUME_KEY = 'settings.volume';

const REGISTRY_KEY = 'soundDirector';
const ASSET_PREFIX = 'sfx.';
const AMBIENCE_FADE_MS = 220;
const DEBUG_LOG_LIMIT = 100;

export type SoundArea = 'room' | 'tank' | null;
export type SoundPauseReason = 'pause' | 'pc' | 'inventory';

interface SoundDirectorContext {
  readonly sounds: SoundCatalog;
  readonly bus: EventBus<GameEvents>;
  readonly world: World;
}

interface FadeState {
  readonly from: number;
  readonly to: number;
  readonly removeAfter: boolean;
  elapsed: number;
}

interface LoopTrack {
  readonly cue: SoundCue;
  readonly sound: Phaser.Sound.BaseSound;
  gain: number;
  fade?: FadeState;
}

type AdjustableSound = Phaser.Sound.BaseSound & {
  setVolume?: (volume: number) => unknown;
};

declare global {
  interface Window {
    fishtankSound?: { log: string[] };
  }
}

function assetKey(cue: SoundCue): string {
  return `${ASSET_PREFIX}${cue}`;
}

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

function setVolume(sound: Phaser.Sound.BaseSound, volume: number): void {
  const adjustable = sound as AdjustableSound;
  adjustable.setVolume?.(Phaser.Math.Clamp(volume, 0, 1));
}

/** Xếp toàn bộ manifest âm thanh vào loader dùng chung của PreloadScene. */
export function queueSoundAssets(loader: Phaser.Loader.LoaderPlugin, sounds: SoundCatalog): void {
  for (const cue of Object.keys(sounds) as SoundCue[]) {
    loader.audio(assetKey(cue), sounds[cue].file);
  }
}

/** Một bộ điều phối duy nhất quản lý SFX, ambience và các loop xuyên suốt mọi scene. */
export class SoundDirector {
  private readonly game: Phaser.Game;
  private readonly sounds: SoundCatalog;
  private readonly bus: EventBus<GameEvents>;
  private readonly world: World;
  private readonly loopTracks = new Set<LoopTrack>();
  private readonly suspendedBy = new Set<SoundPauseReason>();
  private readonly lastPlayedAt = new Map<SoundCue, number>();
  private readonly removeBusListeners: Array<() => void> = [];
  private readonly debug: boolean;
  private area: SoundArea = null;
  private ambience?: LoopTrack;
  private vacuum?: LoopTrack;

  constructor(game: Phaser.Game, context: SoundDirectorContext) {
    this.game = game;
    this.sounds = context.sounds;
    this.bus = context.bus;
    this.world = context.world;
    this.debug =
      typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
    if (this.debug) window.fishtankSound ??= { log: [] };

    this.bindGameEvents();
    this.bindWorldEvents();
  }

  /** Phát một cue một lần, có kiểm tra bật tiếng, âm lượng tổng và cooldown. */
  play(cue: SoundCue): boolean {
    if (!this.enabled) return false;
    const definition = this.sounds[cue];
    const current = nowMs();
    const previous = this.lastPlayedAt.get(cue) ?? Number.NEGATIVE_INFINITY;
    if (current - previous < definition.cooldownMs) return false;

    const played = this.game.sound.play(assetKey(cue), {
      loop: definition.loop,
      volume: definition.volume * this.volumeMultiplier,
    });
    if (played) {
      this.lastPlayedAt.set(cue, current);
      this.log(cue);
    }
    return played;
  }

  /** Đổi ambience theo khu chơi; màn tiêu đề truyền null để không phát âm nền. */
  setArea(area: SoundArea): void {
    if (this.area === area) return;
    this.area = area;
    const previous = this.ambience;
    this.ambience = undefined;
    if (previous) {
      if (this.canPlayLoops) this.fade(previous, 0, true);
      else this.removeTrack(previous);
    }

    const cue = area === 'tank' ? 'ambTank' : area === 'room' ? 'ambRoom' : undefined;
    if (cue) {
      const next = this.createTrack(cue, this.canPlayLoops ? 0 : 1);
      this.ambience = next;
      if (this.canPlayLoops) this.fade(next, 1, false);
    }
    this.syncVacuum();
    this.syncLoopPlayback();
  }

  /** Chỉ tạm dừng vacuum và ambience; one-shot như click vẫn phát được. */
  suspend(reason: SoundPauseReason): void {
    this.suspendedBy.add(reason);
    this.syncLoopPlayback();
  }

  resume(reason: SoundPauseReason): void {
    this.suspendedBy.delete(reason);
    this.syncVacuum();
    this.syncLoopPlayback();
  }

  private get enabled(): boolean {
    return this.game.registry.get(SOUND_ENABLED_KEY) !== false;
  }

  private get volumeMultiplier(): number {
    const value: unknown = this.game.registry.get(SOUND_VOLUME_KEY);
    const level: VolumeSetting = value === 'low' || value === 'high' ? value : 'mid';
    return VOLUME_MULTIPLIER[level];
  }

  private get canPlayLoops(): boolean {
    return this.enabled && this.suspendedBy.size === 0;
  }

  private bindGameEvents(): void {
    this.game.events.on(Phaser.Core.Events.STEP, this.onStep);
    this.game.registry.events.on(Phaser.Data.Events.CHANGE_DATA, this.onRegistryChange);
    this.game.events.once(Phaser.Core.Events.DESTROY, this.destroy, this);
  }

  private bindWorldEvents(): void {
    this.removeBusListeners.push(
      this.bus.on('drop:collected', ({ currency }) => {
        this.play(currency === 'pearls' ? 'pearl' : 'coin');
      }),
      this.bus.on('station:sold', () => this.play('sell')),
      this.bus.on('fish:healed', () => this.play('heal')),
      this.bus.on('fish:left', () => this.play('fishLeft')),
      this.bus.on('toast', ({ key }) => {
        if (key === 'toast.fishSick') {
          this.play('fishSick');
          return;
        }
        if (
          key === 'toast.batteryEmpty' ||
          key === 'toast.noBattery' ||
          key === 'toast.cargoFull' ||
          key === 'toast.notEnoughCoins' ||
          key === 'toast.zoneFull'
        ) {
          this.play('warn');
        }
      }),
    );
  }

  private readonly onStep = (_time: number, delta: number): void => {
    this.syncVacuum();
    if (!this.canPlayLoops) {
      this.pauseLoops();
      return;
    }

    for (const track of this.loopTracks) this.ensureTrackPlaying(track);
    const elapsed = Math.min(Math.max(delta, 0), 100);
    for (const track of [...this.loopTracks]) {
      const fade = track.fade;
      if (!fade) continue;
      fade.elapsed += elapsed;
      const progress = Phaser.Math.Clamp(fade.elapsed / AMBIENCE_FADE_MS, 0, 1);
      track.gain = Phaser.Math.Linear(fade.from, fade.to, progress);
      this.applyTrackVolume(track);
      if (progress < 1) continue;
      track.fade = undefined;
      if (fade.removeAfter) this.removeTrack(track);
    }
  };

  private readonly onRegistryChange = (_parent: unknown, key: string): void => {
    if (key !== SOUND_ENABLED_KEY && key !== SOUND_VOLUME_KEY) return;
    for (const track of this.loopTracks) this.applyTrackVolume(track);
    this.syncLoopPlayback();
  };

  private createTrack(cue: SoundCue, gain: number): LoopTrack {
    const definition = this.sounds[cue];
    const sound = this.game.sound.add(assetKey(cue), {
      loop: true,
      volume: definition.volume * this.volumeMultiplier * gain,
    });
    const track = { cue, sound, gain };
    this.loopTracks.add(track);
    if (this.canPlayLoops) this.ensureTrackPlaying(track);
    return track;
  }

  private fade(track: LoopTrack, to: number, removeAfter: boolean): void {
    track.fade = { from: track.gain, to, removeAfter, elapsed: 0 };
  }

  private syncVacuum(): void {
    const shouldRun = this.area === 'tank' && this.world.robot.vacuumOn;
    if (shouldRun && !this.vacuum) this.vacuum = this.createTrack('vacuum', 1);
    if (!shouldRun && this.vacuum) {
      this.removeTrack(this.vacuum);
      this.vacuum = undefined;
    }
  }

  private syncLoopPlayback(): void {
    if (!this.canPlayLoops) {
      this.pauseLoops();
      return;
    }
    for (const track of this.loopTracks) this.ensureTrackPlaying(track);
  }

  private pauseLoops(): void {
    for (const track of this.loopTracks) {
      if (track.sound.isPlaying) track.sound.pause();
    }
  }

  private ensureTrackPlaying(track: LoopTrack): void {
    this.applyTrackVolume(track);
    if (track.sound.isPaused) {
      track.sound.resume();
      return;
    }
    if (track.sound.isPlaying) return;
    if (track.sound.play({ loop: true })) this.log(track.cue);
  }

  private applyTrackVolume(track: LoopTrack): void {
    const definition = this.sounds[track.cue];
    setVolume(track.sound, definition.volume * this.volumeMultiplier * track.gain);
  }

  private removeTrack(track: LoopTrack): void {
    if (!this.loopTracks.delete(track)) return;
    track.sound.stop();
    this.game.sound.remove(track.sound);
  }

  private log(cue: SoundCue): void {
    if (!this.debug || typeof window === 'undefined') return;
    const state = (window.fishtankSound ??= { log: [] });
    state.log.push(cue);
    if (state.log.length > DEBUG_LOG_LIMIT) {
      state.log.splice(0, state.log.length - DEBUG_LOG_LIMIT);
    }
  }

  private destroy(): void {
    this.game.events.off(Phaser.Core.Events.STEP, this.onStep);
    this.game.registry.events.off(Phaser.Data.Events.CHANGE_DATA, this.onRegistryChange);
    for (const remove of this.removeBusListeners) remove();
    for (const track of [...this.loopTracks]) this.removeTrack(track);
  }
}

/** Cài một lần sau preload; các scene còn lại lấy cùng instance từ game.registry. */
export function installSoundDirector(
  scene: Phaser.Scene,
  context: SoundDirectorContext,
): SoundDirector {
  const existing: unknown = scene.registry.get(REGISTRY_KEY);
  if (existing instanceof SoundDirector) return existing;
  const director = new SoundDirector(scene.game, context);
  scene.registry.set(REGISTRY_KEY, director);
  return director;
}

export function getSoundDirector(scene: Phaser.Scene): SoundDirector {
  const director: unknown = scene.registry.get(REGISTRY_KEY);
  if (!(director instanceof SoundDirector)) {
    throw new Error('SoundDirector chưa được khởi tạo trong PreloadScene.');
  }
  return director;
}
