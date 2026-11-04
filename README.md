# FishTank

Game 2D cho mobile: điều khiển robot dọn một bể cá ô nhiễm, chăm sóc cá, nâng cấp robot và mở rộng bể. Đang ở giai đoạn prototype.

## Yêu cầu

- Node.js 22 trở lên

## Chạy

```bash
npm install
npm run dev
```

Mở http://localhost:5173. Thêm `?debug=1` (http://localhost:5173/?debug=1) để bật panel debug (FPS, giờ game, tua thời gian).

## Điều khiển

| | Điện thoại | Máy tính |
|---|---|---|
| Bơi | Chạm và kéo ở nửa trái màn hình (joystick hiện tại chỗ chạm) | `W A S D` hoặc phím mũi tên |
| Bật/tắt máy hút | Nút **Hút** góc dưới phải | `Space` |

Bơi vào **Trạm** (góc trái dưới) để đổi rác trong khoang lấy xu và sạc pin.

## Chơi thử trên điện thoại

1. Điện thoại và máy tính dùng chung một mạng Wi‑Fi.
2. Chạy `npm run dev:host`, lấy địa chỉ dòng `Network` ứng với Wi‑Fi (ví dụ `http://192.168.1.10:5173`).
3. Mở địa chỉ đó bằng Chrome trên điện thoại, cầm ngang máy.

Nếu Windows hỏi quyền tường lửa cho Node.js, chọn cho phép trên mạng riêng (Private).

## Kiểm tra và build

```bash
npm run check   # typecheck + lint + unit test
npm run build   # bản build vào dist/
```

## Tài liệu

- [Đặc tả](docs/spec.md)
- [Kế hoạch triển khai](docs/plan.md)
