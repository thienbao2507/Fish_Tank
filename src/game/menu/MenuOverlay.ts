import Phaser from 'phaser';
import type { StringKey } from '../../core/i18n';
import { t } from '../../core/i18n';
import type { VolumeSetting } from '../../core/settings';
import { TextureKeys } from '../art/keys';
import {
  getSoundDirector,
  SOUND_ENABLED_KEY,
  SOUND_VOLUME_KEY,
} from '../audio/SoundDirector';
import { BLOOM_KEY } from '../env/bloom';
import { TILT_SHIFT_KEY, VIGNETTE_KEY } from '../env/postfx';
import { SURFACE_RIPPLE_KEY } from '../env/surfaceRipple';
import { addPixelText } from '../hud/text';
import { MenuButton } from './MenuButton';

export type MenuPage = 'root' | 'settings' | 'guide' | 'about';

export interface MenuEntry {
  readonly label: StringKey;
  readonly action: 'start' | 'resume' | 'settings' | 'guide' | 'about' | 'title';
}

export interface MenuOverlayOptions {
  readonly entries: readonly MenuEntry[];
  readonly stats?: () => readonly string[];
  readonly onStart?: () => void;
  readonly onResume?: () => void;
  readonly onTitle?: () => void;
  readonly onRootEscape?: () => void;
  readonly dimBackground?: boolean;
}

interface KeyBinding {
  readonly key: Phaser.Input.Keyboard.Key;
  readonly handler: () => void;
}

const PANEL_WIDTH = 328;
const PANEL_HEIGHT = 300;
/** Bảng chỉ có 3 nút (menu tạm dừng): vừa đủ 3 nút cộng lề, không để trống. */
const COMPACT_PANEL_HEIGHT = 176;
const PANEL_SLICE = 12;
const SCREEN_WIDTH = 272;
const SCREEN_HEIGHT = 78;
const SCREEN_SLICE = 5;
const ROOT_BUTTON_Y = [-37, 3, 43, 83] as const;
const SIMPLE_BUTTON_Y = [-46, 0, 46] as const;
const TOGGLE_X = 108;
const SETTINGS_START_Y = -83;
const SETTINGS_STEP_Y = 34;
const VOLUME_LEVELS: readonly VolumeSetting[] = ['low', 'mid', 'high'];
const VOLUME_LABELS: Readonly<Record<VolumeSetting, StringKey>> = {
  low: 'menu.settings.volume.low',
  mid: 'menu.settings.volume.mid',
  high: 'menu.settings.volume.high',
};

function registryVolume(value: unknown): VolumeSetting {
  return value === 'low' || value === 'high' ? value : 'mid';
}

function addCenteredText(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  y: number,
  key: StringKey,
): Phaser.GameObjects.Text {
  const text = addPixelText(scene, 0, y, t(key)).setOrigin(0.5, 0);
  parent.add(text);
  return text;
}

