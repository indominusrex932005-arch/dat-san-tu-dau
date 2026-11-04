# Kiểm tra ảnh cơ sở và sân — 05/11/2026

Nhánh `feat/anh-co-so-va-san`, nền `main@180a3c5`. Chỉ dùng MongoDB 8.0 replica set local dùng một lần, không đọc `.env` hoặc ghi Atlas của nhóm. Các tên/ảnh trên màn hình là dữ liệu tổng hợp.

## Kết quả

- `npm run check`: PASS, ESLint và 22 template EJS.
- `npm test`: **173/173 PASS**, không fail/skip. Bao gồm giữ chỗ, giá, quyền, hủy/đổi, giới hạn POST và kiểm thử ảnh/seed bổ sung.
- `npm audit --omit=dev`: 0 cảnh báo. Lockfile đã cập nhật bản vá body-parser 2.4.0 cho cảnh báo GHSA-27r3-jxmh-p828.
- 6 ca trình duyệt PASS trên Chromium headless/Playwright: 4 ảnh cơ sở tải được, không tràn ngang ở 1366/390px; chọn file/xem trước/tải và thấy ảnh đã lưu ở cả hai kích thước; ảnh cơ sở tải lên hiện trên trang chủ; ảnh sân mở lớn và đóng bằng Esc. [JSON và hash ảnh](browser-results.json).

| Màn hình | Desktop | Mobile |
|---|---|---|
| Trang chủ có 4 cơ sở, mỗi cơ sở một ảnh | [1366px](home-1366.png) | [390px](home-390.png) |
| Chủ sân quản lý ảnh đã tải | [1366px](owner-photo-1366.png) | [390px](owner-photo-390.png) |

## Phạm vi kiểm thử ảnh

Các ca HTTP dùng app/routes/controller, Multer, Sharp và MongoDB thật. Chỉ adapter Cloudinary được thay bằng storage local phía server, không mock quyền hay query. Các ca UI cũng dùng adapter này; URL hình trả về được trình duyệt phục vụ bằng file WebP đã xử lý. **Chưa gọi hoặc nghiệm thu Cloudinary thật** vì chưa có tài khoản/secret được cấu hình.

Đã thử: OWNER khác/CUSTOMER/CSRF thiếu bị chặn trước upload; SVG, file PNG giả, file quá 5 MB hoặc kèm trường lạ bị từ chối; ảnh được giải mã/đổi WebP/giới hạn kích thước; chọn ảnh bìa và kiểm tra trang chủ/danh sách; ảnh cơ sở/sân không dùng nhầm ID của nhau; hai upload tranh vị trí thứ năm không vượt 5; chỉ nhận hai upload đồng thời và giải phóng slot sau khi kết thúc; form giá lỗi vẫn giữ ảnh; thu hồi quyền khi upload đang chạy không lưu được ảnh; lỗi xóa storage giữ hàng đợi rồi thử lại thành công.

Seed được thử trên dữ liệu cũ đã đổi tên: thêm đúng 3 cơ sở, không đổi bản ghi cũ; chạy lại sau đổi tên, ảnh, giá không thêm trùng. Dữ liệu mẫu chưa được nhập trên Atlas thật trong lần bàn giao này. Các ca còn lại và cấu hình Cloudinary xem [hướng dẫn sử dụng](../HINH_ANH_CO_SO_VA_SAN.md).
