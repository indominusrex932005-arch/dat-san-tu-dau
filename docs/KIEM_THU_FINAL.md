# Kiểm thử bản demo final — 07/11/2026

Nền: main `fed8ff0` sau PR #103. Nhánh bàn giao: `feat/demo-final-hoan-thien`.

| Kiểm tra | Kết quả |
|---|---|
| `npm ci` | Cài đặt thành công |
| `npm run check` | ESLint đạt; biên dịch 26 template EJS |
| `npm test` | 275/275 đạt, 0 lỗi, 0 bỏ qua |
| `npm audit --omit=dev` | 0 cảnh báo tại thời điểm kiểm tra; body-parser 2.4.0 |
| Chromium 1366×900 và 390×900 | Không tràn ngang toàn trang, không lỗi JavaScript trong các màn hình đã thử |
| Database kiểm thử | MongoDB 8 replica set cục bộ, DB tạm riêng; không dùng Atlas nhóm |

## Nghiệp vụ kiểm tra bổ sung

- Check-in: chặn sai chủ/cơ sở/khách/chủ chưa duyệt, thiếu CSRF, sai ngày, đúng mốc hết giờ, đơn chưa xác nhận/chưa thanh toán, đơn có yêu cầu đang chờ. Hai lần gửi cùng lúc chỉ giữ thời điểm/người ghi nhận đầu tiên. Không thay lock hoặc tạo tiền. Hủy/đổi bị chặn sau check-in.
- Báo cáo: chỉ tính INITIAL_DEMO/EXTRA_DEMO; loại intent và receipt QR, không lấy cơ sở khác. Hoàn ghi nhận theo ngày hoàn, khoản chờ chưa trừ. Kiểm tra ranh giới 00:00 Việt Nam, kỳ không có dữ liệu, tham số ngày lỗi và vượt 366 ngày.
- Phân trang: 25 đơn/25 yêu cầu chia 20+5; tổng yêu cầu chờ vẫn 25. Tra mã đơn chính xác, không thấy đơn cơ sở khác; lịch sử khách chỉ chứa đơn mình.
- Seed: dữ liệu hiện có giữ nguyên, có 2 thì thêm 2 để đạt 4; chạy lại không thêm. Có 5 thì giữ nguyên 5, không xóa.
- Lịch trống/gợi ý: lấy lock theo lô một truy vấn, không lẫn sân/ngày; dùng lại cùng kết quả khi tạo gợi ý.
- Toàn bộ kiểm thử thanh toán, hold/expiry, migration, auth, ảnh, webhook và đối soát trước đây chạy lại cùng các thay đổi mới.

## Thao tác trình duyệt thực tế

Trên laptop: trang chủ 4 cơ sở và ảnh minh họa; đăng nhập OWNER; xem báo cáo; xem form ảnh chưa cấu hình; check-in đơn đã thanh toán; phiếu sau check-in không còn nút hủy/đổi; CUSTOMER gửi yêu cầu hủy; OWNER duyệt khoản hoàn 10.000 đồng rồi ghi nhận; báo cáo phản ánh đúng; đăng xuất và đặt vãng lai → nút thanh toán mô phỏng → phiếu có nhãn mô phỏng.

Trên điện thoại: trang chủ, báo cáo, form ảnh và dashboard chủ sân; bốn ảnh minh họa tải được khi cuộn. Bảng báo cáo có vùng cuộn ngang riêng, không làm tràn cả trang. Font bên ngoài bị chặn trong bài thử để kiểm tra giao diện với font dự phòng.

Ảnh chụp và kết quả:

- [Trang chủ 4 cơ sở](kiem-thu-final/home-1366.png)
- [Báo cáo sau ghi nhận hoàn mô phỏng](kiem-thu-final/report-refunded-1366.png)
- [Báo cáo trên điện thoại](kiem-thu-final/report-initial-390.png)
- [Kết quả trình duyệt](kiem-thu-final/browser-results.json)

## Phạm vi chưa nghiệm thu

Không kết nối ngân hàng hoặc thanh toán tiền thật. Không có Cloudinary thật trong môi trường kiểm thử; upload/xóa ảnh kiểm tra qua storage thay thế và MongoDB thật cục bộ. Chưa kiểm tra hosting Render/HTTPS/proxy thực tế. Chưa chạy seed/migration hay ghi dữ liệu vào Atlas của nhóm. Các kết quả trên chứng minh hành vi đã thử, không có nghĩa hệ thống không thể còn lỗi.
