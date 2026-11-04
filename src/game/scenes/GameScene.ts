import Phaser from 'phaser';
import type { ZoneDef } from '../../core/content/schemas';
import { t } from '../../core/i18n';
import { TextureKeys } from '../art/keys';
import { getContext, type GameContext } from '../context';
import { addPixelText, COIN_COLOR } from '../hud/text';
import { SceneKeys } from './keys';

const Depth = {
  environment: 0,
  station: 1,
  trash: 2,
  robot: 3,
  effects: 4,
  labels: 5,
} as const;

/** Khung hình bị khựng lâu (chuyển tab…) không được làm robot nhảy xa. */
const MAX_FRAME_SECONDS = 0.1;
const CAMERA_LERP = 0.15;
const VACUUM_RING_COLOR = 0xbfefff;
const FLOAT_TEXT_RISE = 18;
const FLOAT_TEXT_MS = 1200;

/**
 * Thế giới bể cá: vẽ khu hiện tại, robot, rác theo trạng thái của World.
 * Luật chơi nằm trong World (src/core); scene này chỉ gọi update và hiển thị.
 */
export class GameScene extends Phaser.Scene {
  private ctx!: GameContext;
  private robotSprite!: Phaser.GameObjects.Image;
  private vacuumRing!: Phaser.GameObjects.Graphics;
  private readonly trashSprites = new Map<number, Phaser.GameObjects.Image>();

  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    this.ctx = getContext(this);
    const { world } = this.ctx;
    const { zone } = world;

    this.buildEnvironment(zone);
    this.robotSprite = this.add
      .image(world.robot.x, world.robot.y, TextureKeys.robot)
      .setDepth(Depth.robot);
    this.vacuumRing = this.add.graphics().setDepth(Depth.effects);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, zone.width, zone.height);
    camera.startFollow(this.robotSprite, true, CAMERA_LERP, CAMERA_LERP);

    const unsubscribe = this.ctx.bus.on('station:sold', ({ coins, x, y }) => {
      this.floatText(t('float.coins', { coins }), x, y);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);

    this.syncTrash(0);
    this.scene.launch(SceneKeys.UI);
  }

  override update(time: number, delta: number): void {
    const { world, input } = this.ctx;
    world.update(Math.min(delta / 1000, MAX_FRAME_SECONDS), input);
    this.syncRobot(time);
    this.syncTrash(time);
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

  private syncRobot(time: number): void {
    const { robot } = this.ctx.world;
    const x = Math.round(robot.x);
    const y = Math.round(robot.y);
    this.robotSprite.setPosition(x, y).setFlipX(robot.facingX < 0);

    this.vacuumRing.clear();
    if (robot.vacuumOn) {
      const { radius } = this.ctx.content.balance.robot.vacuum;
      const alpha = 0.45 + 0.2 * Math.sin(time / 120);
      this.vacuumRing.lineStyle(1, VACUUM_RING_COLOR, alpha).strokeCircle(x, y, radius);
    }
  }

  /** Tạo sprite cho rác mới, cập nhật vị trí, xoá sprite của rác đã bị thu. */
  private syncTrash(time: number): void {
    const seen = new Set<number>();
    for (const item of this.ctx.world.trash.items) {
      seen.add(item.id);
      let sprite = this.trashSprites.get(item.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, item.type.texture).setDepth(Depth.trash);
        this.trashSprites.set(item.id, sprite);
      }
      // Rác nổi nhấp nhô 1px theo sóng.
      const bob = item.type.layer === 'float' ? Math.round(Math.sin(time / 400 + item.id)) : 0;
      sprite.setPosition(Math.round(item.x), Math.round(item.y) + bob);
    }
    for (const [id, sprite] of this.trashSprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.trashSprites.delete(id);
      }
    }
  }

  private floatText(message: string, x: number, y: number): void {
    const label = addPixelText(this, Math.round(x), Math.round(y) - 4, message)
      .setOrigin(0.5, 1)
      .setColor(COIN_COLOR)
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
