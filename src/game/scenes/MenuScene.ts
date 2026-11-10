import Phaser from 'phaser';
import { createRng, type Rng } from '../../core/rng';
import { t, type StringKey } from '../../core/i18n';
import { TextureKeys } from '../art/keys';
import { getContext, type GameContext } from '../context';
import { MenuOverlay } from '../menu/MenuOverlay';
import { startOrResumeGame } from '../sceneFlow';
import { SceneKeys } from './keys';

interface MenuFish {
  readonly image: Phaser.GameObjects.Image;
  readonly speed: number;
  readonly phase: number;
  readonly baseY: number;
  direction: -1 | 1;
}

interface MenuBubble {
  readonly rect: Phaser.GameObjects.Rectangle;
  readonly speed: number;
  y: number;
}

const DECORATION_SEED = 0x4d4e_3031;
const FISH_COUNT = 7;
const BUBBLE_COUNT = 18;
const ZONE_NAME_KEYS: Readonly<Record<string, StringKey>> = {
  zone1: 'menu.zone.zone1',
};

function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN');
}

/** Màn tiêu đề pixel; toàn bộ trang con và điều hướng nằm trong MenuOverlay dùng chung. */
export class MenuScene extends Phaser.Scene {
  private ctx!: GameContext;
  private rng!: Rng;
  private backdrop!: Phaser.GameObjects.Image;
  private logo!: Phaser.GameObjects.Image;
  private overlay!: MenuOverlay;
  private fish: MenuFish[] = [];
  private bubbles: MenuBubble[] = [];

  constructor() {
    super(SceneKeys.Menu);
  }

  create(): void {
    this.ctx = getContext(this);
    this.rng = createRng(DECORATION_SEED);
    this.fish = [];
    this.bubbles = [];
    this.backdrop = this.add.image(0, 0, TextureKeys.menuBackdrop).setOrigin(0.5, 0);
    this.createDecoration();
    this.logo = this.add.image(0, 8, TextureKeys.menuLogo).setOrigin(0.5, 0);
    this.overlay = new MenuOverlay(this, {
      entries: [
        { label: 'menu.start', action: 'start' },
        { label: 'menu.settings', action: 'settings' },
        { label: 'menu.guide', action: 'guide' },
        { label: 'menu.about', action: 'about' },
      ],
      stats: () => this.stats(),
      onStart: () => startOrResumeGame(this),
    });

    const onResize = (gameSize: Phaser.Structs.Size): void =>
      this.layout(gameSize.width, gameSize.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.overlay.destroy();
    });
    this.layout(this.scale.width, this.scale.height);
  }

  override update(time: number, delta: number): void {
    const seconds = Math.min(Math.max(delta, 0), 100) / 1_000;
    const width = this.scale.width;
    for (const fish of this.fish) {
      fish.image.x += fish.speed * fish.direction * seconds;
      const edge = fish.image.displayWidth / 2 + 4;
      if (fish.direction > 0 && fish.image.x > width + edge) {
        fish.direction = -1;
      } else if (fish.direction < 0 && fish.image.x < -edge) {
        fish.direction = 1;
      }
      fish.image
        .setY(Math.round(fish.baseY + Math.sin(time * 0.0018 + fish.phase) * 3))
        .setFlipX(fish.direction < 0);
    }

    for (const bubble of this.bubbles) {
      bubble.y -= bubble.speed * seconds;
      if (bubble.y < -4) {
        bubble.y = this.scale.height + this.rng.int(0, 60);
        bubble.rect.x = this.rng.int(8, Math.max(8, width - 8));
      }
      bubble.rect.y = Math.round(bubble.y);
    }
  }

  private createDecoration(): void {
    const species = this.ctx.content.fish.species;
    for (let index = 0; index < FISH_COUNT; index++) {
      const definition = species[index % species.length];
      if (!definition) continue;
      const direction: -1 | 1 = this.rng.chance(0.5) ? -1 : 1;
      const baseY = this.rng.int(72, 320);
      const image = this.add
        .image(this.rng.int(20, Math.max(20, this.scale.width - 20)), baseY, definition.texture)
        .setScale(this.rng.chance(0.4) ? 2 : 1)
        .setFlipX(direction < 0)
        .setAlpha(0.82);
      this.fish.push({
        image,
        speed: this.rng.int(10, 24),
        phase: this.rng.next() * Math.PI * 2,
        baseY,
        direction,
      });
    }

    for (let index = 0; index < BUBBLE_COUNT; index++) {
      const size = this.rng.int(1, 3);
      const y = this.rng.int(12, this.scale.height + 50);
      const rect = this.add
        .rectangle(
          this.rng.int(8, Math.max(8, this.scale.width - 8)),
          y,
          size,
          size,
          0xbdeeff,
          0.65,
        )
        .setOrigin(0);
      this.bubbles.push({ rect, speed: this.rng.int(7, 18), y });
    }
  }

  private stats(): readonly string[] {
    const { world } = this.ctx;
    const zoneNameKey = ZONE_NAME_KEYS[world.zone.id] ?? 'menu.zone.unknown';
    const fishCount = world.fish.filter((fish) => !fish.leaving).length;
    return [
      t('menu.stats.zone', { zone: t(zoneNameKey) }),
      t('menu.stats.water', { percent: Math.round(world.water) }),
      t('menu.stats.fish', { count: fishCount, capacity: world.zone.fishCapacity ?? 0 }),
      t('menu.stats.coins', { coins: formatNumber(world.wallet.get('coins')) }),
    ];
  }

  private layout(width: number, height: number): void {
    this.backdrop.setX(Math.round(width / 2));
    this.logo.setX(Math.round(width / 2));
    this.overlay.layout(width, height);
  }
}
