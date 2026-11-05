import Phaser from 'phaser';
import type { ZoneDef } from '../../core/content/schemas';
import { t } from '../../core/i18n';
import type { Drop } from '../../core/sim/drops';
import type { Fish } from '../../core/sim/fish';
import type { FoodPellet } from '../../core/sim/food';
import type { TrashItem } from '../../core/sim/trash';
import { TextureKeys } from '../art/keys';
import { getContext, type GameContext } from '../context';
import { addPixelText, COIN_COLOR, TEXT_COLOR, WARNING_COLOR } from '../hud/text';
import { SpriteSync, type Destroyable } from '../SpriteSync';
import { SceneKeys } from './keys';

const Depth = {
  environment: 0,
  station: 1,
  items: 2,
  fish: 3,
  robot: 4,
  effects: 5,
  labels: 6,
} as const;

/** Khung hình bị khựng lâu (chuyển tab…) không được làm robot nhảy xa. */
const MAX_FRAME_SECONDS = 0.1;
const CAMERA_LERP = 0.15;
const VACUUM_RING_COLOR = 0xbfefff;
const FLOAT_TEXT_RISE = 18;
const FLOAT_TEXT_MS = 1200;
const HEALED_COLOR = '#6fe08a';
/** Cá ốm nhạt màu đi. */
const SICK_TINT = 0x9fb8a0;
/** Xu/ngọc nhấp nháy trong mấy giây cuối trước khi tự cộng. */
const DROP_BLINK_SECONDS = 5;
/** Góc nghiêng khi cá nhảy khỏi bể (độ). */
const LEAVING_ANGLE = 60;

interface FishView extends Destroyable {
  readonly sprite: Phaser.GameObjects.Image;
  readonly alert: Phaser.GameObjects.Image;
  readonly countdown: Phaser.GameObjects.Text;
}

/**
 * Thế giới bể cá: vẽ khu hiện tại, robot, rác, thức ăn, xu, cá theo trạng thái của World.
 * Luật chơi nằm trong World (src/core); scene này chỉ gọi update và hiển thị.
 */
export class GameScene extends Phaser.Scene {
  private ctx!: GameContext;
  private robotSprite!: Phaser.GameObjects.Image;
  private vacuumRing!: Phaser.GameObjects.Graphics;
  private trashViews!: SpriteSync<TrashItem, Phaser.GameObjects.Image>;
  private foodViews!: SpriteSync<FoodPellet, Phaser.GameObjects.Image>;
  private dropViews!: SpriteSync<Drop, Phaser.GameObjects.Image>;
  private fishViews!: SpriteSync<Fish, FishView>;
  /** Thời điểm khung hình hiện tại (ms) — dùng cho hiệu ứng nhấp nhô/nhấp nháy. */
  private now = 0;

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.ctx = getContext(this);
    const { world, bus } = this.ctx;
    const { zone } = world;

