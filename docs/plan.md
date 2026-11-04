# FishTank — Kế hoạch triển khai prototype

> Đặc tả: [spec.md](spec.md). File này là nguồn sự thật về **làm gì, theo thứ tự nào, khi nào là xong**.
> Trạng thái task: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong.

## 1. Quy tắc làm việc (chống "vibe code" lan man)

1. **Chỉ làm task có trong file này**, theo đúng thứ tự giai đoạn. Không làm trước task của giai đoạn sau.
2. **Ý tưởng phát sinh** → ghi vào [Backlog](#6-backlog) kèm lý do. Không làm ngay.
3. **Đổi thiết kế** → sửa `spec.md` trước, được duyệt, rồi mới sửa plan và code.
4. **Không thêm thư viện** ngoài [danh sách công nghệ](#2-quyết-định-kỹ-thuật) khi chưa hỏi.
5. **Mỗi task xong** phải: đạt tiêu chí hoàn thành (AC) của task; `npm run check` xanh; cập nhật trạng thái trong file này.
6. **Mỗi giai đoạn xong**: demo chạy được → người dùng duyệt → commit (message dạng `P1: <tóm tắt>`). Chưa duyệt thì không sang giai đoạn sau.
7. **Logic game nằm trong `src/core/`** (không import Phaser/DOM, có unit test). Scene/entity chỉ lo hiển thị và nhận input.
8. **Không hard-code số liệu** trong code; mọi số liệu ở `src/data/`.
9. **Không hard-code chuỗi hiển thị**; mọi chuỗi qua `t('key')` từ `src/data/strings.vi.json`.
10. Gặp vấn đề làm lệch kế hoạch (task quá lớn, thiết kế không khả thi) → dừng lại, báo và đề xuất cách xử lý, không tự đổi hướng.

## 2. Quyết định kỹ thuật

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Engine | Phaser **4.2.1** (khóa version) | Bản ổn định mới nhất trên npm |
| Ngôn ngữ | TypeScript, `strict: true` | Bắt lỗi sớm |
| Build / dev server | Vite | Tải lại nhanh, `--host` để test trên điện thoại qua Wi‑Fi |
| Unit test | Vitest | Chạy chung cấu hình với Vite |
| Lint / format | ESLint (typescript-eslint) + Prettier | Có rule chặn `src/core` import Phaser/DOM |
| Kiểm tra dữ liệu | zod | JSON sai → báo lỗi rõ ngay khi tải |
| Vật lý | Phaser Arcade Physics | Đủ cho va chạm/overlap 2D đơn giản |
| HUD, joystick | Vẽ bằng Phaser (scene UI chạy song song) | Đồng bộ với game, phản hồi chạm nhanh |
| Menu (shop, nhiệm vụ, offline) | DOM overlay (HTML/CSS) | Danh sách, cuộn, chữ dễ làm hơn; chạy tốt trong WebView |
| Độ phân giải logic | 960×540, `Scale.FIT` | 16:9 phổ biến; đổi được trong `config.ts` nếu chọn pixel art |
| Asset placeholder | Sinh texture bằng `Graphics.generateTexture` theo key | Thay sprite thật chỉ cần đổi manifest |
| Lưu game | Interface `Storage` → localStorage (web), Capacitor Preferences (Android, P6) | Không phải sửa logic khi lên Android |
| Đóng gói Android | Capacitor (P6) | |

## 3. Kiến trúc

```
src/
  main.ts            # tạo Phaser.Game
  config.ts          # độ phân giải, cờ debug
  core/              # LOGIC THUẦN — không import phaser, không đụng DOM
    content/         # tải + validate dữ liệu (zod), kiểu dữ liệu
    time/            # Clock (giờ thực + hệ số tua debug), Timer, offline
    economy/         # Wallet (xu, ngọc), giá, đổi ngọc
    sim/             # battery, cargo, water, fish, threats
    progress/        # zones unlock, quests, daily gift
    save/            # schema có version, migration
    events.ts        # EventBus có kiểu
    i18n.ts          # t('key')
  game/              # PHASER
    scenes/          # Boot, Preload, Game, UI
    entities/        # Robot, Fish, Trash, Bubble, Pest, Algae…
    systems/         # cầu nối core ↔ entity (đồng bộ trạng thái, phát sự kiện)
    input/           # joystick ảo, bàn phím (dev)
    art/             # manifest asset + bộ sinh texture placeholder
  ui/                # DOM overlay: shop, nhiệm vụ, màn offline
  platform/          # storage adapter (sau: ads/IAP stub)
  debug/             # panel debug
  data/              # JSON: balance, zones, fish, trash, threats, upgrades, items, quests, strings.vi
docs/                # spec.md, plan.md
```

**Luồng dữ liệu:** input → entity/system (Phaser) → gọi hàm trong `core` → `core` cập nhật state + phát event → system/HUD cập nhật hiển thị.
**Mở rộng nội dung:** thêm khu / loài cá / event = thêm bản ghi JSON (+ asset), không sửa code, trừ khi có cơ chế mới.

## 4. Định nghĩa "xong" (áp dụng mọi task)
- Đạt AC của task.
- `npm run check` (typecheck + lint + test) xanh.
- Không có lỗi trong console trình duyệt khi chơi phần vừa làm.
- Số liệu và chuỗi mới nằm trong `src/data/`.

## 5. Các giai đoạn

### P0 — Khởi tạo
Mục tiêu: dự án chạy được trên PC và điện thoại, có sẵn khung kiến trúc và công cụ kiểm tra.

- [ ] **P0-01** Khởi tạo Vite + TypeScript strict + Phaser 4.2.1. Scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `check`.
  AC: `npm run dev` mở trang; `npm run build` thành công.
- [ ] **P0-02** Tạo cấu trúc thư mục như mục 3. ESLint + Prettier; rule cấm `src/core/**` import `phaser` và dùng DOM.
  AC: thêm thử `import Phaser` vào `src/core` → `npm run lint` báo lỗi.
- [ ] **P0-03** Màn hình: 960×540, `Scale.FIT`, căn giữa; màn hình dọc → lớp phủ "Hãy xoay ngang thiết bị".
  AC: đúng tỉ lệ trên Chrome PC (thử nhiều kích thước cửa sổ) và trên điện thoại.
- [ ] **P0-04** Khung scene Boot → Preload → Game + UI (song song). Bộ sinh texture placeholder theo manifest.
  AC: thấy bể nền gradient, một robot placeholder ở giữa.
- [ ] **P0-05** Nền tảng `core`: Clock (giờ thực + hệ số tua), EventBus có kiểu, RNG có seed, i18n `t()`, content loader + zod.
  AC: unit test cho Clock, RNG; JSON sai kiểu → lỗi chỉ rõ file và trường.
- [ ] **P0-06** Panel debug (bật bằng `?debug=1`): FPS, tua thời gian ×1/×10/×100, cộng xu/ngọc, xóa save.
  AC: không có `?debug=1` thì không hiện.
- [ ] **P0-07** `CLAUDE.md` (lệnh, kiến trúc, quy tắc làm việc trỏ về file này), `README.md` ngắn (cách chạy).
  AC: làm theo README chạy được từ máy sạch.

Demo P0: `npm run dev -- --host` → mở trên Chrome PC và Chrome điện thoại cùng Wi‑Fi.

### P1 — Robot và dọn rác
Mục tiêu: vòng lặp tối thiểu "dọn rác → về trạm → đổi xu".

- [ ] **P1-01** Khu 1 (dữ liệu zone): kích thước thế giới, biên bể, mặt nước, đáy cát; camera bám robot, giới hạn trong khu.
  AC: robot không ra ngoài bể; camera không lộ ngoài biên.
- [ ] **P1-02** Joystick ảo 8 hướng (nửa trái màn hình, hiện tại chỗ chạm) + WASD/mũi tên cho dev. Robot bơi 8 hướng, có quán tính nhẹ, quay mặt theo hướng.
  AC: điều khiển được trên điện thoại bằng một ngón; nhả tay thì robot trôi chậm lại.
- [ ] **P1-03** Rác: loại rác trong `trash.json` (nổi / lơ lửng / chìm, giá trị xu, số ô chiếm trong khoang). Bộ sinh rác theo khu, có trần số lượng, luôn sinh lại.
  AC: rác ở đúng tầng nước theo loại; dọn hết thì rác sinh lại.
- [ ] **P1-04** Pin (`core/sim/battery`) + chế độ hút: nút bật/tắt, bán kính hút, rác bị kéo về robot, hút tốn pin, pin 0 → hút tự tắt.
  AC: unit test pin; trên game, pin giảm chỉ khi hút đang bật.
- [ ] **P1-05** Khoang chứa (`core/sim/cargo`): sức chứa theo ô; đầy → ngừng hút + thông báo.
  AC: unit test cargo; HUD hiện `x/y` đúng.
- [ ] **P1-06** Trạm tái chế: robot vào vùng trạm → đổi rác thành xu (`core/economy/wallet`), sạc pin (bản đơn giản theo thời gian).
  AC: unit test wallet (không âm, cộng/trừ đúng); xu tăng đúng tổng giá trị rác.
- [ ] **P1-07** HUD: thanh pin, khoang, xu, ngọc; nút Hút có trạng thái bật/tắt rõ ràng.
  AC: HUD cập nhật ngay khi giá trị đổi; không che joystick và cụm nút.

Demo P1: chơi trọn vòng dọn → đổi xu trên điện thoại.

### P2 — Cá và nước
Mục tiêu: cá sống trong bể, phản ứng với nước bẩn và việc chăm sóc.

- [ ] **P2-01** Độ sạch nước theo khu (`core/sim/water`): giảm theo rác, thức ăn thừa (tảo thêm ở P4); tự hồi chậm khi sạch.
  AC: unit test công thức; hiển thị độ sạch trên HUD (tạm thời).
- [ ] **P2-02** `fish.json`: 3 loài (giá, tốc độ đói, độ nhạy nước, xu/chu kỳ, tỉ lệ ngọc, thời gian lớn).
  AC: loader validate đủ trường.
- [ ] **P2-03** Cá bơi: đi lang thang trong khu, tránh biên, bơi tới thức ăn gần nhất.
  AC: cá không kẹt ở biên/góc; nhìn tự nhiên.
- [ ] **P2-04** Máy trạng thái cá (`core/sim/fish`): No, Bệnh, Vui → Buồn → Ốm → cảnh báo + đếm ngược → nhảy khỏi bể; nước sạch thì hồi phục dần.
  AC: unit test mọi chuyển trạng thái; cá nhảy ra có hiệu ứng và bị xóa khỏi save.
- [ ] **P2-05** Nút Thức ăn: tốn xu, viên thức ăn chìm dần, cá ăn; thừa rơi xuống đáy → làm bẩn nước, tan sau một thời gian.
  AC: cho ăn quá nhiều làm độ sạch giảm thấy rõ.
- [ ] **P2-06** Nút Thuốc: tốn xu, chữa cá ốm gần robot nhất trong bán kính.
  AC: không có cá ốm trong bán kính → nút mờ, không trừ xu.
- [ ] **P2-07** Cá vui sinh xu (tỉ lệ nhỏ ra ngọc), rơi ra; robot chạm là nhặt; quá thời gian → tự cộng 50%.
  AC: unit test tỉ lệ (RNG seed) và quy tắc 50%.
- [ ] **P2-08** Cảnh báo: icon trên đầu cá; mũi tên ở mép màn hình khi cá ngoài tầm nhìn.
  AC: mũi tên chỉ đúng hướng, biến mất khi cá vào khung hình.
- [ ] **P2-09** Trạng thái khởi đầu game mới (số liệu trong `balance.json`): vài cá loài rẻ ở khu 1, ít xu.
  AC: game mới luôn chơi được ngay.

Demo P2: bỏ bê thì cá buồn → ốm → bỏ đi; chăm tốt thì cá sinh xu.

### P3 — Kinh tế và shop
Mục tiêu: có đủ vòng chi tiêu và nâng cấp, có thời gian chờ và tua bằng ngọc.

- [ ] **P3-01** Hệ thống bộ đếm (`core/time/timers`): lưu bằng mốc thời gian (bắt đầu + thời lượng), tự hoàn tất khi offline; giá tua bằng ngọc theo thời gian còn lại.
  AC: unit test (kể cả trường hợp đóng game rồi mở lại sau thời lượng).
- [ ] **P3-02** Khung shop (DOM overlay), mở khi robot ở trạm; các tab Robot / Thiết bị / Cá / Vật phẩm / Đổi ngọc.
  AC: mở/đóng được trên điện thoại; game tạm dừng khi shop mở.
- [ ] **P3-03** Nâng cấp Lv1–5 trong `upgrades.json` (giá, thời gian, hiệu ứng): khoang chứa, tốc độ bơi, máy hút. Nâng cấp mất thời gian chờ.
  AC: unit test áp dụng hiệu ứng theo cấp; hiệu ứng thấy được trong game.
- [ ] **P3-04** Pin theo loại, bộ sạc ở trạm (tốc độ sạc), sạc dự phòng (vật phẩm + nút dùng). Sạc ở trạm thay bằng bản dùng bộ đếm.
  AC: đổi pin thì dung lượng đổi; rời trạm giữa chừng giữ phần đã sạc.
- [ ] **P3-05** Thiết bị đặt vào vị trí có sẵn: máy lọc, máy cho ăn tự động, trạm sạc phụ, san hô; Lv1–5; lắp mất thời gian.
  AC: mỗi thiết bị có tác động đo được (lọc → nước bẩn chậm hơn; san hô → cá vui hơn…).
- [ ] **P3-06** Mua cá: thả cá con vào khu, thời gian làm quen/lớn rồi mới sinh xu.
  AC: không mua được khi khu đã đủ sức chứa.
- [ ] **P3-07** Đổi ngọc → xu (1:1000) và tua thời gian bằng ngọc.
  AC: unit test; không có đường đổi xu → ngọc.

Demo P3: kiếm xu → nâng cấp → thấy robot/bể tốt lên; tua bằng ngọc hoạt động.

### P4 — Mối đe dọa
- [ ] **P4-01** Hệ thống event/mối đe dọa theo `threats.json` (khu, lịch, cường độ, thời gian báo trước).
  AC: thêm một event mới chỉ bằng JSON.
- [ ] **P4-02** Đợt rác tràn: báo trước → rác đổ vào khu.
- [ ] **P4-03** Tảo độc: mọc ở điểm định sẵn, lan theo thời gian, giảm độ sạch nước, dọn bằng hút.
- [ ] **P4-04** Sinh vật gây hại: di chuyển, làm cá sợ / lây bệnh.
- [ ] **P4-05** Súng bong bóng: nút Bắn, theo hướng mặt, tốn pin, nhốt sinh vật → nổi lên → biến mất; xuyên qua cá; không tác dụng với tảo.
- [ ] **P4-06** Unit test cho lịch event, lan tảo, lây bệnh.

AC chung P4: bỏ qua mối đe dọa → nước bẩn nhanh hơn, cá buồn; xử lý xong → bể hồi phục.

### P5 — Thế giới và tiến trình
- [ ] **P5-01** 3 khu nối ngang trong `zones.json` (kích thước, rác, mối đe dọa, vị trí thiết bị, sức chứa cá). Camera giới hạn theo khu đã mở.
- [ ] **P5-02** Mở khu: khu trước sạch ≥ X% + trả xu + bộ đếm; cửa thông khu mở ra.
- [ ] **P5-03** Cá cố định trong khu được thả; sức chứa theo khu.
- [ ] **P5-04** Nhiệm vụ: 5–10 nhiệm vụ trong `quests.json`, màn danh sách, nhận thưởng xu/ngọc.
- [ ] **P5-05** Quà hằng ngày.
- [ ] **P5-06** Lưu/tải: tự động lưu (định kỳ, khi app ẩn, sau mỗi giao dịch); schema có version + migration.
  AC: unit test migration; tải lại trang → trạng thái giữ nguyên.
- [ ] **P5-07** Tiến trình offline: khi mở lại, hoàn tất bộ đếm, cộng xu cá (có trần); màn "Trong lúc bạn vắng mặt".
  AC: tắt game, tua bằng debug/giả lập thời gian → kết quả đúng quy tắc offline.

Demo P5: chơi từ game mới tới mở được khu 3; tắt mở lại không mất gì.

### P6 — Hoàn thiện và Android
- [ ] **P6-01** Hiệu ứng âm thanh (hút, bắn, nhặt xu, cảnh báo), nút tắt/bật tiếng, mở khóa audio ở lần chạm đầu.
- [ ] **P6-02** Rà soát `balance.json`, chơi thử và chỉnh số cùng người dùng.
- [ ] **P6-03** Hiệu năng: object pooling cho rác, bong bóng, xu; kiểm tra trên máy Android thật.
- [ ] **P6-04** Capacitor Android: người dùng cài Android Studio + JDK mới (máy hiện có JDK 11, chưa có Android SDK/adb) theo hướng dẫn; thêm platform; storage adapter Capacitor; build APK debug.
- [ ] **P6-05** Hành vi Android: nút Back, tạm dừng khi app vào nền, lưu khi thoát.

Demo P6: cài APK lên máy Android, chơi trọn vòng.

## 6. Backlog
Ý tưởng phát sinh trong lúc làm, **chưa** nằm trong phạm vi. Chỉ đưa vào giai đoạn khi người dùng duyệt.

| Ý tưởng | Lý do | Ngày ghi |
|---|---|---|
| | | |

## 7. Ngoài phạm vi prototype
Xem [spec.md mục 15](spec.md#15-ngoài-phạm-vi-prototype).
