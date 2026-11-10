import type Phaser from 'phaser';
import type { FishRules } from '../../core/content/schemas';
import { t } from '../../core/i18n';
import type { World } from '../../core/world';
import { TextureKeys } from '../art/keys';
import { HUD_MARGIN, HUD_ROW_1, HUD_ROW_2, TEXT_OFFSET_Y } from './layout';
import { addPixelText, COIN_COLOR, TEXT_COLOR, WARNING_COLOR } from './text';

const BAR_WIDTH = 50;
const BAR_HEIGHT = 10;
const ICON_GAP = 4;
/** Độ sạch nước hiển thị sau ô khoang, cùng hàng 2 (P2-01: tạm thời). */
const WATER_X = HUD_MARGIN + 64;

/** Màu % nước: bình thường / làm cá buồn (vàng) / làm cá mất máu (đỏ). */
function waterColor(percent: number, rules: FishRules): string {
  if (percent < rules.dirtyWaterBelow) return WARNING_COLOR;
  if (percent < rules.sadWaterBelow) return COIN_COLOR;
  return TEXT_COLOR;
}

const BAR_FRAME = 0x0b1d2e;
const BAR_EMPTY = 0x1b2a41;
const BAR_HIGH = 0x6fe08a;
const BAR_MID = 0xf2c94c;
const BAR_LOW = 0xe04f5f;
const DEPTH_GAUGE_WIDTH = 8;
const DEPTH_GAUGE_HEIGHT = 72;
const DEPTH_GAUGE_FRAME = 0x0b1d2e;
const DEPTH_GAUGE_EMPTY = 0x36516e;
const DEPTH_GAUGE_FILL = 0x8ee8ff;

function batteryColor(ratio: number): number {
  if (ratio > 0.5) return BAR_HIGH;
  if (ratio > 0.2) return BAR_MID;
  return BAR_LOW;
}

function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN');
}

