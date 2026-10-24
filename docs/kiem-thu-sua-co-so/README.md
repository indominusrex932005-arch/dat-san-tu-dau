# Ảnh và kết quả kiểm thử sửa cơ sở — #41

Ngày 24/10/2026, IAB 390×844 và 1366×900. Ứng dụng tại `b704f6cbcfe53e4781f329d41170e6f44b8bd11c`, dữ liệu tổng hợp cục bộ. Ảnh giữ nguyên bytes JPEG do trình duyệt xuất, không sửa giao diện bằng DOM hoặc chỉnh ảnh để làm ca đạt.

| Trạng thái | Mobile 390px | Desktop 1366px |
| --- | --- | --- |
| Mở form từ `/owner` | [Form thường](thuong-390.jpg) | [Form thường](thuong-1366.jpg) |
| SĐT sai, giữ chuỗi HTML dưới dạng văn bản | [Form lỗi](loi-390.jpg) | [Form lỗi](loi-1366.jpg) |
| Tên150 / địa chỉ500 ký tự liền | [Nội dung dài](noi-dung-dai-390.jpg) | [Nội dung dài](noi-dung-dai-1366.jpg) |
| Focus textarea bằng Tab/Shift+Tab | [Focus](focus-390.jpg) | [Focus](focus-1366.jpg) |
| Danh sách công khai không có nút sửa cơ sở | [Danh sách](danh-sach-cong-khai-390.jpg) | [Danh sách](danh-sach-cong-khai-1366.jpg) |

- [Báo cáo đầy đủ 66 HTTP +14 UI](../KIEM_THU_SUA_CO_SO.md)
- [HTTP/DB theo từng ca](http-results.json)
- [Trình duyệt theo từng ca](browser-results.json)
- [Snapshot và guest booking sau đổi SĐT](browser-db-results.json)
- [Fixture HTTP đã loại dữ liệu bí mật](fixtures.json)
- [Đối chiếu bản bàn giao/squash merge](source-comparison.json)
- [Test và cleanup](summary.json)
