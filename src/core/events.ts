import type { StringKey, TranslateParams } from './i18n';

type Handler<T> = (payload: T) => void;

/** Các sự kiện của game. Thêm dần theo từng task. */
export interface GameEvents {
  /** Thông báo ngắn cho người chơi (HUD hiển thị). */
  toast: { key: StringKey; params?: TranslateParams };
  /** Đã đổi rác ở trạm; (x, y) là vị trí trong thế giới để hiện số xu bay lên. */
  'station:sold': { coins: number; x: number; y: number };
}

/**
 * Bus sự kiện có kiểu. `Events` là bảng { tên sự kiện: kiểu dữ liệu đi kèm }.
 */
export class EventBus<Events extends object> {
  private readonly handlers = new Map<keyof Events, Set<Handler<never>>>();

  /** Đăng ký; trả về hàm huỷ đăng ký. */
  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => this.off(type, handler);
  }

  off<K extends keyof Events>(type: K, handler: Handler<Events[K]>): void {
    this.handlers.get(type)?.delete(handler);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    // Sao chép để handler tự huỷ đăng ký trong lúc emit không làm lệch vòng lặp.
    for (const handler of [...set]) {
      (handler as Handler<Events[K]>)(payload);
    }
  }
}
