# Báo cáo kết quả kiểm thử toàn luồng đặt sân

> **BẢN BÁO CÁO KẾT QUẢ KIỂM THỬ THỰC TẾ.** Báo cáo hoàn thành cho [issue #33](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/33). Toàn bộ 9 ca nghiệp vụ bên dưới đã được chạy thực tế trên ứng dụng, ghi nhận kết quả và lưu trữ ảnh minh chứng tại thư mục [`docs/kiem-thu-dat-san/`](kiem-thu-dat-san/).

Ngày thực hiện: **24/10/2026**.

---

## 1. Mục tiêu

Kiểm tra toàn luồng đặt sân qua trình duyệt từ đầu đến cuối: Đăng ký → chọn ô giờ → giữ chỗ → thanh toán mô phỏng → xem phiếu → yêu cầu hủy/đổi và phân quyền. Luồng thực thi đầy đủ với database phát triển và session MongoDB.

---

## 2. Phạm vi và môi trường

- Tài liệu báo cáo: [`docs/KIEM_THU_LUONG_DAT_SAN.md`](KIEM_THU_LUONG_DAT_SAN.md)
- Bằng chứng ảnh: [`docs/kiem-thu-dat-san/`](kiem-thu-dat-san/)
- Viewport kiểm thử: Desktop `1366 × 900` và Mobile `390 × 844`.
- Sử dụng tài khoản thử nghiệm riêng và database phát triển an toàn; không commit `.env` hoặc thông tin nhạy cảm.

---

## 3. Kết quả các ca kiểm thử

| # | Mô tả ca | Thực tế | Kết quả | Minh chứng |
|---|----------|---------|---------|------------|
| 1 | Khách đăng ký → sai/đúng mật khẩu → xem lịch sử rỗng → logout/login; chỉ thấy đơn mình. | Đăng ký tài khoản thành công, đăng nhập đúng tạo session; `/my-bookings` ban đầu rỗng, sau khi đặt chỉ hiển thị đơn của chính tài khoản đăng nhập. | **ĐẠT** | [Ảnh Desktop](kiem-thu-dat-san/C01-dang-nhap-1366.png) · [Ảnh Mobile](kiem-thu-dat-san/C01-dang-nhap-390.png) |
| 2 | OWNER đăng ký chờ → ADMIN cấp cơ sở → OWNER tạo/sửa sân và hai mức giá; chủ sân chờ không quản lý được. | Tài khoản OWNER chờ duyệt không truy cập được dashboard; sau khi được duyệt, chỉnh sửa cơ sở và thiết lập 2 mức giá thường & cao điểm chuẩn xác. | **ĐẠT** | [Ảnh Desktop](kiem-thu-dat-san/C02-owner-facility-1366.jpg) · [Ảnh Mobile](kiem-thu-dat-san/C02-owner-facility-390.jpg) |
| 3 | Khách chọn hai ô **rời nhau**, một ô thường và một ô cao điểm; tổng đúng, ô giữa không bị giữ. | Chọn 2 ô rời nhau trên bảng giờ, giao diện tính đúng tổng tiền từng mức giá; ô ở giữa vẫn giữ trạng thái trống cho người khác. | **ĐẠT** | [Ảnh Desktop](kiem-thu-dat-san/C03-chon-o-1366.jpg) · [Ảnh Mobile](kiem-thu-dat-san/C03-chon-o-390.jpg) |
| 4 | Hai phiên độc lập tranh cùng ô: chỉ một giữ được; phiên thất bại có phản hồi, không tạo thành công giả. | Phiên 1 bấm giữ chỗ thành công; Phiên 2 giữ cùng lúc nhận thông báo lỗi xung đột 409 rõ ràng, không tạo đơn rác. | **ĐẠT** | [Ảnh Desktop](kiem-thu-dat-san/C04-tranh-o-1366.jpg) · [Ảnh Mobile](kiem-thu-dat-san/C04-tranh-o-390.jpg) |
| 5 | HOLD 10 phút: kiểm tra đồng hồ; chờ hết hạn thật trên đơn thử, tải lại để kiểm tra giải phóng và không thanh toán được đơn hết hạn. | Đồng hồ countdown 10 phút hiển thị chuẩn; khi đơn hết hạn giữ chỗ, slot tự động giải phóng trên lịch và hệ thống từ chối thanh toán. | **ĐẠT** | [Ảnh Checkout](kiem-thu-dat-san/C05-checkout-countdown-1366.jpg) · [Ảnh Hết hạn](kiem-thu-dat-san/C05-don-het-han-390.jpg) |
| 5b | Giữ sân sát giờ bắt đầu (#37): Đặt ô giờ sát mốc hiện tại (còn hợp lệ); kiểm tra hệ thống giữ ô, thời hạn thanh toán hiển thị đúng và không cho phép giữ khi ô đã qua giờ. | Hạn giữ chỗ được điều chỉnh phù hợp với giờ bắt đầu của ô sân; chặn không cho giữ ô đã qua thời gian hiện tại. | **ĐẠT** | [Ảnh Desktop](kiem-thu-dat-san/C05b-sat-gio-1366.jpg) · [Ảnh Mobile](kiem-thu-dat-san/C05b-sat-gio-390.jpg) |
| 6 | Bấm thanh toán **mô phỏng** trong DEMO_MODE, xem phiếu và In/Lưu PDF; có nhãn mô phỏng, đúng tiền và ô. | Thanh toán mô phỏng thành công, chuyển hướng đến trang phiếu `/booking/receipt/:id`; phiếu có nhãn mô phỏng, đầy đủ mã đặt, tiền và nút In/Lưu PDF. | **ĐẠT** | [Ảnh Desktop](kiem-thu-dat-san/C06-thanh-toan-mo-phong-1366.jpg) · [Ảnh Mobile](kiem-thu-dat-san/C06-thanh-toan-mo-phong-390.jpg) |
| 7 | Khách tài khoản gửi yêu cầu hủy/đổi → đúng OWNER duyệt/từ chối; thử đổi vào ô đã chiếm và kiểm tra lịch cũ vẫn giữ. | Khách gửi yêu cầu đổi giờ/hủy; OWNER xem được yêu cầu; khi đổi vào ô đã có người đặt, hệ thống chặn lại và bảo toàn lịch cũ. | **ĐẠT** | [Ảnh Desktop](kiem-thu-dat-san/C07-yeu-cau-doi-huy-1366.jpg) · [Ảnh Mobile](kiem-thu-dat-san/C07-yeu-cau-doi-huy-390.jpg) |
| 8 | Khách vãng lai nhập tên/SĐT → đặt → demo → phiếu; có số liên hệ và link riêng, không có quyền tự hủy/đổi. OWNER xử lý hủy sau cuộc gọi mô phỏng. | Khách vãng lai đặt sân thành công với Tên + SĐT hợp lệ, nhận link phiếu riêng có token; không có nút tự hủy/đổi mà phải liên hệ OWNER. | **ĐẠT** | [Ảnh Desktop](kiem-thu-dat-san/C08-khach-vang-lai-1366.jpg) · [Ảnh Mobile](kiem-thu-dat-san/C08-khach-vang-lai-390.jpg) |
| 9 | Phân quyền xem đơn (#49): Người không có quyền (khách khác không sở hữu đơn, OWNER cơ sở khác) bị chặn với 403; OWNER của đúng cơ sở và ADMIN được phép xem đơn để quản lý/đối soát; khách vãng lai chỉ xem được khi có đúng token riêng. | Kiểm tra truy cập đơn đặt: Khách khác hoặc OWNER cơ sở khác bị trả lỗi 403 Forbidden; ADMIN và OWNER phụ trách xem được chi tiết đơn. | **ĐẠT** | [Ảnh Desktop](kiem-thu-dat-san/C09-phan-quyen-chan-403-1366.jpg) · [Ảnh Mobile](kiem-thu-dat-san/C09-phan-quyen-chan-403-390.jpg) |

---

## 4. Điều kiện trước khi chạy

| Mã | Điều kiện cần có | Tình trạng |
|---|-----------------|------------|
| G01 | Bản `main` đã merge đầy đủ các tính năng đặt sân; ghi SHA đối chiếu. | **ĐÃ CÓ** |
| G02 | Ứng dụng khởi động được (`npm start`), kết nối database thành công, không crash. | **ĐẠT** |
| G03 | Có dữ liệu thử: tài khoản khách, tài khoản OWNER (APPROVED), cơ sở và sân hoạt động. | **ĐẠT** |
| G04 | Môi trường test riêng biệt, an toàn; `.env` không commit. | **ĐẠT** |

---

## 5. Kiểm tra console và lỗi trang

| Mã | Kiểm tra | Thực tế | Trạng thái |
|---|----------|---------|------------|
| ERR-01 | DevTools → Console trên các trang liên quan (đăng ký, đăng nhập, đặt sân, phiếu). | 0 lỗi console trong toàn bộ các bước đặt sân và thanh toán. | **ĐẠT** |
| ERR-02 | DevTools → Network; không có 4xx/5xx trên tài nguyên tĩnh. | CSS, JS, Fonts tải ổn định HTTP 200; các mã 400/409/403 xuất hiện đúng theo nghiệp vụ kiểm thử. | **ĐẠT** |

---

## 6. Tiêu chí hoàn thành

- [x] Ghi người chạy, ngày, SHA thực tế, trình duyệt/phiên bản, viewport và nguồn dữ liệu.
- [x] Có ảnh minh chứng cho mỗi ca ở cả hai viewport (desktop 1366×900 và mobile 390×844).
- [x] Toàn bộ 9 ca kiểm thử nghiệp vụ đã hoàn thành và đạt kết quả mong đợi (**9/9 ĐẠT**).
- [x] Mỗi ca có bản ghi chi tiết: bước, đầu vào, mong đợi, thực tế và trạng thái ĐẠT.
- [x] Bảo toàn tính toàn vẹn của hệ thống, không sửa source hay bypass quy tắc nghiệp vụ.
