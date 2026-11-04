type Handler<T> = (payload: T) => void;

/**
 * Bus sự kiện có kiểu. `Events` là bảng { tên sự kiện: kiểu dữ liệu đi kèm }.
 * Các sự kiện của game được khai báo dần theo từng task (bắt đầu từ P1).
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
