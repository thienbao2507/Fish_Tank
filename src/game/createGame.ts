import Phaser from 'phaser';
import { GAME_HEIGHT } from '../config';
import { setContext, type GameContext } from './context';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { IsoPrototypeScene } from './scenes/IsoPrototypeScene';
import { PreloadScene } from './scenes/PreloadScene';
import { RoomPrototypeScene } from './scenes/RoomPrototypeScene';
import { UIScene } from './scenes/UIScene';
import { viewWidthFor } from './viewport';

/**
 * Mỗi khi khung hiển thị đổi kích thước, đổi chiều rộng logic theo tỉ lệ màn hình (spec 12.1).
 * setGameSize phát lại sự kiện RESIZE; lần đó chiều rộng đã khớp nên không lặp vô hạn.
 */
function keepWidthMatchingScreen(game: Phaser.Game): void {
  const scale = game.scale;
  scale.on(Phaser.Scale.Events.RESIZE, () => {
    const width = viewWidthFor(scale.parentSize.width, scale.parentSize.height);
    if (width !== scale.gameSize.width) {
      scale.setGameSize(width, GAME_HEIGHT);
    }
  });
}

export function createGame(ctx: GameContext): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: viewWidthFor(window.innerWidth, window.innerHeight),
    height: GAME_HEIGHT,
    backgroundColor: '#000000',
    // Nearest-neighbor, tắt khử răng cưa, làm tròn toạ độ pixel.
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      autoRound: true,
    },
    // Joystick (tay trái) và nút (tay phải) cùng lúc.
    input: { activePointers: 3 },
    callbacks: {
      // Gắn context trước khi scene nào chạy.
      preBoot: (game) => setContext(game, ctx),
      postBoot: keepWidthMatchingScreen,
    },
    // Thứ tự trong mảng = thứ tự vẽ: UI nằm trên Game.
    scene: [BootScene, PreloadScene, GameScene, UIScene, IsoPrototypeScene, RoomPrototypeScene],
  });
}
