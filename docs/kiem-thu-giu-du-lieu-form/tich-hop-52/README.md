# Kiểm thử PR #55 sau khi tích hợp PR #52

Ngày **24/10/2026 (UTC+7)**. Nhánh `fix/booking-form-recovery`, cập nhật từ `main` và ghép nhánh #52, giữ PR #55 trỏ vào `main`. Không force-push hoặc thay đổi nhánh #52.

## Nền và cách sửa xung đột

- PR #55 trước cập nhật: `629dc35fa3b882b29a1b334b8349b9397b91cba2`.
- Main mới: `ee1c2341f8af274c839f65ea24eecc32fd3902fd`, có tìm sân #45.
- PR #52: `532707e011031dbb6a68266bba3680ca4b6fbb26`, hết hạn giữ sân khi ô đầu tiên bắt đầu.
- `public/js/booking.js`: giữ nguyên phục hồi form/fetch/WeakMap/chống gửi trùng của #55; giữ nguyên countdown dùng deadline và giờ server của #52. Nhãn khi không gửi là **Giữ chỗ tối đa 10 phút**; lúc đang gửi vẫn báo đang kiểm tra.
- `views/court-detail.ejs`: giữ giá trị form đã trả về, lựa chọn còn AVAILABLE, CSRF, tổng giá server và thông báo ô bị loại; dùng nội dung hạn giữ của #52.
- Phần tự ghép của controller giữ cả `createBooking` phục hồi form và `showCheckout` truyền `serverNow`. Hợp đồng dữ liệu giữ cả hai thay đổi.
- Test VM countdown được bổ sung API `window.addEventListener` vào browser giả, vì file JavaScript chung nay đăng ký `pageshow`. Không xóa hoặc nới các assertion countdown.

Commit cuối và CI của đúng head được ghi trong PR #55. Ảnh/JSON cũ của #38 và #37 giữ nguyên SHA lịch sử; bằng chứng trong thư mục này chỉ dành cho bản ghép mới.

**Cách tích hợp:** #55 hiện chứa commit #52 trong lịch sử và có thể review bản ghép chung trên main hiện tại. Nếu merge #52 bằng merge commit trước, nhánh #55 đã có tổ tiên đó. Nếu chọn **squash #52 trước**, cần cập nhật #55 theo commit main thực tế sau squash rồi kiểm tra lại; phép thử lịch sử squash độc lập vẫn có vùng chồng lấn. Không coi CI của bản ghép là bảo đảm cho một SHA squash tương lai. Không tự merge hai PR hoặc đóng #52 trong tác vụ này.

## Kiểm tra tự động bản cuối

- `npm run check`: **PASS**, ESLint và 17 template EJS.
- `npm test`: **111/111 PASS**, không fail/skip/todo. Bao gồm toàn bộ test của main mới, #55, #52 và suite kết hợp mới.
- [booking-recovery-expiry.test.js](../../../tests/booking-recovery-expiry.test.js): ba ca HTTP/DB (cộng test cha thành bốn kết quả) kiểm tra 400 → gửi lại sát giờ → hạn một phút; 409 → giá server/ô còn trống → hết hạn không xóa lock khách B; ô đầu đã bắt đầu bị bỏ và hạn mới lấy ô còn lại sớm nhất. Các ca đều kiểm tra checkout và POST mô phỏng muộn 410/EXPIRED/0 lock/0 Payment.
- Tám ca script phục hồi form và tám ca countdown chạy trên cùng file JavaScript đã ghép, giữ kiểm tra chống gửi trùng/mất mạng/pageshow/redirect/giờ server/đúng hạn.
- `git diff --check`: PASS; không còn conflict marker. Hạn, giá, quyền và transaction vẫn do backend quyết định.

## Trình duyệt thật và DB

Ứng dụng/controller/service/EJS/JavaScript thật; Chromium in-app browser tại **390×844** và **1366×900**. MongoDB **8.3.11** replica `qaCombined55` tại `127.0.0.1:27054`, DB tạm `qa_combined55_*`, cơ sở và hai sân tổng hợp độc lập cho hai viewport. Không đọc `.env`, không kết nối Atlas, không sửa seed/migration/dữ liệu người dùng.

