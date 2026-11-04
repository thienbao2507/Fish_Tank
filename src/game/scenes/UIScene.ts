import Phaser from 'phaser';
import { SceneKeys } from './keys';

/** Lớp HUD chạy song song, vẽ đè lên GameScene. Nội dung HUD được thêm ở P1-07. */
export class UIScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.UI);
  }
}