/** Thông số mép trên: pin + khoang (trái), xu + ngọc (phải). Chỉ vẽ lại khi giá trị đổi. */
export class Hud {
  private readonly batteryBar: Phaser.GameObjects.Graphics;
  private readonly chargingText: Phaser.GameObjects.Text;
  private readonly cargoText: Phaser.GameObjects.Text;
  private readonly waterText: Phaser.GameObjects.Text;
  private readonly coinIcon: Phaser.GameObjects.Image;
  private readonly coinText: Phaser.GameObjects.Text;
  private readonly pearlIcon: Phaser.GameObjects.Image;
  private readonly pearlText: Phaser.GameObjects.Text;
  private readonly depthGauge: Phaser.GameObjects.Graphics;
  private depthGaugeX = 0;
  private depthGaugeY = 0;
  private width = 0;
  private shown = {
    batteryPixels: -1,
    charging: false,
    used: -1,
    water: -1,
    coins: -1,
    pearls: -1,
    depthPixels: -1,
  };

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
    private readonly fishRules: FishRules,
  ) {
    this.batteryBar = scene.add.graphics();
    this.chargingText = addPixelText(
      scene,
      HUD_MARGIN + BAR_WIDTH + 6,
      HUD_ROW_1 + TEXT_OFFSET_Y - 1,
      t('hud.charging'),
    ).setVisible(false);

    scene.add.image(HUD_MARGIN, HUD_ROW_2, TextureKeys.iconCargo).setOrigin(0);
    this.cargoText = addPixelText(scene, HUD_MARGIN + 10 + ICON_GAP, HUD_ROW_2 + TEXT_OFFSET_Y, '');
    scene.add.image(WATER_X, HUD_ROW_2, TextureKeys.iconWater).setOrigin(0);
    this.waterText = addPixelText(scene, WATER_X + 6 + ICON_GAP, HUD_ROW_2 + TEXT_OFFSET_Y, '');

    this.coinIcon = scene.add.image(0, HUD_ROW_1, TextureKeys.iconCoin).setOrigin(0);
    this.coinText = addPixelText(scene, 0, HUD_ROW_1 + TEXT_OFFSET_Y, '').setOrigin(1, 0);
    this.pearlIcon = scene.add.image(0, HUD_ROW_2, TextureKeys.iconPearl).setOrigin(0);
    this.pearlText = addPixelText(scene, 0, HUD_ROW_2 + TEXT_OFFSET_Y, '').setOrigin(1, 0);
    this.depthGauge = scene.add.graphics();
  }

  /** Gọi khi chiều rộng màn hình đổi: các thông số bên phải bám mép phải. */
  layout(width: number): void {
    this.width = width;
    this.placeRight(this.coinText, this.coinIcon);
    this.placeRight(this.pearlText, this.pearlIcon);
  }

  /** Đặt tâm thanh độ sâu dọc cạnh hai nút lặn. */
  layoutDepthGauge(x: number, y: number): void {
    this.depthGaugeX = x;
    this.depthGaugeY = y;
    this.drawDepthGauge(this.depthPixels(this.world.robot.z));
  }

  refresh(): void {
    const { robot, wallet } = this.world;

    const depthPixels = this.depthPixels(robot.z);
    if (depthPixels !== this.shown.depthPixels) {
      this.shown.depthPixels = depthPixels;
      this.drawDepthGauge(depthPixels);
    }

    const batteryPixels = Math.round((BAR_WIDTH - 4) * robot.battery.ratio);
    if (batteryPixels !== this.shown.batteryPixels) {
      this.shown.batteryPixels = batteryPixels;
      this.drawBattery(batteryPixels, robot.battery.ratio);
    }

    const charging = this.world.isCharging;
    if (charging !== this.shown.charging) {
      this.shown.charging = charging;
      this.chargingText.setVisible(charging);
    }

    const { used, capacity, free } = robot.cargo;
    if (used !== this.shown.used) {
      this.shown.used = used;
      this.cargoText
        .setText(t('hud.cargo', { used, capacity }))
        .setColor(free === 0 ? WARNING_COLOR : TEXT_COLOR);
    }

    const coins = wallet.get('coins');
    if (coins !== this.shown.coins) {
      this.shown.coins = coins;
      this.coinText.setText(formatNumber(coins));
      this.placeRight(this.coinText, this.coinIcon);
    }

    const water = Math.round(this.world.water);
    if (water !== this.shown.water) {
      this.shown.water = water;
      this.waterText
        .setText(t('hud.water', { percent: water }))
        .setColor(waterColor(water, this.fishRules));
    }

    const pearls = wallet.get('pearls');
    if (pearls !== this.shown.pearls) {
      this.shown.pearls = pearls;
      this.pearlText.setText(formatNumber(pearls));
      this.placeRight(this.pearlText, this.pearlIcon);
    }
  }

  private placeRight(text: Phaser.GameObjects.Text, icon: Phaser.GameObjects.Image): void {
    const right = this.width - HUD_MARGIN;
    text.setX(right);
    icon.setX(Math.round(right - text.width - ICON_GAP - icon.width));
  }

  private drawBattery(fillPixels: number, ratio: number): void {
    const g = this.batteryBar.clear();
    const x = HUD_MARGIN;
    const y = HUD_ROW_1;
    g.fillStyle(BAR_FRAME).fillRect(x, y, BAR_WIDTH, BAR_HEIGHT);
    g.fillRect(x + BAR_WIDTH, y + 3, 2, BAR_HEIGHT - 6); // núm pin
    g.fillStyle(BAR_EMPTY).fillRect(x + 2, y + 2, BAR_WIDTH - 4, BAR_HEIGHT - 4);
    if (fillPixels > 0) {
      g.fillStyle(batteryColor(ratio)).fillRect(x + 2, y + 2, fillPixels, BAR_HEIGHT - 4);
    }
  }

  private depthPixels(depth: number): number {
    const ratio = Math.min(1, Math.max(0, depth / 2));
    return Math.round((DEPTH_GAUGE_HEIGHT - 4) * ratio);
  }

  private drawDepthGauge(fillPixels: number): void {
    const x = Math.round(this.depthGaugeX - DEPTH_GAUGE_WIDTH / 2);
    const y = Math.round(this.depthGaugeY - DEPTH_GAUGE_HEIGHT / 2);
    const innerHeight = DEPTH_GAUGE_HEIGHT - 4;
    const g = this.depthGauge.clear();
    g.fillStyle(DEPTH_GAUGE_FRAME).fillRect(x, y, DEPTH_GAUGE_WIDTH, DEPTH_GAUGE_HEIGHT);
    g.fillStyle(DEPTH_GAUGE_EMPTY).fillRect(x + 2, y + 2, DEPTH_GAUGE_WIDTH - 4, innerHeight);
    if (fillPixels > 0) {
      g.fillStyle(DEPTH_GAUGE_FILL).fillRect(
        x + 2,
        y + 2 + innerHeight - fillPixels,
        DEPTH_GAUGE_WIDTH - 4,
        fillPixels,
      );
    }
  }
}