Chỉ tiến trình Node QA có đồng hồ `Date` giả chạy liên tục trên ngày **10/05/2030**, được đặt lại giữa hai ca sân độc lập. Không thay đồng hồ OS/trình duyệt. Hai ô ban đầu: **16:00 + 16:30**. Khách B giữ ô 16:30 qua service transaction thật sau khi A đã nhận lỗi 400; giá thường tăng **50.000 → 70.000 đồng**. Sau lỗi 409, đồng hồ server QA được đưa sát 16:00 trước khi A chủ động gửi lại.

| Ca | Mong đợi | Kết quả thực tế ở cả hai viewport |
| --- | --- | --- |
| SĐT sai `090abc1234` | POST 400, giữ tên/SĐT và hai ô | PASS: hai ô còn chọn, tên giữ đúng, lỗi được focus; URL vẫn là GET sân/ngày; nút ghi **tối đa 10 phút** |
| B chiếm 16:30, A sửa SĐT thành `0912345678` rồi gửi | POST 409, bỏ ô mất, giữ ô còn trống và giá mới | PASS: chỉ 16:00 được chọn, 16:30 disabled, tên/SĐT hợp lệ giữ lại, tổng **70.000 đồng**, focus lỗi |
| A bấm gửi lại từ form phục hồi | 303 checkout, không tạo thêm từ các lần 400/409; deadline theo ô đầu | PASS: đúng một ô 16:00, deadline **09:00 UTC = 16:00 Việt Nam**; serverNow trả về lúc còn khoảng **9 giây mobile / 16 giây desktop**, không kéo thành 10 phút |
| Đợi tới hạn | Countdown tự khóa nút thanh toán | PASS: DOM `data-expired=true`, thông báo đã tới hạn, nút mô phỏng disabled |
| Reload checkout | HTTP 410, trạng thái EXPIRED và giải phóng đúng lock | PASS: trang ghi **Đã hết hạn**, không còn timer/nút thanh toán; đơn B vẫn HOLD |

Các phép đo DOM cho mọi trạng thái đã ghi nhận đều không cuộn ngang. Tên/SĐT/ngày thường trong fixture chỉ là dữ liệu tổng hợp; báo cáo này không thay thế kiểm tra tên cơ sở cực dài của PR #54. Công cụ che trường tel trong DOM, nên việc giữ SĐT sai được kiểm chứng bằng bộ HTTP/DB và ảnh lịch sử #38; gửi lại không phải nhập lại SĐT hợp lệ giữa 409 và checkout.

Request log của chính lượt browser có **6 POST `/bookings`**: 2×400, 2×409, 2×303. Khách B được tạo bằng service thật trên DB riêng, không tính là POST browser. Hai lần reload checkout trả 410. Cuối lượt có **4 Booking / 2 SlotLock / 0 Payment**: hai đơn A EXPIRED/0 lock; hai đơn B HOLD/mỗi đơn một lock 16:30. Không tạo đơn một phần từ các lần lỗi và không xóa lock đối chứng.

## Ảnh và bằng chứng

| Trạng thái | Mobile | Desktop |
| --- | --- | --- |
| Lỗi thông tin | [400](390-400.jpg) | [400](1366-400.jpg) |
| Tranh ô, lịch/giá mới | [409](390-409.jpg) | [409](1366-409.jpg) |
| Checkout, nút thanh toán trước hạn | [Checkout](390-checkout.jpg) | [Checkout](1366-checkout.jpg) |
| Nút đã khóa khi tới hạn | [Disabled](390-expired.jpg) | [Disabled](1366-expired.jpg) |
| Sau reload | Request 410 trong log | [Trang hết hạn](1366-reload-expired.jpg) |

Ảnh viewport checkout tập trung phần nút; deadline, giờ server và chuỗi countdown được ghi trong [browser-results.json](browser-results.json). [requests.jsonl](requests.jsonl) chỉ giữ method/path/status, không có cookie, body, CSRF hay token vãng lai. [database-results.json](database-results.json) giữ ID QA, trạng thái, hạn, ô và số lock; không xuất thông tin xác thực.

DB browser được xóa sau đối chiếu marker; runtime và MongoDB QA được dọn sau khi bộ regression hoàn tất. Chưa thử Safari/Firefox hoặc điện thoại vật lý/production. PR #55 và #52 vẫn chờ nhóm trưởng review/merge; bản cập nhật này chuẩn bị khả năng tích hợp, không tự merge vào main.