    this.buildEnvironment(zone);
    this.createViews();
    this.robotSprite = this.add
      .image(world.robot.x, world.robot.y, TextureKeys.robot)
      .setScale(this.ctx.content.balance.robot.displayScaleX, 1)
      .setDepth(Depth.robot);
    this.vacuumRing = this.add.graphics().setDepth(Depth.effects);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, zone.width, zone.height);
    camera.startFollow(this.robotSprite, true, CAMERA_LERP, CAMERA_LERP);

    const unsubscribers = [
      bus.on('station:sold', ({ coins, x, y }) => {
        this.floatText(t('float.coins', { coins }), x, y, COIN_COLOR);
      }),
      bus.on('drop:collected', ({ currency, amount, x, y }) => {
        const pearls = currency === 'pearls';
        const message = pearls
          ? t('float.pearls', { pearls: amount })
          : t('float.coins', { coins: amount });
        this.floatText(message, x, y, pearls ? TEXT_COLOR : COIN_COLOR);
      }),
      bus.on('fish:healed', ({ x, y }) => {
        this.floatText(t('float.healed'), x, y - 6, HEALED_COLOR);
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
    });

    this.syncViews();
    this.scene.launch(SceneKeys.UI);
  }

  override update(time: number, delta: number): void {
    const { world, input, clock } = this.ctx;
    world.update(Math.min(delta / 1000, MAX_FRAME_SECONDS), input, clock.scale);
    this.now = time;
    this.syncRobot();
    this.syncViews();
  }

  private buildEnvironment(zone: ZoneDef): void {
    const waterHeight = zone.floorY - zone.surfaceY;
    const sandHeight = zone.height - zone.floorY;
    const env = Depth.environment;

    this.add
      .image(0, 0, TextureKeys.air)
      .setOrigin(0)
      .setDisplaySize(zone.width, zone.surfaceY)
      .setDepth(env);
    this.add
      .image(0, zone.surfaceY, TextureKeys.water)
      .setOrigin(0)
      .setDisplaySize(zone.width, waterHeight)
      .setDepth(env);
    this.add
      .tileSprite(0, zone.surfaceY - 1, zone.width, 4, TextureKeys.surface)
      .setOrigin(0)
      .setDepth(env);
    if (sandHeight > 0) {
      this.add
        .tileSprite(0, zone.floorY, zone.width, sandHeight, TextureKeys.sand)
        .setOrigin(0)
        .setDepth(env);
    }
    if (zone.wallWidth > 0) {
      for (const x of [0, zone.width - zone.wallWidth]) {
        this.add
          .image(x, 0, TextureKeys.wall)
          .setOrigin(0)
          .setDisplaySize(zone.wallWidth, zone.height)
          .setDepth(env);
      }
    }

    const { station } = zone;
    this.add
      .image(station.x, station.y, TextureKeys.station)
      .setOrigin(0)
      .setDisplaySize(station.width, station.height)
      .setDepth(Depth.station);
    addPixelText(this, Math.round(station.x + station.width / 2), station.y - 2, t('world.station'))
      .setOrigin(0.5, 1)
      .setDepth(Depth.labels);
  }

  private createViews(): void {
    const { balance } = this.ctx.content;

    this.trashViews = new SpriteSync(
      (item) => this.add.image(0, 0, item.type.texture).setDepth(Depth.items),
      (sprite, item) => {
        // Rác nổi nhấp nhô 1px theo sóng.
        const bob =
          item.type.layer === 'float' ? Math.round(Math.sin(this.now / 400 + item.id)) : 0;
        sprite.setPosition(Math.round(item.x), Math.round(item.y) + bob);
      },
    );

    this.foodViews = new SpriteSync(
      () => this.add.image(0, 0, TextureKeys.foodPellet).setDepth(Depth.items),
      (sprite, pellet) => sprite.setPosition(Math.round(pellet.x), Math.round(pellet.y)),
    );

    const blinkAfter = balance.drops.autoCollectSeconds - DROP_BLINK_SECONDS;
    this.dropViews = new SpriteSync(
      (drop) =>
        this.add
          .image(0, 0, drop.kind === 'coin' ? TextureKeys.dropCoin : TextureKeys.dropPearl)
          .setDepth(Depth.items),
      (sprite, drop) => {
        sprite.setPosition(Math.round(drop.x), Math.round(drop.y));
        sprite.setVisible(drop.age < blinkAfter || Math.floor(this.now / 150) % 2 === 0);
      },
    );

    this.fishViews = new SpriteSync(
      (fish) => this.createFishView(fish),
      (view, fish) => this.updateFishView(view, fish),
    );
  }

  private createFishView(fish: Fish): FishView {
    const sprite = this.add.image(0, 0, fish.species.texture).setDepth(Depth.fish);
    const alert = this.add.image(0, 0, TextureKeys.alert).setDepth(Depth.labels).setVisible(false);
    const countdown = addPixelText(this, 0, 0, '')
      .setOrigin(0, 1)
      .setColor(WARNING_COLOR)
      .setDepth(Depth.labels)
      .setVisible(false);
    return {
      sprite,
      alert,
      countdown,
      destroy: () => {
        sprite.destroy();
        alert.destroy();
        countdown.destroy();
      },
    };
  }

  private updateFishView(view: FishView, fish: Fish): void {
    const { world, content } = this.ctx;
    const x = Math.round(fish.x);
    const y = Math.round(fish.y);
    const sick = !fish.leaving && world.moodOf(fish) === 'sick';

    view.sprite.setPosition(x, y).setFlipX(fish.facingX < 0);
    if (sick) view.sprite.setTint(SICK_TINT);
    else view.sprite.clearTint();

    if (fish.leaving) {
      // Nhảy khỏi bể: chúc đầu lên, mờ dần khi đã lên khỏi mặt nước.
      view.sprite.setAngle(fish.facingX > 0 ? -LEAVING_ANGLE : LEAVING_ANGLE);
      const above = world.zone.surfaceY - fish.y;
      view.sprite.setAlpha(above > 0 ? Math.max(0, 1 - above / 20) : 1);
    }

    view.alert.setVisible(sick);
    view.countdown.setVisible(sick);
    if (sick) {
      const top = y - fish.species.radius - 6;
      view.alert.setPosition(x, top - 4);
      const secondsLeft = Math.max(
        0,
        Math.ceil(content.balance.fish.leaveAfterSeconds - fish.sickSeconds),
      );
      const label = String(secondsLeft);
      if (view.countdown.text !== label) view.countdown.setText(label);
      view.countdown.setPosition(x + 4, top + 2);
    }
  }

  private syncRobot(): void {
    const { robot } = this.ctx.world;
    const x = Math.round(robot.x);
    const y = Math.round(robot.y);
    this.robotSprite.setPosition(x, y).setFlipX(robot.facingX < 0);

    this.vacuumRing.clear();
    if (robot.vacuumOn) {
      const { radius } = this.ctx.content.balance.robot.vacuum;
      const alpha = 0.45 + 0.2 * Math.sin(this.now / 120);
      this.vacuumRing.lineStyle(1, VACUUM_RING_COLOR, alpha).strokeCircle(x, y, radius);
    }
  }

  private syncViews(): void {
    const { world } = this.ctx;
    this.trashViews.sync(world.trash.items);
    this.foodViews.sync(world.food.pellets);
    this.dropViews.sync(world.drops.items);
    this.fishViews.sync(world.fish);
  }

  private floatText(message: string, x: number, y: number, color: string): void {
    const label = addPixelText(this, Math.round(x), Math.round(y) - 4, message)
      .setOrigin(0.5, 1)
      .setColor(color)
      .setDepth(Depth.labels);
    this.tweens.add({
      targets: label,
      y: label.y - FLOAT_TEXT_RISE,
      alpha: 0,
      duration: FLOAT_TEXT_MS,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy(),
    });
  }
}
