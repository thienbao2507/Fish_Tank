# FishTank — Đặc tả prototype v0.1

> Chốt yêu cầu: 2026-11-04. Mọi thay đổi thiết kế phải sửa file này trước và được duyệt, rồi mới sửa code.
> Kế hoạch triển khai: [plan.md](plan.md).

## 1. Tổng quan

| Mục | Nội dung |
|---|---|
| Thể loại | Quản lý bể cá có hành động, 2D, góc nhìn mặt cắt ngang bể (side view) |
| Vai trò người chơi | Điều khiển một robot dọn bể trong một bể cá đang ô nhiễm |
| Nền tảng đích | Android, màn hình ngang (landscape). Giai đoạn phát triển chạy và test trên trình duyệt |
| Mục tiêu trước mắt | Prototype chạy local, core loop hoàn chỉnh |
| Mục tiêu dài hạn | Game thương mại trên store |
| Nhân lực | 1 người (solo) |

## 2. Core loop

Bơi ra khu → bật hút dọn rác → khoang đầy / pin cạn → về trạm: rác đổi thành xu, sạc pin → mua cá / thức ăn / thuốc, nâng cấp, lắp thiết bị → bể sạch, cá vui sinh xu (đôi khi ngọc trai) → đủ điều kiện mở khu mới.

- Không có màn, không có khái niệm "lượt". Tiến trình lưu liên tục.
- Không có game over. Không có cơ chế nào trừ tiền người chơi đã có.

## 3. Robot

### 3.1 Điều khiển
- Bên trái: joystick ảo 8 hướng.
- Bên phải: các nút **Hút** (bật/tắt), **Bắn**, **Thức ăn**, **Thuốc**, **Sạc dự phòng**.

### 3.2 Hút và khoang chứa
- Chế độ hút bật/tắt bằng một lần chạm. Khi bật, robot tự hút rác trong bán kính quanh mình.
- Rác hút được nằm trong **khoang chứa** (có sức chứa giới hạn). Khoang đầy thì không hút thêm.
- Phải về **trạm tái chế** thì rác mới đổi thành xu.

### 3.3 Pin
| Hành động | Tốn pin |
|---|---|
| Bơi | Không |
| Hút | Nhiều |
| Bắn bong bóng | Ít (mỗi phát) |
| Thả thức ăn, cho thuốc | Không (tốn xu/vật phẩm) |

- Pin về 0: hút và bắn tự tắt; robot vẫn bơi, cho ăn, cho thuốc được. Không có hình phạt.
- **Loại pin**: mua pin loại khác (S / M / L / XL…) để tăng dung lượng.
- **Sạc ở trạm**: robot phải đậu ở trạm mới sạc; sạc mất thời gian; rời đi giữa chừng thì giữ phần đã sạc. Trong lúc sạc vẫn mở shop được.
- **Bộ sạc ở trạm**: mua loại tốt hơn để sạc nhanh hơn.
- **Sạc dự phòng**: vật phẩm tiêu hao, nhiều loại (mức nạp khác nhau), dùng ngay giữa bể.

### 3.4 Súng bong bóng
- Bắn theo hướng robot đang quay mặt.
- Trúng sinh vật gây hại: nhốt trong bong bóng → bong bóng nổi lên mặt nước → biến mất.
- Bong bóng đi xuyên qua cá, không gây hại. Không có tác dụng với tảo độc.

## 4. Cá và nước

### 4.1 Nước
- Mỗi khu có **Độ sạch nước** 0–100%. Rác, tảo độc, thức ăn thừa làm chỉ số giảm.

### 4.2 Trạng thái cá
- Mỗi cá có thanh **No** và trạng thái **Bệnh**.
- Tâm trạng: **Vui → Buồn → Ốm → (cảnh báo + đếm ngược) → nhảy khỏi bể, mất hẳn**.
- Bệnh do nước bẩn kéo dài hoặc do sinh vật gây hại. Nước sạch lại thì cá tự hồi phục dần; cho thuốc thì khỏi nhanh.
- Cá ốm có cảnh báo: icon trên đầu cá + mũi tên ở mép màn hình chỉ hướng cá (khi cá ngoài tầm nhìn).

### 4.3 Chăm sóc
- **Thức ăn**: tốn xu; thả ra chìm dần; cá bơi tới ăn. Thức ăn thừa rơi xuống đáy và làm bẩn nước.
- **Thuốc**: tốn xu; chữa cá ốm ở gần robot.

### 4.4 Cá sinh tài nguyên
- Cá vui sinh **xu**, tỉ lệ nhỏ sinh **ngọc trai**. Tài nguyên rơi ra; robot bơi chạm vào là nhặt (không cần bật hút).
- Không nhặt sau một thời gian → tự cộng **50%** giá trị vào tài khoản.

### 4.5 Loài, nguồn cá, sức chứa
- Prototype có **3 loài**: rẻ và dễ nuôi / trung bình / đắt và khó tính (sinh nhiều xu, tỉ lệ ngọc cao hơn).
- Cá mua bằng xu. Cá mua về là **cá con**, cần thời gian làm quen và lớn rồi mới sinh xu. Không có sinh sản.
- Mỗi khu có **giới hạn số cá**. Cá ở cố định trong khu được thả.

## 5. Mối đe dọa
| Loại | Mô tả | Cách xử lý |
|---|---|---|
| Đợt rác tràn | Định kỳ, có báo trước, rác đổ vào khu | Hút |
| Tảo độc | Mọc trên đá/kính, lan dần, làm bẩn nước | Hút |
| Sinh vật gây hại | Di chuyển, làm cá sợ hoặc lây bệnh | Súng bong bóng |

