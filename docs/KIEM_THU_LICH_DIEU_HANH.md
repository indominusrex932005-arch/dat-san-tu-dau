# Kiểm thử lịch điều hành — nghiệm thu #66 / PR #71

**Đã chạy đủ 7 nhóm ca ngày 28/10/2026; ĐẠT, sẵn sàng nhóm trưởng review.** Closes #66 khi PR được merge. Không tự merge hoặc đóng issue trong phiên QA.

## Source và môi trường

- Main đã tích hợp backend #68 và UI #69: `36e75cdf33dc7cf7bd568ed3ae938698af47bca1`.
- Checkout thực thi: `bb8057999970e9d063cf107699164971a2ea15cc` trên `docs/kiem-thu-lich-dieu-hanh`, sau khi merge main. `git diff origin/main -- services controllers models domain views public routes app.js server.js package.json` rỗng. Sau SHA này chỉ thêm/cập nhật bằng chứng QA, không sửa source nghiệp vụ.
- Triều (`lhtrieu2703-beep`) yêu cầu/bàn giao; Codex thực thi. Node **24.15.0**, MongoDB **8.3** replica set `rs0` tại localhost:27029, DB một lần `booking_test_1793179475132_22092`. Không đọc `.env`, không dùng Atlas hoặc dữ liệu người thật.
- Browser **Codex in-app browser qua CUA**, viewport 390×844 và 1366×900. API đọc trang không cung cấp `navigator.userAgent`, nên chưa xác minh số phiên bản engine. Không tự gán phiên bản Chrome/Brave.
- Fixture tổng hợp: 7 tài khoản thử (OWNER A/B/tên dài/rỗng/chưa cấp cơ sở/chờ duyệt, CUSTOMER), 4 cơ sở, 9 sân. A/B/tên dài mỗi cơ sở có sân sáng 05–08, sân tối 17–22 và inactive 08–09. Ngày nghiệp vụ 29/10/2026, hôm nay VN 28/10/2026. Fixture chủ đã duyệt được tạo trực tiếp; không kiểm thử lại luồng ADMIN duyệt trong phạm vi #66.

## Bảy nhóm ca đã chạy

| Ca / bước | Mong đợi | Thực tế và bằng chứng | Kết quả |
| --- | --- | --- | --- |
| TC-01: mở lịch bằng khách, CUSTOMER, OWNER chờ/chưa cấp; login A/B; A chèn owner/facilityId của B | Chặn trái quyền, mỗi OWNER chỉ thấy sân của mình | Khách 303 → login; CUSTOMER/pending/unassigned 403 và không có hàng sân. A/B 200, mỗi bên đúng 3 ID sân, không chồng nhau; query không đổi phạm vi. HTTP/DB thật | ĐẠT |
| TC-02: xem 2 sân khác giờ và 1 inactive | Trục giờ theo cấu hình, ô ngoài giờ không phục vụ, có nhãn Tạm ngừng | Cột từ 05:00–05:30 đến 21:30–22:00, có 08–09 của sân inactive; không tự chèn 12:00. Sân sáng tại 17:00 UNAVAILABLE, inactive toàn UNAVAILABLE, không có trạng thái Bảo trì | ĐẠT |
| TC-03: xem 05:30 trống; POST giữ 05:30/06:00; POST demo-payment; GET lịch lại | AVAILABLE → LOCKED → BOOKED; đủ lock, tiền mô phỏng | POST giữ 303, lịch LOCKED; demo-payment 303, Booking CONFIRMED, hai ô BOOKED, 2 lock và 1 Payment. Tạo thêm HOLD 06:30 cho khách khác | ĐẠT |
| TC-04: tạo HOLD 07:00, chờ qua hạn fixture; xem lịch ngày mai và hôm nay | Ô tương lai mở lại, ô đã bắt đầu không đặt được, đơn xác nhận/lock người khác nguyên vẹn | 07:00 LOCKED → AVAILABLE; 05:00 hôm nay UNAVAILABLE; 05:30 vẫn BOOKED/2 lock, HOLD 06:30 vẫn LOCKED/1 lock. GET không sửa Booking expired-fixture hoặc dọn lock | ĐẠT |
| TC-05: GET mặc định, 7 liên kết, ngày +20, ngày sai/không tồn tại/quá khứ/lặp | Ngày VN, hôm nay→+6, tương lai 200; lỗi 400 không lộ lịch | Mặc định 28/10; đúng 7 ngày 28/10–03/11; +20 ngày 200. Bốn nhóm query lỗi đều 400, không có hàng sân. Tab/Enter còn được thử browser ở TC-06 | ĐẠT |
| TC-06: normal/tên dài/rỗng ở hai viewport; Tab qua form, Enter, Tab vào bảng và mũi tên | Đọc được, không tràn trang, bảng cuộn riêng, focus/chú giải chữ rõ | Ảnh thật và đo DOM bên dưới: scrollWidth document ≤ viewport; bảng rộng 2576/2648px cuộn riêng. Enter đổi ngày đúng; ArrowRight 0→40px ở cả hai viewport; tên sân cố định, tên dài xuống dòng, trạng thái rỗng có lời giải thích | ĐẠT |
| TC-07: hash 7 collection trước/sau GET hợp lệ/lỗi/query đổi cơ sở và sau browser | Không đổi đơn/lock/payment/request, giá hoặc quyền; session được phép thay đổi | Count và SHA-256 **giữ nguyên** cho User, Facility, Court, Booking, SlotLock, Payment, BookingRequest. Đối chiếu cả lượt HTTP và browser login/xem lịch. Không ghi raw cookie, CSRF, password hoặc token vào bằng chứng | ĐẠT |

