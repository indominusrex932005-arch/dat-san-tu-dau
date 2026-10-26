# Kiểm thử luồng đặt sân #33 — sửa review PR #59

**Báo cáo thay thế ngày 26/10/2026. Chưa nghiệm thu toàn bộ #33: còn phần lưu PDF và luồng hai trình duyệt độc lập.** Không dùng kết luận 9/9 của báo cáo cũ.

## Người thực thi, source và môi trường

- Người bàn giao: Hoàng Triều, GitHub `lhtrieu2703-beep`. Codex thực thi thao tác/test trong phiên này; không ghi thành Triều đã tự thao tác.
- Nhánh `docs/kiem-thu-dat-san`, đã cập nhật main `f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7`.
- **SHA thực tế đã chạy: `ba4e9de81bfce2420a3d06bf220e9601c7a1fb53`**. Source ứng dụng giống main trên, khác biệt nhánh chỉ ở tài liệu. Commit tiếp theo thay ảnh/báo cáo, không sửa ứng dụng.
- Ngày 26/10/2026, UTC+7; Node 24.15.0, MongoDB 8.3, replica set rs0 tại localhost:27029; DB riêng `qa_booking_59_1792998654432`. Không đọc `.env`, không dùng Atlas.
- Trình duyệt: Codex in-app browser qua CUA; User-Agent do server nhận có `Chrome/156.0.0.0`. Đây là giá trị UA, không khẳng định đó là phiên bản Brave cài trên máy.
- Viewport 1366×900 và 390×844. Mỗi trạng thái được chụp ở hai viewport bằng resize cùng phiên; không nói đã thực hiện lại toàn bộ chuỗi thao tác độc lập hai lần. Ảnh full-page có thể cao hơn viewport và bề rộng trừ scrollbar.
- App thật qua createApp/routes/controllers/services/EJS và MongoStore. Dữ liệu tổng hợp: cơ sở A/B, sân A1/A2/B1, giờ 06–22, cao điểm 18–22, giá 50.000/75.000đ mỗi ô 30 phút. ADMIN và hai OWNER ban đầu là fixture cục bộ; đăng ký khách A và OWNER mới, duyệt OWNER mới đều thực hiện qua giao diện. Không coi fixture ADMIN là kiểm thử script cấp ADMIN.
- [Danh mục ảnh mới](kiem-thu-dat-san/README.md), [manifest từng ảnh](kiem-thu-dat-san/review-2026-10-26/browser-evidence.json), [HTTP/DB đã lọc dữ liệu nhạy cảm](kiem-thu-dat-san/review-2026-10-26/http-db-evidence.json).

## Thay bằng chứng theo review

Đã xem lại bốn ảnh desktop cũ: C03 chưa chọn ô; C06 còn ở checkout; C07 là chi tiết sân; C09 là lỗi nhập SĐT cơ sở. Chúng không chứng minh các kết luận tương ứng. Toàn bộ bộ ảnh cũ đã được gỡ khỏi bản PR hiện tại; lịch sử Git giữ lại để truy vết. Không đổi tên ảnh cũ để gọi là kết quả mới.

## Bảng thực thi mới

