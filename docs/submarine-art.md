# Tàu ngầm theo ảnh mẫu

- Yêu cầu: thay tàu ngầm hiện tại bằng thiết kế trong ảnh người dùng gửi ngày 2026-11-04.
- Công cụ: `image_gen` tích hợp, nền trong suốt.
- Asset dùng trong game: `public/art/submarine.png` (48×48 RGBA), texture `robot` trong `src/data/art.json`.
- Chuẩn bị asset: cắt theo biên alpha ≥ 128, thu nhỏ nearest-neighbor vừa 46×46 và đặt giữa canvas trong suốt 48×48. Giữ alpha của ảnh tạo ra.
- Theo phản hồi người dùng, hiển thị rộng hơn 15% (`robot.displayScaleX = 1.15`), giữ nguyên chiều cao và ảnh gốc 48×48.
- Giới hạn di chuyển: `robot.halfWidth = 27`, `robot.halfHeight = 23` trong `balance.json`; giữ cách lật sprite theo hướng bơi hiện tại.

## Prompt tạo ảnh

```text
Use case: background-extraction. Asset type: transparent PNG player submarine sprite for a pixel-art game. Input image 1 is the edit target and exact design reference. Extract and faithfully recreate ONLY the small yellow submarine from the attached screenshot, remove all underwater scenery, rocks, plants, bubbles and the projected light beam. Preserve its compact almost round silhouette, facing RIGHT, the exact three-quarter side view, worn golden yellow armored hull with ochre rusty patches, purple dark metal framing and top periscope, rear left yellow fin, large dark blue glass cockpit on the right with pale blue white reflections, orange round mechanical housing at lower left and purple bumper below cockpit. Keep the reference proportions and recognizable design, with chunky crisp pixel-art edges and a limited palette, not smooth vector art or 3D rendering. Single isolated complete submarine centered, tightly framed with small transparent margin, no text, no additional items, no background, no shadow underneath. Actual transparent alpha background. Keep crisp details readable when displayed around 40x40 game pixels.
```