TC-01–05/07 dùng app Express thật, controller/service thật, Mongoose và transaction cục bộ; không mock route. [Kết quả HTTP theo từng ca](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/http-results.json). [Kết quả browser](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/browser-results.json), [snapshot browser trước/sau](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/browser-db-after.json).

**Phương pháp TC-04:** tạo đơn qua POST thật, sau đó đặt deadline Booking/SlotLock thành now+1,5 giây **chỉ trong DB QA** rồi chờ qua mốc đó và GET lại. Không sửa source hoặc đồng hồ hệ điều hành. Đây là thử biên hết hạn có kiểm soát, không khẳng định đã chờ đủ 10 phút thực. Ô đã qua kiểm tra ngày hôm nay theo giờ server. Bộ test tự động còn kiểm tra biên thời gian/quyền và các nhánh lỗi riêng.

## Bằng chứng trình duyệt mới

| Trạng thái / thao tác | 390×844 | 1366×900 |
| --- | --- | --- |
| Cơ sở thường, 3 sân | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/normal-390.jpg) | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/normal-1366.jpg) |
| Tên cơ sở/địa chỉ/sân dài | [Toàn trang](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/long-390.jpg), [bảng](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/long-table-390.jpg) | [Toàn trang](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/long-1366.jpg), [bảng](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/long-table-1366.jpg) |
| Cơ sở chưa có sân | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/empty-390.jpg) | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/empty-1366.jpg) |
| Focus nút Xem lịch qua Tab | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/date-focus-390.jpg) | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/date-focus-1366.jpg) |
| Focus bảng và ArrowRight | [Focus](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/table-focus-390.jpg), [cuộn](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/table-right-390.jpg) | [Focus](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/table-focus-1366.jpg), [phải](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/table-right-1366.jpg), [trái](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/table-left-1366.jpg) |

Desktop: điền 29/10, Tab qua 4 điểm/segment native tới nút, Enter → `?date=2026-10-29`, input/tiêu đề đúng ngày. Mobile: cùng chuỗi với 30/10 → `?date=2026-10-30`. Tab từ liên kết ngày cuối vào region lịch, viền focus 2,4px; ArrowRight cuộn riêng 40px. Trạng thái luôn có chữ Trống/Đang giữ/Đã đặt/Không phục vụ, không chỉ dựa màu.

Viewport 390×844/1366×900 được đặt bằng API và đo bằng DOM. API screenshot trả JPEG gốc có thể bỏ vùng scrollbar: chiều rộng tệp 375/390 hoặc 1351/1366px; ảnh full-page có thể cao hơn viewport. Manifest ghi kích thước ảnh thật, không kéo giãn hoặc chỉnh ảnh để ép kích thước. Đây là resize browser desktop, không phải điện thoại thật. Tên rất dài làm hàng cao nhưng vẫn đọc được. Chỉ khẳng định chuỗi bàn phím đã nêu và browser đã dùng; không khẳng định mọi phím, mọi mức zoom hoặc mọi trình duyệt.

## Kiểm tra và dọn môi trường

- `npm run check`: **PASS**, ESLint và **19 EJS**.
- `npm test`: **149/149 PASS**, 0 fail/skip, trên source ứng dụng ở SHA trên; gồm 23 test/subtest calendar service/HTTP. Kết quả tự động tách biệt với bằng chứng browser.
- [Tổng hợp nghiệm thu](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/acceptance.json), [manifest SHA-256 ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/screenshot-manifest.json).
- App QA đã dừng, DB fixture đã drop: [cleanup](kiem-thu-lich-dieu-hanh/acceptance-2026-10-28/cleanup.json). Bộ test tự tạo/dọn DB riêng. Không thay source/backend/UI, index Atlas hoặc dữ liệu nhóm.

## Bằng chứng lịch sử

Báo cáo/ảnh ngày 25–26/10 được giữ để truy vết, **không dùng làm kết quả mới trên main**. [JSON HTTP cũ](kiem-thu-lich-dieu-hanh/qa-results-66.json) vẫn giữ `targetSHA:null` và SHA được báo cáo sai; không suy đoán lại nguồn chạy. [Browser cũ](kiem-thu-lich-dieu-hanh/browser-review-2026-10-26.json) chỉ áp dụng source cũ. Token đã che trong JSON hiện tại; lịch sử Git cũ không được viết lại/force-push và token cũ không được tái sử dụng.

Phụ thuộc backend/UI đã merge, không còn lý do chờ #68/#69. Phiên 28/10 thay thế kết luận chưa nghiệm thu trước đây bằng 7 nhóm ca mới trên SHA đã xác minh. PR vẫn chỉ là tài liệu/bằng chứng QA; nhóm trưởng quyết định merge.