export class MenuOverlay {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly shade?: Phaser.GameObjects.Rectangle;
  private readonly keyBindings: KeyBinding[] = [];
  private pageContainer?: Phaser.GameObjects.Container;
  private buttons: MenuButton[] = [];
  private selected = 0;
  private page: MenuPage = 'root';
  private guidePage = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: MenuOverlayOptions,
  ) {
    this.shade = options.dimBackground
      ? scene.add
          .rectangle(0, 0, scene.scale.width, scene.scale.height, 0x07101d, 0.72)
          .setOrigin(0)
      : undefined;
    this.root = scene.add.container(0, 0);
    this.panel = scene.add.nineslice(
      0,
      0,
      TextureKeys.menuPanel,
      undefined,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      PANEL_SLICE,
      PANEL_SLICE,
      PANEL_SLICE,
      PANEL_SLICE,
    );
    this.root.add(this.panel);
    this.setupKeyboard();
    this.showRoot();
    this.layout(scene.scale.width, scene.scale.height);
  }

  layout(width: number, height: number): void {
    this.shade?.setSize(width, height);
    this.root.setPosition(Math.round(width / 2), Math.round(height / 2 + 18));
  }

  destroy(): void {
    for (const { key, handler } of this.keyBindings) key.off('down', handler);
    this.clearPage();
    this.root.destroy(true);
    this.shade?.destroy();
  }

  private setupKeyboard(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;
    const { KeyCodes } = Phaser.Input.Keyboard;
    this.bindKey(keyboard.addKey(KeyCodes.UP), () => this.moveSelection(-1));
    this.bindKey(keyboard.addKey(KeyCodes.W), () => this.moveSelection(-1));
    this.bindKey(keyboard.addKey(KeyCodes.DOWN), () => this.moveSelection(1));
    this.bindKey(keyboard.addKey(KeyCodes.S), () => this.moveSelection(1));
    this.bindKey(keyboard.addKey(KeyCodes.ENTER), () => this.pressSelected());
    this.bindKey(keyboard.addKey(KeyCodes.SPACE), () => this.pressSelected());
    this.bindKey(keyboard.addKey(KeyCodes.ESC), () => this.handleEscape());
  }

  private bindKey(key: Phaser.Input.Keyboard.Key, handler: () => void): void {
    key.on('down', handler);
    this.keyBindings.push({ key, handler });
  }

  private showRoot(): void {
    this.page = 'root';
    const page = this.replacePage();
    const stats = this.options.stats?.();
    if (!stats) this.panel.setSize(PANEL_WIDTH, COMPACT_PANEL_HEIGHT);
    if (stats) {
      const screen = this.scene.add.nineslice(
        0,
        -101,
        TextureKeys.menuScreen,
        undefined,
        SCREEN_WIDTH,
        SCREEN_HEIGHT,
        SCREEN_SLICE,
        SCREEN_SLICE,
        SCREEN_SLICE,
        SCREEN_SLICE,
      );
      const statsText = addPixelText(
        this.scene,
        -SCREEN_WIDTH / 2 + 12,
        -135,
        stats.join('\n'),
      ).setLineSpacing(-2);
      page.add([screen, statsText]);
    }

    const positions = stats ? ROOT_BUTTON_Y : SIMPLE_BUTTON_Y;
    this.buttons = this.options.entries.map((entry, index) => {
      const y = positions[index] ?? -46 + index * 46;
      return new MenuButton(
        this.scene,
        page,
        y,
        entry.label,
        () => this.select(index),
        () => {
          this.select(index);
          this.activate(entry.action);
        },
      );
    });
    this.select(0);
  }

  private showSettings(): void {
    this.page = 'settings';
    const page = this.replacePage();
    addCenteredText(this.scene, page, -119, 'menu.settings.title');
    const rows: ReadonlyArray<{ label: StringKey; key: string }> = [
      { label: 'menu.settings.bloom', key: BLOOM_KEY },
      { label: 'menu.settings.tiltShift', key: TILT_SHIFT_KEY },
      { label: 'menu.settings.vignette', key: VIGNETTE_KEY },
      { label: 'menu.settings.surfaceRipple', key: SURFACE_RIPPLE_KEY },
      { label: 'menu.settings.sound', key: SOUND_ENABLED_KEY },
    ];

    rows.forEach(({ label, key }, index) => {
      const y = SETTINGS_START_Y + index * SETTINGS_STEP_Y;
      const rowLabel = addPixelText(this.scene, -112, y, t(label)).setOrigin(0, 0.5);
      const toggle = this.scene.add.image(TOGGLE_X, y, TextureKeys.menuToggle, 0);
      const hitArea = this.scene.add
        .zone(TOGGLE_X, y, 48, 30)
        .setInteractive({ useHandCursor: true });
      const refresh = (): void => {
        toggle.setFrame(this.scene.registry.get(key) !== false ? 1 : 0);
      };
      refresh();
      hitArea.on('pointerdown', () => {
        getSoundDirector(this.scene).play('click');
        this.scene.registry.set(key, this.scene.registry.get(key) === false);
        refresh();
      });
      page.add([rowLabel, toggle, hitArea]);
    });

    const volumeY = SETTINGS_START_Y + rows.length * SETTINGS_STEP_Y;
    const volumeLabel = addPixelText(
      this.scene,
      -112,
      volumeY,
      t('menu.settings.volume'),
    ).setOrigin(0, 0.5);
    const volumeButton = this.scene.add
      .nineslice(
        TOGGLE_X,
        volumeY,
        TextureKeys.menuButton,
        0,
        72,
        26,
        6,
        6,
        6,
        6,
      )
      .setInteractive({ useHandCursor: true });
    const volumeText = addPixelText(this.scene, TOGGLE_X, volumeY, '').setOrigin(0.5);
    const refreshVolume = (): void => {
      const level = registryVolume(this.scene.registry.get(SOUND_VOLUME_KEY));
      volumeText.setText(t(VOLUME_LABELS[level]));
    };
    refreshVolume();
    volumeButton.on('pointerover', () => volumeButton.setFrame(1));
    volumeButton.on('pointerout', () => volumeButton.setFrame(0));
    volumeButton.on('pointerdown', () => {
      getSoundDirector(this.scene).play('click');
      const current = registryVolume(this.scene.registry.get(SOUND_VOLUME_KEY));
      const next = VOLUME_LEVELS[(VOLUME_LEVELS.indexOf(current) + 1) % VOLUME_LEVELS.length];
      this.scene.registry.set(SOUND_VOLUME_KEY, next);
      refreshVolume();
    });
    page.add([volumeLabel, volumeButton, volumeText]);

    this.buttons = [
      new MenuButton(
        this.scene,
        page,
        124,
        'menu.back',
        () => this.select(0),
        () => this.showRoot(),
      ),
    ];
    this.select(0);
  }

  private showGuide(pageIndex: number): void {
    this.page = 'guide';
    this.guidePage = Phaser.Math.Wrap(pageIndex, 0, 3);
    const page = this.replacePage();
    const guideContent: ReadonlyArray<{ title: StringKey; body: StringKey }> = [
      { title: 'menu.guide.controlsTitle', body: 'menu.guide.controlsBody' },
      { title: 'menu.guide.loopTitle', body: 'menu.guide.loopBody' },
      { title: 'menu.guide.roomTitle', body: 'menu.guide.roomBody' },
    ];
    const content = guideContent[this.guidePage] as (typeof guideContent)[number];
    addCenteredText(this.scene, page, -126, 'menu.guide.title');
    const counter = addPixelText(
      this.scene,
      112,
      -126,
      t('menu.guide.page', { page: this.guidePage + 1, total: guideContent.length }),
    ).setOrigin(1, 0);
    const title = addPixelText(this.scene, -120, -92, t(content.title));
    const body = addPixelText(this.scene, -120, -61, t(content.body)).setWordWrapWidth(240, true);
    page.add([counter, title, body]);

    const entries: ReadonlyArray<{ label: StringKey; action: () => void }> = [
      { label: 'menu.guide.previous', action: () => this.showGuide(this.guidePage - 1) },
      { label: 'menu.guide.next', action: () => this.showGuide(this.guidePage + 1) },
      { label: 'menu.back', action: () => this.showRoot() },
    ];
    this.buttons = entries.map(
      (entry, index) =>
        new MenuButton(
          this.scene,
          page,
          55 + index * 37,
          entry.label,
          () => this.select(index),
          entry.action,
          220,
        ),
    );
    this.select(0);
  }

  private showAbout(): void {
    this.page = 'about';
    const page = this.replacePage();
    addCenteredText(this.scene, page, -119, 'menu.about.title');
    const lines: StringKey[] = [
      'menu.about.game',
      'menu.about.version',
      'menu.about.uiFont',
      'menu.about.vtFont',
    ];
    lines.forEach((key, index) => {
      const line = addPixelText(this.scene, 0, -68 + index * 34, t(key)).setOrigin(0.5, 0);
      page.add(line);
    });
    this.buttons = [
      new MenuButton(
        this.scene,
        page,
        103,
        'menu.back',
        () => this.select(0),
        () => this.showRoot(),
      ),
    ];
    this.select(0);
  }

  private activate(action: MenuEntry['action']): void {
    switch (action) {
      case 'start':
        this.options.onStart?.();
        break;
      case 'resume':
        this.options.onResume?.();
        break;
      case 'settings':
        this.showSettings();
        break;
      case 'guide':
        this.showGuide(0);
        break;
      case 'about':
        this.showAbout();
        break;
      case 'title':
        this.options.onTitle?.();
        break;
    }
  }

  private moveSelection(delta: number): void {
    if (this.buttons.length === 0) return;
    this.select(Phaser.Math.Wrap(this.selected + delta, 0, this.buttons.length));
  }

  private select(index: number): void {
    this.selected = index;
    this.buttons.forEach((button, buttonIndex) => button.setSelected(buttonIndex === index));
  }

  private pressSelected(): void {
    getSoundDirector(this.scene).play('click');
    if (this.page === 'root') {
      const entry = this.options.entries[this.selected];
      if (entry) this.activate(entry.action);
      return;
    }
    if (this.page === 'settings' || this.page === 'about') {
      this.showRoot();
      return;
    }
    if (this.page === 'guide') {
      if (this.selected === 0) this.showGuide(this.guidePage - 1);
      else if (this.selected === 1) this.showGuide(this.guidePage + 1);
      else this.showRoot();
    }
  }

  private handleEscape(): void {
    if (this.page !== 'root') this.showRoot();
    else this.options.onRootEscape?.();
  }

  private replacePage(): Phaser.GameObjects.Container {
    this.clearPage();
    this.panel.setSize(PANEL_WIDTH, PANEL_HEIGHT);
    this.pageContainer = this.scene.add.container(0, 0);
    this.root.add(this.pageContainer);
    this.buttons = [];
    return this.pageContainer;
  }

  private clearPage(): void {
    this.pageContainer?.removeAll(true);
    this.pageContainer?.destroy();
    this.pageContainer = undefined;
    this.buttons = [];
  }
}