| Ca | Bước và đầu vào | Mong đợi | Kết quả thực tế / bằng chứng | Đánh giá |
| --- | --- | --- | --- | --- |
| C01 | Đăng ký Khách A; login sai rồi đúng; mở lịch sử rỗng; logout/login nhiều lần trong các ca sau | Sai mật khẩu bị từ chối; phiên đúng truy cập lịch sử riêng | Sai login HTTP 401; lịch sử A ban đầu rỗng. [Lỗi](kiem-thu-dat-san/review-2026-10-26/C01-login-error-1366.jpg), [rỗng](kiem-thu-dat-san/review-2026-10-26/C01-empty-history-390.jpg) | ĐẠT phần đã chạy; cách ly đơn kiểm tra thêm C09 |
| C02 | Đăng ký OWNER mới; truy cập tạo sân khi còn PENDING; ADMIN cấp cơ sở chờ; OWNER tạo sân giá 60.000/90.000đ và sửa tên | Chưa duyệt bị chặn; sau cấp mới tạo/sửa được sân | PENDING hiển thị đúng; GET tạo sân 403; duyệt bằng UI; tạo rồi sửa sân thành Sân mới QA59 đã sửa. [Chờ](kiem-thu-dat-san/review-2026-10-26/C02-owner-pending-390.jpg), [bị chặn](kiem-thu-dat-san/review-2026-10-26/C02-pending-forbidden-1366.jpg), [kết quả](kiem-thu-dat-san/review-2026-10-26/C02-owner-created-edited-1366.jpg) | ĐẠT |
| C03 | A chọn A1, 29/10/2026, 17:00 và 18:00; giữ chỗ | Hai ô rời nhau, tổng 125.000đ; ô 17:30 không bị giữ | Checkbox thực sự được chọn; checkout và phiếu đúng từng giá. Snapshot trước hủy: đúng hai lock 17:00/18:00, không lock 17:30. [Chọn ô](kiem-thu-dat-san/review-2026-10-26/C03-selected-slots-1366.jpg), [checkout](kiem-thu-dat-san/review-2026-10-26/C03-checkout-two-slots-390.jpg) | ĐẠT |
| C04 | Browser A chọn 16:00; client HTTP B có cookie jar riêng giữ trước; A gửi lựa chọn cũ | B thắng, A nhận 409; không tạo đơn giữ một phần | B 303, A POST /bookings 409, form giữ thông tin liên hệ và bỏ ô đã mất. Chỉ một booking/lock sở hữu 16:00. [409](kiem-thu-dat-san/review-2026-10-26/C04-stale-conflict-1366.jpg) | ĐẠT HTTP + browser A; chưa trình bày bằng hai browser độc lập |
| C05 | A giữ A2 12:00 ngày 29/10, không thanh toán; chờ 10 phút theo đồng hồ thật rồi tải lại | HOLD hết hạn; GET checkout 410, ô mở lại, không thanh toán muộn | Xem mục bổ sung hết hạn bên dưới và JSON | Không dùng kết quả cũ; ghi theo lần chạy mới |
| C05b | A đặt ô 14:30 ngày 26/10 lúc server 14:20:31 | Hạn là 14:30, sớm hơn createdAt + 10 phút; ô 14:00 đã qua bị disabled | Countdown 09:29; data-hold-until=07:30Z, data-server-now=07:20:31Z. [Ảnh](kiem-thu-dat-san/review-2026-10-26/C05b-before-first-slot-390.jpg) | ĐẠT giới hạn hạn hiển thị; chưa chờ riêng đến mốc 14:30 trong browser |
| C06 | A bấm mô phỏng thanh toán đơn hai ô C03 | CONFIRMED/DEMO_PAID, phiếu có nhãn mô phỏng và tổng đúng | POST demo-payment 303; phiếu Đã xác nhận, hai ô 50.000 + 75.000đ. Payment INITIAL_DEMO 125.000đ. [Phiếu thật sau thanh toán](kiem-thu-dat-san/review-2026-10-26/C06-confirmed-receipt-1366.jpg) | ĐẠT thanh toán/phiếu; lưu PDF chưa xác minh |
| C07 | A xin đổi sang 19:00 đã bị B đặt; kiểm tra phiếu cũ; A gửi CANCEL; đúng OWNER duyệt hoàn 125.000đ và ghi hoàn mô phỏng; B gửi CHANGE hợp lệ sang 20:00, OWNER từ chối | Đổi trùng bị chặn và giữ lịch cũ; hủy/hoàn do OWNER; từ chối đổi không thay lịch | Đổi trùng 409 ngay lúc gửi, chưa tạo request; phiếu cũ vẫn hai ô. CANCEL → PENDING → APPROVED/CANCELLED; ghi nhận hoàn thủ công. CHANGE của B → REJECTED, lịch B vẫn 19:00. [Đổi bị chặn](kiem-thu-dat-san/review-2026-10-26/C07-change-conflict-1366.jpg), [form hủy](kiem-thu-dat-san/review-2026-10-26/C07-cancel-form-390.jpg), [OWNER duyệt](kiem-thu-dat-san/review-2026-10-26/C07-owner-approved-1366.jpg), [từ chối](kiem-thu-dat-san/review-2026-10-26/C07-owner-rejected-390.jpg) | ĐẠT các nhánh đã nêu; chưa đổi thành công có chênh lệch bằng UI |
| C08 | Logout; khách vãng lai chọn A2 15:00, nhập tên/SĐT tổng hợp, giữ và mô phỏng; OWNER hủy theo cuộc gọi giả lập | Phiếu có liên hệ, không có link tự yêu cầu hủy/đổi; OWNER xử lý được | Phiếu CONFIRMED mô phỏng, số liên hệ cơ sở; 0 link Gửi yêu cầu; OWNER hủy theo liên hệ, khoản hoàn 0. [Phiếu](kiem-thu-dat-san/review-2026-10-26/C08-guest-receipt-390.jpg), [OWNER hủy](kiem-thu-dat-san/review-2026-10-26/C08-owner-cancelled-1366.jpg) | ĐẠT; không lưu/đọc token trong bằng chứng |
| C09 | B và OWNER B mở receipt đơn A; OWNER A/ADMIN mở cùng receipt; khách không có token mở receipt vãng lai | Sai quyền 403, đúng quyền 200 | HTTP xác nhận 403/200 tương ứng; ảnh lỗi là Bạn không có quyền xem đơn này, không phải lỗi SĐT. [Khách B](kiem-thu-dat-san/review-2026-10-26/C09-customer-forbidden-1366.jpg), [OWNER B](kiem-thu-dat-san/review-2026-10-26/C09-owner-other-forbidden-390.jpg), [ADMIN](kiem-thu-dat-san/review-2026-10-26/C09-admin-allowed-1366.jpg), [thiếu token](kiem-thu-dat-san/review-2026-10-26/C09-guest-no-token-390.jpg) | ĐẠT các trường hợp đã chạy |

