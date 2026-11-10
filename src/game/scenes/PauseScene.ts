import Phaser from 'phaser';
import { MenuOverlay } from '../menu/MenuOverlay';
import { getLastPlayArea, type PlayArea } from '../sceneFlow';
import { SceneKeys } from './keys';

interface PauseSceneData {
  readonly area?: PlayArea;
}

export class PauseScene extends Phaser.Scene {
  private area: PlayArea = 'room';
  private overlay!: MenuOverlay;

  constructor() {
    super(SceneKeys.Pause);
  }

  init(data: PauseSceneData): void {
    this.area = data.area ?? getLastPlayArea();
  }

  create(): void {
    this.overlay = new MenuOverlay(this, {
      entries: [
        { label: 'menu.resume', action: 'resume' },
        { label: 'menu.settings', action: 'settings' },
        { label: 'menu.titleScreen', action: 'title' },
      ],
      onResume: () => this.resumeGame(),
      onTitle: () => this.returnToTitle(),
      onRootEscape: () => this.resumeGame(),
      dimBackground: true,
    });

    const onResize = (gameSize: Phaser.Structs.Size): void =>
      this.overlay.layout(gameSize.width, gameSize.height);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.overlay.destroy();
    });
  }

  private resumeGame(): void {
    if (this.area === 'room') {
      this.scene.resume(SceneKeys.Room);
    } else {
      this.scene.resume(SceneKeys.Game);
      this.scene.resume(SceneKeys.UI);
    }
    this.scene.stop(SceneKeys.Pause);
  }

  private returnToTitle(): void {
    if (this.area === 'room') {
      this.scene.resume(SceneKeys.Room);
      this.scene.sleep(SceneKeys.Room);
    } else {
      this.scene.resume(SceneKeys.Game);
      this.scene.resume(SceneKeys.UI);
      this.scene.sleep(SceneKeys.Game);
      this.scene.sleep(SceneKeys.UI);
    }
    this.scene.start(SceneKeys.Menu);
  }
}
