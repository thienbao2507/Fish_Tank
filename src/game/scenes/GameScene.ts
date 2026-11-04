import Phaser from 'phaser';
import { GAME_HEIGHT } from '../../config';
import { TextureKeys } from '../art/keys';
import { SceneKeys } from './keys';

/** Thế giới bể cá. P0 chỉ có nền nước và robot đứng yên; P1 thêm khu, điều khiển, rác. */
export class GameScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Game);
  }

  create(): void {
    // Nền rộng bằng GAME_MAX_WIDTH nên luôn phủ kín mọi chiều rộng logic.
    this.add.image(0, 0, TextureKeys.waterBackground).setOrigin(0, 0);

    const robot = this.add.image(
      Math.floor(this.scale.width / 2),
      GAME_HEIGHT / 2,
      TextureKeys.robot,
    );

    // Chiều rộng logic đổi theo màn hình → giữ robot ở giữa (tạm thời, P1 thay bằng camera bám robot).
    const recenter = (gameSize: Phaser.Structs.Size): void => {
      robot.setX(Math.floor(gameSize.width / 2));
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, recenter);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, recenter);
    });

    this.scene.launch(SceneKeys.UI);
  }
}
