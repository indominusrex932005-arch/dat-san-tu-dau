# Bổ sung bằng chứng UI #65 — PR #73

Refs #65. Phụ thuộc PR #70 (backend #64); backend cần được chốt/merge trước khi nghiệm thu UI.

Ngày 27/10/2026, Codex thực thi theo yêu cầu của Triều. Source ứng dụng: `f056f19ff1a987a438bf2ffb4ed70d0c87974703`, tích hợp backend `30d0fa6`. Chỉ thêm bằng chứng sau SHA này. Node 24.15.0, MongoDB 8.3 replica set cục bộ cổng 27029, DB dùng một lần `booking_test_1793063240999_18116`; không đọc .env hoặc dùng Atlas. Trình duyệt Codex in-app qua CUA, chưa thu phiên bản engine.

Ứng dụng Express/controller/service/EJS/DB thật. Fixture tổng hợp gồm ba chủ đã duyệt, mỗi chủ một cơ sở và một sân tên dài; tạo HOLD thật chặn 17:00–18:00. Giờ phục vụ 16–20, 16–18, 17–18 lần lượt tạo 3/1/0 gợi ý cho ngày 02/11/2026. Fixture trực tiếp không chứng minh luồng ADMIN duyệt.

| Ca | Bằng chứng/kết quả |
| --- | --- |
| Ba phương án, tên dài | [390px](ui-goi-y-review-2026-10-27/three-390.png), [1366px](ui-goi-y-review-2026-10-27/three-1366.png): đọc được tên, cơ sở, ngày/giờ, 60 phút, tổng 100.000đ và lý do sớm/muộn; không tràn document |
| Một phương án | [390px](ui-goi-y-review-2026-10-27/one-390.png), [1366px](ui-goi-y-review-2026-10-27/one-1366.png) |
| Hết phương án | [390px](ui-goi-y-review-2026-10-27/empty-390.png), [1366px](ui-goi-y-review-2026-10-27/empty-1366.png): có lời mời đổi ngày/khoảng giờ |
| Query lỗi | [390px](ui-goi-y-review-2026-10-27/error-390.png), [1366px](ui-goi-y-review-2026-10-27/error-1366.png): Cơ sở không hợp lệ, không có thẻ gợi ý |
| Tab/Enter | Tab từ link xóa bộ lọc đến Xem lịch đầu tiên; viền focus rõ [390px](ui-goi-y-review-2026-10-27/focus-390.png), [1366px](ui-goi-y-review-2026-10-27/focus-1366.png). Enter mở đúng courtId/date, chưa chọn checkbox |
| Back | Trở về URL bộ lọc cũ, ngày 02/11/2026, 17–18, đúng cơ sở và ba thẻ: [390px](ui-goi-y-review-2026-10-27/back-390.png), [1366px](ui-goi-y-review-2026-10-27/back-1366.png) |

[Đo document và số thẻ](ui-goi-y-review-2026-10-27/measurements.json). scrollWidth không vượt innerWidth; phần chênh 15px là scrollbar. Ảnh full-page giữ chiều rộng viewport; không phải điện thoại thật. Chỉ thực hiện chuỗi bàn phím nêu trên, chưa kiểm tra toàn bộ tab order.

Snapshot trước/sau các GET danh sách (gồm query lỗi), chi tiết và Back: cùng cách `Model.find().sort({_id:1}).lean()` và SHA-256 JSON, Booking 3 / SlotLock 6 / Payment 0 / BookingRequest 0, hash giữ nguyên. [Snapshot](ui-goi-y-review-2026-10-27/db-readonly.json). Không công bố đây là nghiệm thu đầy đủ #67; chưa có hai phiên trình duyệt thật tranh gợi ý cũ + HTTP 409/DB trong phiên này.

Kiểm tra trên backend `30d0fa6`: npm run check PASS (18 EJS), npm test 125/125 PASS. UI source trên: check PASS (18 EJS), npm test 132/132 PASS, 0 fail/skip. Lần chạy sandbox đầu bị EACCES localhost, đã chạy lại ngoài sandbox thành công.

Còn chờ: #70 merge/bàn giao chính thức; chạy lại trên SHA tích hợp cuối, bổ sung gợi ý qua mốc cao điểm (đã có unit test nhưng chưa chụp browser), thiếu ngày/có kết quả chính qua browser, và toàn bộ QA #67. Chưa dùng Closes #65 để đóng issue.
