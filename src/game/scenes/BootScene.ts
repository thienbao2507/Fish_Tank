import Phaser from 'phaser';
import { SceneKeys } from './keys';

/** Điểm khởi đầu. Sau này nạp những gì cần cho màn hình loading. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    this.scene.start(SceneKeys.Preload);
  }
}
