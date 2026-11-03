# Bằng chứng kiểm thử tìm sân — #36

**Mới nhất:** [Tái kiểm thử main `5903881` sau #54](main-5903881/README.md), ngày 24/10/2026: **41/41 HTTP/DB PASS, 10/10 ca UI gốc PASS; BUG-01 PASS RETEST**. Có 13 ảnh, JSON/fixture mới, kết quả 111/111 test và số đo 390px/1366px. OBS-01/02 về thông báo lỗi vẫn còn và được ghi rõ trong báo cáo mới.

## Bằng chứng lịch sử trên SHA 30ee256

Đọc [báo cáo và bảng từng ca](../KIEM_THU_TIM_SAN.md). Chạy ngày **24/10/2026**, ứng dụng thật trên SHA `30ee256133ac87417481ccf52407281af9e385e7` (`feat/ui-courts-filter`, có backend #34 và UI #35). Đây không phải kết quả trên main sau merge tương lai.

| Trạng thái | Desktop 1366×900 | Mobile 390×844 |
| --- | --- | --- |
| Hai sân cơ sở B, tên dài, giữ bộ lọc | [Ảnh](thuong-desktop-1366.jpg) | [Ảnh](thuong-mobile-390.jpg) |
| Không có kết quả | [Ảnh](rong-desktop-1366.jpg) | [Ảnh](rong-mobile-390.jpg) |
| Giờ kết thúc trước bắt đầu | [Ảnh](loi-desktop-1366.jpg) | [Ảnh](loi-mobile-390.jpg) |
| Focus bằng bàn phím | [Ảnh](focus-desktop-1366.jpg) | [Ảnh](focus-mobile-390.jpg) |
| Chi tiết giữ đúng ngày; mobile có BUG-01 tràn ngang | [Ảnh](chi-tiet-desktop-1366.jpg) | [Ảnh lỗi](chi-tiet-mobile-390.jpg) |

Ảnh thường/rỗng/lỗi và chi tiết desktop chụp toàn trang. Focus và chi tiết mobile chụp viewport; scrollWidth/clientWidth được ghi trong JSON để đối chiếu, không suy ra viewport từ độ dài ảnh toàn trang.

- [http-results.json](http-results.json): 41 ca với bước, mong đợi, thực tế, trạng thái; số lượng/digest DB và ca hai session, không có HTML thô hoặc token.
- [browser-results.json](browser-results.json): 6 lần đo trang tìm kiếm (3 trạng thái × 2 viewport), chuỗi focus/thao tác và bằng chứng lỗi chi tiết.
- [fixtures.json](fixtures.json): ID/tên/giờ phục vụ thử và các chuỗi dài để tạo lại fixture. Tất cả là dữ liệu tổng hợp; DB đã xóa sau QA nên cần tạo ID mới khi chạy lại.

Không chứa mật khẩu, cookie, CSRF, connection string có thông tin đăng nhập hoặc link phiếu riêng. Thanh toán fixture chỉ là mô phỏng.