- Bỏ qua mối đe dọa: nước bẩn nhanh hơn, cá buồn / ốm.
- Rác luôn sinh lại theo thời gian để người chơi luôn kiếm được xu (không bao giờ bị kẹt).

## 6. Kinh tế
### 6.1 Xu (tiền chính)
- Nguồn: tái chế rác, cá sinh ra, offline.
- Dùng cho mọi thứ: cá, thức ăn, thuốc, nâng cấp, thiết bị, pin, bộ sạc, sạc dự phòng, mở khu.

### 6.2 Ngọc trai (tiền premium)
- Đổi **một chiều**: 1 ngọc = 1000 xu. Không đổi xu ra ngọc.
- Dùng để tua nhanh thời gian chờ.
- Nguồn trong prototype: cá nhả (hiếm), quà hằng ngày, phần thưởng nhiệm vụ.
- Sau prototype: quảng cáo thưởng, mua vật phẩm (chưa làm; chừa sẵn chỗ trong kiến trúc).

## 7. Nâng cấp và thiết bị
| Nhóm | Mục | Kiểu |
|---|---|---|
| Robot | Khoang chứa, tốc độ bơi, máy hút (bán kính + tốc độ hút) | Lv1 → Lv5 |
| Robot | Pin | Mua loại pin |
| Trạm | Bộ sạc | Mua loại bộ sạc |
| Thiết bị bể | Máy lọc nước, máy cho ăn tự động, trạm sạc phụ, san hô/trang trí | Lv1 → Lv5 |

- Mua / nâng cấp qua shop khi robot ở trạm.
- Thiết bị đặt vào các **vị trí có sẵn** trong mỗi khu.
- Nâng cấp và lắp đặt mất thời gian chờ.

## 8. Bản đồ và khu vực
- Một bể lớn cố định, **3 khu nối theo chiều ngang**, mỗi khu rộng khoảng 2 màn hình:

| Khu | Đặc trưng | Mối đe dọa giới thiệu |
|---|---|---|
| 1. Đáy cát | Trạm chính, khu khởi đầu | Đợt rác tràn |
| 2. Rạn đá | | Tảo độc |
| 3. Hang tối | | Sinh vật gây hại |

- Mở khu mới: khu trước sạch ≥ X% + trả xu + chờ thời gian.
- Mở khu mang lại thêm chỗ nuôi cá, vị trí đặt thiết bị, rác giá trị hơn.

## 9. Thời gian và offline
- Bộ đếm theo **giờ thực**, vẫn chạy khi tắt game: sạc pin, nâng cấp / lắp thiết bị, cá làm quen / lớn, mở khu.
- Offline **chỉ có lợi**: cá sinh xu (có trần), không đói, không ốm, không bỏ đi.
- Rủi ro người chơi chỉnh giờ máy: chấp nhận ở prototype; xử lý khi có monetization.

## 10. Nhiệm vụ và quà hằng ngày
- 5–10 nhiệm vụ (ví dụ: "Dọn 50 rác", "Chữa 3 con cá"), khai báo bằng dữ liệu, có màn hình danh sách đơn giản; thưởng xu / ngọc.
- Quà hằng ngày: thưởng khi mở game mỗi ngày.

## 11. UI / HUD
- Màn hình ngang. Màn hình dọc → hiện thông báo yêu cầu xoay ngang.
- Dưới trái: joystick. Dưới phải: cụm nút (Hút to nhất; quanh là Bắn, Thức ăn, Thuốc, Sạc dự phòng).
- Mép trên: thanh pin, khoang (dạng `12/20`), xu, ngọc trai.
- Theo dõi cá gặp nguy: icon trên đầu cá + mũi tên ở mép màn hình. Không có minimap.
- Ngôn ngữ prototype: **tiếng Việt**. Mọi chuỗi hiển thị nằm trong file ngôn ngữ riêng.

## 12. Đồ họa và âm thanh
- Prototype: hình khối placeholder. Asset gọi qua tên khóa để thay sprite không phải sửa logic.
- Âm thanh prototype: vài hiệu ứng cơ bản (hút, bắn, nhặt xu, cảnh báo); chưa có nhạc nền.

## 13. Lưu game
- Tự động lưu trên máy, 1 slot. Dữ liệu lưu có số phiên bản để nâng cấp định dạng về sau.
- Không tài khoản, không online, không chat. Ràng buộc app trẻ em: **không áp dụng**.

## 14. Số liệu
- Mọi số liệu (giá, dung lượng pin, thời gian chờ, tốc độ đói, tỉ lệ ngọc, ngưỡng X%…) nằm trong `src/data/`, đặt tạm và chỉnh khi chơi thử (giai đoạn P6).

## 15. Ngoài phạm vi prototype
Quảng cáo, mua hàng trong app, store, online, lưu đám mây, độ khó, iOS, nhiều ngôn ngữ, chống chỉnh giờ máy, sinh sản cá, nhạc nền.

## 16. Quyết định còn mở
| Mục | Hạn chót |
|---|---|
| Phong cách đồ họa cuối (pixel art hay vector) và kích thước sprite | Trước khi bắt đầu làm asset thật (sau prototype) |
| "Mua vật phẩm được ngọc trai" là nạp tiền thật hay quà khi mua trong game | Khi làm monetization |
