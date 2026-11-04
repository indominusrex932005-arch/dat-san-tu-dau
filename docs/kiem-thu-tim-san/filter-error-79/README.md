# Phân biệt lỗi bộ lọc và kết quả rỗng (#79)

Kiểm thử ngày 04/11/2026 trên nền `main` tại `5c3e72d50a9802a1533a9ca7b17db0fb8fc3aa47`. Hai bản Express dùng cùng MongoDB 8.3.11 replica set cục bộ và dữ liệu tổng hợp. Chrome 156.0.8078.80 headless qua Playwright dùng CSS và tài nguyên cục bộ. [Kết quả từng ca, hash view và ảnh](browser-results.json)

## So sánh trước và sau

Chọn cơ sở thử, ngày 06/11/2026, giờ bắt đầu 18:00 và kết thúc 17:00. Dùng Enter trên nút **Tìm sân**. Cả hai bản trả HTTP 400 và hiện đúng một cảnh báo. Bản trước còn hiện số 0 và khối “Không tìm được sân phù hợp”. Bản sau giữ đủ bốn giá trị đã nhập, ẩn phần kết quả và gợi ý, đưa focus về ô **Cơ sở** và liên kết cảnh báo với ô này. Tab tiếp theo tới ô **Ngày**.

| Viewport | Trước | Sau |
| --- | --- | --- |
| 390×844 | [Ảnh mobile](before-invalid-390.png) | [Ảnh mobile](after-invalid-390.png) |
| 1366×900 | [Ảnh desktop](before-invalid-1366.png) | [Ảnh desktop](after-invalid-1366.png) |

## Các trạng thái hợp lệ

| Đầu vào | Kết quả ở cả hai viewport |
| --- | --- |
| Không chọn bộ lọc, DB chưa có sân | HTTP 200, hiện “Chưa có sân đang hoạt động”. |
| Lọc 17:00–18:00 ngày 06/11, ô 17:30 đã đặt | HTTP 200, hiện khối kết quả rỗng và một gợi ý. |
| Lọc 17:00–18:00 ngày 07/11, ô 17:00 đã đặt | HTTP 200, hiện khối kết quả rỗng và thông báo không có phương án thay thế. |
| Lọc 16:30–17:30 ngày 06/11, cả hai ô trống | HTTP 200, hiện một sân trong danh sách. |

12/12 lượt trình duyệt đạt, gồm cả đối chiếu bản trước. `npm run check` đạt ESLint và 19 template EJS. Bộ render liên quan đạt 12/12 và `npm test` đạt 159/159, 0 lỗi và 0 bỏ qua. DB thử đã được dọn.