## Giới hạn và quan sát phải giữ khi bàn giao

- Đã thử bấm In/Lưu PDF trên phiếu CONFIRMED của B; thao tác CUA timeout ở dispatchMouseEvent, Escape đưa tab về phiếu. Không có file PDF đã lưu hoặc bằng chứng print preview, nên **CHƯA XÁC MINH** phần lưu PDF; không gán PASS chỉ vì nút tồn tại.
- C04 dùng browser A và HTTP TestBrowser B riêng cookie jar, không phải hai cửa sổ browser. Cần bổ sung phần trình bày hai browser nếu nghiệm thu toàn bộ #33.
- Không tự gán 0 lỗi console/network: server ghi nhận favicon.ico 404; các 401/403/409 là ca âm dự kiến. Chưa thu bộ console đầy đủ đã lọc token. Không suy kết quả tất cả tài nguyên/font từ ảnh.
- Chưa thử Firefox/Safari/điện thoại thật hoặc mọi đường bàn phím. Ghi rõ ca UI chưa chạy; tests tự động chỉ là bằng chứng bổ trợ.
- Giữ PR draft, Refs #33; nhóm trưởng nghiệm thu sau khi đủ bằng chứng. Không sửa source nghiệp vụ để làm ca đạt, không merge main trong task này.

## Bổ sung hết hạn và kết quả công cụ

C05: HOLD tạo lúc 14:13:52.426, hạn 14:23:52.418 ngày 26/10/2026 (UTC+7). Sau thời gian chờ thật, GET checkout trả 410 và trạng thái EXPIRED; không còn nút mô phỏng. Quay lại sân, ô 12:00 ngày 29/10 được chọn lại. POST demo-payment qua client HTTP độc lập lúc 14:25:48 trả 410. DB không có lock/payment của đơn hết hạn. Không sửa holdExpiresAt, thời gian máy hoặc giờ server. [Đơn hết hạn](kiem-thu-dat-san/review-2026-10-26/C05-expired-checkout-390.jpg), [ô mở lại](kiem-thu-dat-san/review-2026-10-26/C05-slot-reopened-1366.jpg).

npm run check: PASS, ESLint và 17 EJS. npm test: 111/111 PASS, 0 fail/skip. Tên test tự động có nhắc PDF không chứng minh đã xuất PDF qua trình duyệt trong phiên này.

App QA đã đóng, DB dùng một lần đã được drop; không giữ tài khoản/session QA hoạt động. Bằng chứng HTTP/DB đã bỏ query/body/cookie/CSRF/token; thông tin tên/SĐT trong ảnh là dữ liệu tổng hợp.
