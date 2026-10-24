# Bằng chứng và kết quả kiểm thử luồng đặt sân #33

Thực thi kiểm thử toàn luồng đặt sân ngày **24/10/2026**. Ứng dụng thực chạy trên nền tích hợp mới nhất của `main`.
Báo cáo kiểm thử chi tiết từng ca nằm tại [`../KIEM_THU_LUONG_DAT_SAN.md`](../KIEM_THU_LUONG_DAT_SAN.md).

## Danh mục ảnh minh chứng thực tế

| Ca kiểm thử | Desktop 1366 × 900 | Mobile 390 × 844 |
| --- | --- | --- |
| **Ca 1: Khách đăng nhập / lịch sử đơn** | [Ảnh Desktop](C01-dang-nhap-1366.png) | [Ảnh Mobile](C01-dang-nhap-390.png) |
| **Ca 2: OWNER quản lý cơ sở và sân** | [Ảnh Desktop](C02-owner-facility-1366.jpg) | [Ảnh Mobile](C02-owner-facility-390.jpg) |
| **Ca 3: Chọn 2 ô giờ thường & cao điểm** | [Ảnh Desktop](C03-chon-o-1366.jpg) | [Ảnh Mobile](C03-chon-o-390.jpg) |
| **Ca 4: Tranh ô đồng thời (Conflict 409)** | [Ảnh Desktop](C04-tranh-o-1366.jpg) | [Ảnh Mobile](C04-tranh-o-390.jpg) |
| **Ca 5: Giữ chỗ & đồng hồ countdown 10 phút** | [Ảnh Desktop](C05-checkout-countdown-1366.jpg) | [Ảnh Mobile](C05-checkout-countdown-390.jpg) |
| **Ca 5 (Hết hạn): Đơn hết hạn & giải phóng** | [Ảnh Countdown hết hạn](C05-countdown-het-han-390.jpg) | [Ảnh Đơn hết hạn](C05-don-het-han-390.jpg) |
| **Ca 5b: Giữ sân sát giờ bắt đầu** | [Ảnh Desktop](C05b-sat-gio-1366.jpg) | [Ảnh Mobile](C05b-sat-gio-390.jpg) |
| **Ca 6: Thanh toán mô phỏng trong DEMO_MODE** | [Ảnh Desktop](C06-thanh-toan-mo-phong-1366.jpg) | [Ảnh Mobile](C06-thanh-toan-mo-phong-390.jpg) |
| **Ca 7: Quản lý yêu cầu đổi/hủy giờ** | [Ảnh Desktop](C07-yeu-cau-doi-huy-1366.jpg) | [Ảnh Mobile](C07-yeu-cau-doi-huy-390.jpg) |
| **Ca 8: Khách vãng lai nhập tên/SĐT đặt sân** | [Ảnh Desktop](C08-khach-vang-lai-1366.jpg) | [Ảnh Mobile](C08-khach-vang-lai-390.jpg) |
| **Ca 9: Phân quyền xem đơn (chặn 403)** | [Ảnh Desktop](C09-phan-quyen-chan-403-1366.jpg) | [Ảnh Mobile](C09-phan-quyen-chan-403-390.jpg) |

Toàn bộ ảnh minh chứng được chụp trực tiếp từ ứng dụng thực tế với database phát triển và session MongoDB.
