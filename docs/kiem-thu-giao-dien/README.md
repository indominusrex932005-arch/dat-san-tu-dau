# Kết quả và ảnh kiểm thử giao diện #32

Chạy lại ngày **26/10/2026** trên SHA `f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7`, Chrome in-app (UA Chrome/156.0.0.0), fixtures MongoDB local dùng một lần. Mỗi ảnh là viewport riêng; tên 1366/390 là kích thước viewport CSS được đặt, ảnh chụp bao phủ vùng nội dung browser. [Báo cáo kết quả và giới hạn](../KIEM_THU_GIAO_DIEN.md).

## Ảnh thực thi

| Ca | Desktop 1366×900 | Mobile 390×844 |
| --- | --- | --- |
| Trang chủ, điều hướng | [Trang chủ](review-2026-10-26/H01-home-1366.jpg), [focus bàn phím](review-2026-10-26/H01-home-keyboard-1366.jpg) | [Trang chủ](review-2026-10-26/H01-home-390.jpg), [focus bàn phím](review-2026-10-26/H01-home-keyboard-390.jpg), [cuộn cuối](review-2026-10-26/H01-home-bottom-390.jpg) |
| Cơ sở có dữ liệu/tên dài | [Card tên dài](review-2026-10-26/F01-facilities-long-1366.jpg) | [Card](review-2026-10-26/F01-facilities-long-390.jpg), [địa chỉ dài sau khi cuộn](review-2026-10-26/F03-long-scroll-390.jpg) |
| Cơ sở rỗng | [Ảnh](review-2026-10-26/F02-empty-1366.jpg) | [Ảnh](review-2026-10-26/F02-empty-390.jpg) |
| Đăng nhập/form | [Login](review-2026-10-26/L01-login-1366.jpg), [focus bàn phím](review-2026-10-26/L01-keyboard-submit-1366.jpg), [link đăng ký chủ](review-2026-10-26/L01-owner-register-link-1366.jpg), [link đăng ký khách](review-2026-10-26/L01-customer-register-link-1366.jpg), [đặt sân không login](review-2026-10-26/L01-guest-link-1366.jpg) | [Login](review-2026-10-26/L01-login-390.jpg) |
| Sai đăng nhập / OWNER | [Thông báo lỗi](review-2026-10-26/L04-login-error-1366.jpg) | [Thông báo lỗi](review-2026-10-26/L04-login-error-390.jpg), [OWNER đăng nhập](review-2026-10-26/L03-owner-login-390.jpg) |
| Điều hướng sau đăng nhập | [Khách](review-2026-10-26/H02-customer-nav-1366.jpg) | [OWNER](review-2026-10-26/H02-owner-nav-390.jpg) |
| Danh sách sân/bộ lọc | [Bộ lọc](review-2026-10-26/C01-courts-filter-1366.jpg), [giá và cảnh báo](review-2026-10-26/C01-prices-notice-long-1366.jpg), [kết quả](review-2026-10-26/C05-filter-applied-1366.jpg) | [Bộ lọc](review-2026-10-26/C01-courts-filter-390.jpg), [kết quả](review-2026-10-26/C05-filter-applied-390.jpg), [sân dài/focus](review-2026-10-26/C04-long-keyboard-390.jpg), [cảnh báo](review-2026-10-26/C02-missing-info-390.jpg) |
| Chi tiết sân/giá 30 phút | [Chọn thật 16:00 và 18:00, tổng 125.000đ](review-2026-10-26/C01-detail-selected-1366.jpg) | — |
| Không có sân | [Ảnh](review-2026-10-26/C03-empty-1366.jpg) | [Ảnh](review-2026-10-26/C03-empty-390.jpg) |
| Bộ lọc không khớp / lỗi input | — | [Không có kết quả](review-2026-10-26/C05-filter-no-results-390.jpg), [lỗi thông báo bị lặp](review-2026-10-26/BUG01-duplicate-filter-error-390.jpg) |
| Lỗi bộ lọc bị lặp | [Ảnh](review-2026-10-26/BUG01-duplicate-filter-error-1366.jpg) | [Ảnh](review-2026-10-26/BUG01-duplicate-filter-error-390.jpg) |

Ảnh gốc JPEG do browser capture trả về, không ghép/chỉnh sửa. Kích thước, thời điểm, URL, viewport đo được và SHA-256 nằm trong [browser observations](review-2026-10-26/browser-observations.json); hash và pixel dimensions của file trong [manifest](review-2026-10-26/screenshot-manifest.json). [Audit HTTP tối giản](review-2026-10-26/http-evidence.json) không chứa query, body, header, cookie, CSRF hoặc dữ liệu đăng nhập.

Ảnh ca sân rỗng/cơ sở rỗng được chụp sau khi xóa fixture **chỉ trong DB tạm local**; fixtures sau đó được dọn bằng drop database. Một lỗi UI BUG-01 được tái hiện và mô tả trong báo cáo để nhóm trưởng phân công.
