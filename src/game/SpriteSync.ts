export interface Destroyable {
  destroy(): void;
}

/**
 * Giữ một view (sprite…) cho mỗi phần tử trong danh sách của World, khớp theo `id`:
 * phần tử mới → tạo view, phần tử còn → cập nhật, phần tử đã mất → huỷ view.
 */
export class SpriteSync<T extends { readonly id: number }, V extends Destroyable> {
  private readonly views = new Map<number, V>();

  constructor(
    private readonly create: (item: T) => V,
    private readonly update: (view: V, item: T) => void,
  ) {}

  get size(): number {
    return this.views.size;
  }

  sync(items: readonly T[]): void {
    const seen = new Set<number>();
    for (const item of items) {
      seen.add(item.id);
      let view = this.views.get(item.id);
      if (!view) {
        view = this.create(item);
        this.views.set(item.id, view);
      }
      this.update(view, item);
    }
    for (const [id, view] of this.views) {
      if (!seen.has(id)) {
        view.destroy();
        this.views.delete(id);
      }
    }
  }
}
