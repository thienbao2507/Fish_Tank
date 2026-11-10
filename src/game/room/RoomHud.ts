import Phaser from 'phaser';
import { t } from '../../core/i18n';
import { formatClock, type DayClock, type DayPhase } from '../../core/time/dayClock';
import type { World } from '../../core/world';
import { TextureKeys } from '../art/keys';
import { HUD_MARGIN, HUD_ROW_1, HUD_ROW_2, TEXT_OFFSET_Y } from '../hud/layout';
import { addPixelText } from '../hud/text';
import { PauseButton } from '../menu/PauseButton';
import { ROOM_LIGHT_DEPTH } from './layout';

const ICON_GAP = 4;
const HUD_DEPTH = ROOM_LIGHT_DEPTH + 1;

const PHASE_KEYS = {
  morning: 'ui.phase.morning',
  noon: 'ui.phase.noon',
  afternoon: 'ui.phase.afternoon',
  night: 'ui.phase.night',
} as const satisfies Record<DayPhase, string>;

function formatNumber(value: number): string {
  return value.toLocaleString('vi-VN');
}

/** Ví ở góc trên phải, giờ trong ngày ở góc trên trái; chỉ vẽ lại chữ khi giá trị đổi. */
export class RoomHud {
  private readonly coinIcon: Phaser.GameObjects.Image;
  private readonly coinText: Phaser.GameObjects.Text;
  private readonly pearlIcon: Phaser.GameObjects.Image;
  private readonly pearlText: Phaser.GameObjects.Text;
  private readonly pauseButton: PauseButton;
  private readonly clockText: Phaser.GameObjects.Text;
  private shownClock = '';
  private width = 0;
  private shownCoins = -1;
  private shownPearls = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly world: World,
    onPause: () => void,
    private readonly time: { readonly day: DayClock; readonly now: () => number },
  ) {
    this.coinIcon = scene.add
      .image(0, HUD_ROW_1, TextureKeys.iconCoin)
      .setOrigin(0)
      .setDepth(HUD_DEPTH);
    this.coinText = addPixelText(scene, 0, HUD_ROW_1 + TEXT_OFFSET_Y, '')
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);
    this.pearlIcon = scene.add
      .image(0, HUD_ROW_2, TextureKeys.iconPearl)
      .setOrigin(0)
      .setDepth(HUD_DEPTH);
    this.pearlText = addPixelText(scene, 0, HUD_ROW_2 + TEXT_OFFSET_Y, '')
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH);
    this.clockText = addPixelText(scene, HUD_MARGIN, HUD_ROW_1 + TEXT_OFFSET_Y, '')
      .setOrigin(0, 0)
      .setDepth(HUD_DEPTH);
    this.pauseButton = new PauseButton(scene, onPause, HUD_DEPTH);

    const onResize = (gameSize: Phaser.Structs.Size): void => this.layout(gameSize.width);
    scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
    this.layout(scene.scale.width);
  }

  refresh(): void {
    const now = this.time.now();
    const label = t('ui.roomClock', {
      time: formatClock(this.time.day.minuteOfDay(now)),
      phase: t(PHASE_KEYS[this.time.day.phaseAt(now)]),
    });
    if (label !== this.shownClock) {
      this.shownClock = label;
      this.clockText.setText(label);
    }

    const coins = this.world.wallet.get('coins');
    if (coins !== this.shownCoins) {
      this.shownCoins = coins;
      this.coinText.setText(formatNumber(coins));
      this.placeRight(this.coinText, this.coinIcon);
    }

    const pearls = this.world.wallet.get('pearls');
    if (pearls !== this.shownPearls) {
      this.shownPearls = pearls;
      this.pearlText.setText(formatNumber(pearls));
      this.placeRight(this.pearlText, this.pearlIcon);
    }
  }

  private layout(width: number): void {
    this.width = width;
    this.pauseButton.layout(width);
    this.placeRight(this.coinText, this.coinIcon);
    this.placeRight(this.pearlText, this.pearlIcon);
  }

  private placeRight(text: Phaser.GameObjects.Text, icon: Phaser.GameObjects.Image): void {
    const right = this.width - HUD_MARGIN;
    text.setX(right);
    icon.setX(Math.round(right - text.width - ICON_GAP - icon.width));
  }
}
