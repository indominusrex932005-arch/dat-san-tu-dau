# Bổ sung hoàn tất C04 và C06 — 26/10/2026

Codex thực thi; Hoàng Triều (`lhtrieu2703-beep`) bàn giao. SHA thực chạy `ec14ee0c55b296af80f137936847618c08b6034b`; không sửa source ứng dụng. DB tạm localhost replica set, dữ liệu tổng hợp.

## C04: hai trình duyệt có giao diện, phiên độc lập

1. A trong Codex in-app browser (UA Chrome/156.0.0.0) chọn 16:00 và 17:00 ngày 29/10: [lựa chọn cũ](A-iab-stale-selection.jpg).
2. B trong Google Chrome 155.0.8059.86 chọn 16:00 và 18:00: [đã chọn](B-chrome-selected.jpg), gửi trước và [đến checkout](B-chrome-hold-winner.jpg).
3. A gửi form cũ: [báo ô 16:00 đã được giữ, giữ thông tin và ô 17:00](A-iab-conflict-no-partial.jpg). Không ghi HTTP status cho lần này vì không thu network trace; ca HTTP 409 trước đó nằm trong bộ review.
4. [Snapshot sau xung đột](after-conflict.json): chỉ một đơn của B, đủ hai lock 16:00/18:00; không đơn của A, không lock 17:00. Do đó không giữ một phần của phiên thất bại.

## C06: thanh toán mô phỏng và PDF thực

B bấm mô phỏng toàn bộ → [phiếu xác nhận](B-chrome-confirmed-receipt.jpg). [DB sau thanh toán](after-payment.json): CONFIRMED/DEMO_PAID và một INITIAL_DEMO 125000đ.

Bấm In / Lưu PDF → [print preview một trang](C06-print-preview-one-page.jpg) → Microsoft Print to PDF → lưu [PDF gốc](phieu-DS-11B6089C64A4.pdf). [Render trang 1](phieu-page-1.png) được kiểm tra trực quan: đúng mã DS-11B6089C64A4, ngày 29/10, ô 16:00–16:30 (50000đ), 18:00–18:30 (75000đ), tổng 125000đ, nhãn mô phỏng và tiếng Việt rõ. Không có token khách vãng lai trong URL footer. PDF không trích được lớp text bằng pypdf; không khẳng định khả năng tìm kiếm/copy chữ.

[Manifest/hash](completion-evidence.json). Ảnh gốc không ghép/chỉnh sửa; PDF tạo từ thao tác UI thật, render chỉ để kiểm tra. Bổ sung này không thay thế các ảnh 1366/390 của bộ review trước.

## Kịch bản demo ngắn

Dùng tài khoản thử riêng trên DB phát triển: đăng ký khách; OWNER chờ được ADMIN cấp cơ sở; chọn hai ô thường/cao điểm rời nhau; cho phiên B gửi trước rồi A gửi form cũ; đối chiếu đơn/lock; mô phỏng thanh toán và in PDF; gửi yêu cầu hủy/đổi, OWNER xử lý; mở phiếu bằng người khác để kiểm tra quyền. Trình bày HOLD tối đa 10 phút nhưng kết thúc trước ô đầu tiên; bộ review đã chờ hết hạn thật. Không công bố mật khẩu/token hay dùng thanh toán ngân hàng thật.
