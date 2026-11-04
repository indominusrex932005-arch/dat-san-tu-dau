# Kiểm thử lịch điều hành — #76 trên main mới

Refs #76. **Đã chạy mới trên main `5c3e72d50a9802a1533a9ca7b17db0fb8fc3aa47`: 12/12 ca HTTP, 17/17 record browser/17 ảnh, check 19 EJS và lượt full suite cuối 156/156 test đạt.** Lượt full suite đầu có lỗi cấp file migration; log được giữ, nguyên nhân chưa xác định và không gọi đó là lỗi đã sửa. [PR #71](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/71) đã merge lúc **03/11/2026 07:27:58 UTC** (14:27:58 UTC+7). Phần còn lại của #76 được nộp bằng PR QA tiếp theo trên nhánh `docs/qa-calendar-76`, không trình bày #71 như một PR còn chờ merge. Kết quả `507ad76` bên dưới chỉ là lịch sử.

## Nền thực thi mới sau khi #71 merge

- Checkout/main: **`5c3e72d50a9802a1533a9ca7b17db0fb8fc3aa47`**. Main này đã nhận UI gợi ý từ #73 qua `23b6cd` rồi bằng chứng QA từ #71 qua `5c3e72d`.
- So với source QA trước `507ad768ed1b25b6c680544601f7e02e1c4a5e0d`, các thay đổi ứng dụng/kiểm tra liên quan nằm ở ba file UI gợi ý, workflow CI và test view gợi ý. Source lịch điều hành, auth/navigation dùng chung, CSS lịch, models/package và luật nghiệp vụ lịch không đổi. Tuy vậy, lần bàn giao mới vẫn chạy lại check/test, HTTP và browser trên đúng main mới.
- Lượt chạy mới dùng Node **24.15.0**, MongoDB **8.3.11**, replica `qaOwnerCalendar76` localhost cổng `27061`, app cổng `61470`; app/controller/service/EJS thật trên một DB fixture mới. Không dùng lại DB/session của lượt `507ad76`; không dùng `.env`, Atlas hoặc dữ liệu người thật. Fixture mới gồm 7 tài khoản, 4 cơ sở, 9 sân; A có 4 sân, B có 2, cơ sở tên dài có 3, cơ sở rỗng có 0.
- Ngày VN thực thi là **03/11/2026**; ngày lịch dữ liệu thường/rỗng/tên dài là **06/11/2026**. Browser là **Codex in-app qua CUA**, phiên bản engine không thu được từ API hỗ trợ; không gán thành Chrome. Viewport **390×844 / 1366×900**; ảnh JPEG gốc có thể bỏ vùng scrollbar, kích thước thật và hash được ghi trong manifest.
- Bằng chứng mới nằm riêng tại `kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/`. Toàn bộ bằng chứng ở `acceptance-2026-11-03/` vẫn ghi source `507ad76` và được giữ như lịch sử, không đổi tên/SHA để coi là lần chạy `5c3e72d`.

## Bảy nhóm ca trên main `5c3e72d`

Toàn bộ kết quả trong phần này dùng source **`5c3e72d50a9802a1533a9ca7b17db0fb8fc3aa47`**, có thời điểm và bằng chứng riêng. [12 ca HTTP](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/http-results.json) gồm ba ca chuyển trạng thái qua POST và chín ca đọc; [17 record browser](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/browser-results.json) được chụp lại. Không đánh dấu #76 hoàn thành trước khi PR QA tiếp theo được nhóm trưởng review/merge.

| Ca / bước | Mong đợi | Thực tế trên main mới / kết quả | Bằng chứng |
| --- | --- | --- | --- |
| TC-01: khách/CUSTOMER/OWNER chờ/chưa cấp; OWNER A/B; A chèn query cơ sở/chủ B | Trái quyền bị chặn; mỗi chủ chỉ thấy sân/cơ sở của mình, query không đổi scope | **ĐẠT:** khách 303 → login; CUSTOMER/pending/unassigned 403 và không có hàng sân. A/B 200, đúng 4/2 sân; query không đổi scope hoặc lộ sân cơ sở khác | HTTP `HTTP-AUTH`, `HTTP-OWNER-SCOPE` |
| TC-02: sân 00:00, sáng 05–08, tối 17–22 và inactive 08–09 | Trục giờ từ cấu hình; ngoài giờ/inactive không phục vụ, không tự tạo bảo trì | **ĐẠT:** 19 cột theo hợp giờ cấu hình, có khoảng ngắt; mọi hàng cùng trục, ngoài giờ/inactive UNAVAILABLE và nhãn Tạm ngừng đúng | HTTP `HTTP-AXIS-INACTIVE`; ảnh normal |
| TC-03: GET ô 05:30, POST HOLD 05:30/06:00 thật, POST demo-payment thật, GET từng bước | AVAILABLE → LOCKED → BOOKED, đủ lock/Payment mô phỏng | **ĐẠT:** hai POST đều 303, Booking CONFIRMED/DEMO_PAID, 2 lock, 1 Payment. Tạo HOLD 06:30 để đối chứng; không giao dịch tiền thật | HTTP `HTTP-TRANSITION`; ảnh normal có 2 BOOKED/1 LOCKED |
| TC-04: HOLD 07:00 quá hạn; GET và POST ô hôm nay 00:00 đã bắt đầu; đối chứng CONFIRMED/lock khác | Mở ô tương lai, chặn đặt ô đã bắt đầu; không đổi đơn xác nhận/lock khác; GET không dọn DB | **ĐẠT:** 07:00 LOCKED → AVAILABLE; 06:30 LOCKED, 05:30 BOOKED; Booking hết hạn vẫn HOLD, lock còn sau GET. Ô 00:00 hôm nay UNAVAILABLE, POST giữ thật trả 400 và dữ liệu nghiệp vụ không đổi | HTTP `HTTP-LIVE-EXPIRED-HOLD`, `HTTP-STARTED-POST` |
| TC-05: GET ngày VN/7 ngày/+20; sáu query ngày lỗi; điền ngày, Tab và Enter | Đúng ngày/mã lỗi, giữ ngày sau GET, không biến lỗi thành lịch trống | **ĐẠT:** mặc định 03/11, đúng 7 link 03–09/11; 23/11 trả 200, không đánh dấu nhầm ngày trong tuần. Sáu query lỗi đều 400, không có hàng sân. Browser Enter giữ 07/11 mobile và 23/11 desktop trong URL/input | HTTP `HTTP-DATES`, `HTTP-BAD-DATES`; ảnh date-focus/date-submit |
| TC-06: thường/rỗng/tên dài, 390×844 và 1366×900; Tab/Enter, cuộn riêng | Đọc được, focus rõ, không tràn ngang document; tên sân sticky | **ĐẠT:** 17/17 record, 17 JPEG mới; normal 4 sân, long 3 sân với tên 150/địa chỉ 500 ký tự escape, empty 0. Focus solid 2.66667px; ArrowRight cuộn riêng region, documentScrollX vẫn 0 và tọa độ cột tên sân giữ nguyên | [Browser](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/browser-results.json), [manifest](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/screenshot-manifest.json) |
| TC-07: snapshot/hash bảy collection sau chuẩn bị fixture, trước/sau mọi GET và browser | Không đổi dữ liệu nghiệp vụ/giá/quyền; loại session riêng | **ĐẠT:** count và SHA-256 không đổi cho User 7, Facility 4, Court 9, Booking 3, SlotLock 4, Payment 1, BookingRequest 0; session loại riêng | HTTP `HTTP-READ-ONLY`; [trước browser](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/browser-db-before.json), [sau browser](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/browser-db-after.json), [đối chiếu cuối](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/final-db-readonly.json) |

**Phương pháp hết hạn của lượt này:** tạo HOLD qua POST thật, chỉ trong DB fixture mới đổi deadline ô 07:00 thành now+1,5 giây rồi chờ thực **1.865ms** trước GET. Không sửa source/đồng hồ hệ điều hành, không khẳng định đã đợi đủ 10 phút. Ảnh normal được chụp lúc 12:40:43–12:40:44 UTC, trước deadline HOLD 06:30 **03/11/2026 12:49:04.136 UTC**; trạng thái là trạng thái lúc tải trang.

### Ảnh và bàn phím trên main `5c3e72d`

| Trạng thái / thao tác | 390×844 | 1366×900 |
| --- | --- | --- |
| Cơ sở thường, bốn sân | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/normal-390.jpg) | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/normal-1366.jpg) |
| Tên cơ sở/địa chỉ/sân dài | [Toàn trang](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/long-390.jpg), [bảng](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/long-table-390.jpg) | [Toàn trang](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/long-1366.jpg), [bảng](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/long-table-1366.jpg) |
| Cơ sở chưa có sân | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/empty-390.jpg) | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/empty-1366.jpg) |
| Tab tới Xem lịch, Enter gửi ngày | [Focus](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/date-focus-390.jpg), [ngày 07/11](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/date-submit-390.jpg) | [Focus](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/date-focus-1366.jpg), [ngày 23/11](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/date-submit-1366.jpg) |
| Tab vào bảng, phím mũi tên | [Focus](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/table-focus-390.jpg), [phải](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/table-right-390.jpg) | [Focus](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/table-focus-1366.jpg), [phải](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/table-right-1366.jpg), [trái](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/table-left-1366.jpg) |

Tab từ liên kết ngày cuối đưa focus vào region lịch; ArrowRight được đo trong animation native: `scrollLeft` từ 0 tới **34px mobile / 33.333332px desktop**. `documentScrollX` vẫn 0, tọa độ cột tên sân không đổi; ArrowLeft desktop sau khi ổn định về 0. Không thay các giá trị trung gian bằng số đo của lượt `507ad76`.

Form ngày: điền 07/11 mobile hoặc 23/11 desktop, Tab qua bốn segment/điểm dừng native tới Xem lịch, focus solid 2.66667px rồi Enter thật. URL/input sau GET giữ ngày đã điền; bảy link vẫn 03–09/11 và không link nào bị đánh dấu nhầm khi xem 23/11.

### Check/test và dọn môi trường mới

- `npm run check`: **PASS, 19 EJS** tại source `5c3e72d50a9802a1533a9ca7b17db0fb8fc3aa47` — [log](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/check.log).
- Full suite lần đầu: **152 kết quả, gồm 151 pass và 1 lỗi cấp file `migration.test.js`**, không có chẩn đoán đủ để kết luận nguyên nhân — [log thất bại giữ nguyên](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/test-initial-failed.log).
- Chẩn đoán riêng migration trên cùng source/replica: **5/5 pass** — [log](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/migration-diagnostic.log). Sau đó chạy lại toàn bộ: **156/156 pass, 0 fail/skip** — [log](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/test.log). Hai lượt này đặt `DOTENV_CONFIG_PATH` tới đường dẫn không tồn tại trong thư mục QA riêng; không thay source ứng dụng. Lỗi cấp file ban đầu không tái hiện, **nguyên nhân vẫn chưa xác định**, không tuyên bố đã sửa lỗi migration.
- [Validation](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/validation-summary.json) giữ đủ ba lượt; không chỉ giữ dấu xanh. Các ca thu hồi quyền/chuyển cơ sở, biên ngày/năm UTC+7 và DB lỗi trả 500 thuộc bộ test tự động: clock có kiểm soát hoặc method DB mock trong process test, không phải thử mất replica/manual browser.
- Snapshot cuối trên DB mới giữ nguyên cả count và SHA-256 bảy collection: User 7 / Facility 4 / Court 9 / Booking 3 / SlotLock 4 / Payment 1 / BookingRequest 0; session được loại riêng. [Đối chiếu cuối](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/final-db-readonly.json).
- **Đã dọn xong môi trường mới:** app QA và MongoDB riêng đã dừng; chỉ drop DB fixture có marker/phạm vi được xác minh, database khác không đổi. Runtime được kiểm tra đường dẫn/reparse point trước khi xóa. [Cleanup](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/cleanup-summary.json).
- [Review bằng chứng/quyền riêng tư](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/privacy-review.json) **PASS**; đủ 17 ảnh khớp hash/kích thước manifest, các file text đã được rà thông tin riêng. Không thực hiện OCR ảnh; kết quả này không được gọi là xác nhận QA độc lập của con người.
- CI của commit bằng chứng và PR QA tiếp theo được đối chiếu sau push, ghi trong mô tả PR. Không dùng CI thay kiểm thử browser hoặc phê duyệt của nhóm trưởng.

[Tổng hợp lượt main mới](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03-main/acceptance.json). Bằng chứng ở phần này được tạo lại trên source `5c3e72d`, không sao chép số đếm, hash hoặc ảnh của lượt cũ.

## Giới hạn và review lượt main mới

Ghi đúng browser/khả năng thu phiên bản engine, viewport và chuỗi phím đã thử. Deadline fixture nếu rút ngắn phải nêu cụ thể; không gọi là chờ đủ 10 phút thực. POST chuẩn bị fixture được tách khỏi snapshot GET chỉ đọc. Test DB lỗi/clock mock trong process không được trình bày như thử mất replica hoặc quan sát browser thủ công.

Review bởi agent không đồng nghĩa xác nhận QA độc lập của một thành viên khác hoặc phê duyệt của nhóm trưởng. Giữ `Refs #76` trong PR tiếp theo khi còn chờ review/merge; không tự merge.

---

**Lịch sử nguyên văn — lượt 03/11/2026 trên checkout `507ad76`, trước khi cập nhật checkout sang main `5c3e72d`.** Lượt này bắt đầu trước khi #71 merge và một số ảnh được chụp sau thời điểm merge, nhưng ứng dụng vẫn chạy source `507ad76`. Toàn bộ nội dung và ảnh/JSON được giữ nguyên bên dưới; các câu “#71 chờ review/merge” phản ánh thông tin tại lúc soạn báo cáo cũ, trước khi phát hiện trạng thái merge. Kết quả dưới đây không được đổi nhãn thành kết quả trên main mới.

# Kiểm thử lịch điều hành — bổ sung #76 / PR #71

Refs #76. Issue này tiếp tục phần QA còn lại của #66 trên lịch đã có ở main; không tạo tính năng lịch mới. **Lần chạy mới ngày 03/11/2026: đủ bảy nhóm ca, 12/12 ca HTTP, 17/17 record trình duyệt và 149/149 test đạt tại source đã xác minh.** Snapshot cuối sau browser giữ nguyên bảy collection; app/DB/replica thử đã dọn. Sẵn sàng nhóm trưởng review; vẫn dùng `Refs #76` vì chưa được review/merge, không đóng issue chỉ nhờ CI xanh và không tự merge.

## Nền và cách đối chiếu lần #76

- Checkout bắt đầu: `507ad768ed1b25b6c680544601f7e02e1c4a5e0d` trên nhánh `docs/kiem-thu-lich-dieu-hanh`; đã chứa main `36e75cdf33dc7cf7bd568ed3ae938698af47bca1`, gồm backend #68 và UI #69.
- Đã đối chiếu diff các thư mục source, route, app/server, package/lock và CI: source ứng dụng ở checkout này giống main. Chỉ bổ sung tài liệu/bằng chứng QA; không sửa luật đặt, giá hoặc quyền.
- Môi trường lần mới: Node **24.15.0**, MongoDB **8.3.11**, replica set `qaOwnerCalendar76` cục bộ cổng `27061`, app QA cổng `61470`; ứng dụng/controller/service/EJS thật. Không đọc `.env`, dùng Atlas hoặc dữ liệu người thật.
- Fixture tổng hợp: 7 tài khoản, 4 cơ sở, 9 sân. OWNER A có 4 sân (thêm sân 00:00–00:30 để thử ô đã bắt đầu), OWNER B có 2 sân, OWNER tên dài có 3 sân, cơ sở rỗng không có sân. Ngày VN mặc định **03/11/2026**, ngày dữ liệu lịch thường/tên dài/rỗng **06/11/2026**. OWNER đã duyệt được tạo trong fixture; không coi đây là thử lại luồng ADMIN duyệt.
- Browser mới là **Codex in-app qua CUA**, phiên bản engine **không thu được từ API hỗ trợ**, không gán thành Chrome. Viewport **390×844** và **1366×900**. Ảnh và JSON mới nằm trong `kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/`; ảnh JPEG gốc có thể bỏ vùng scrollbar, manifest ghi đúng kích thước và SHA-256, không kéo giãn ảnh.

### Review bằng chứng cũ trước khi chạy

Lượt 28/10 ghi checkout thực thi `bb8057999970e9d063cf107699164971a2ea15cc`, commit bằng chứng `507ad768ed1b25b6c680544601f7e02e1c4a5e0d`. SHA checkout trong JSON HTTP, browser, acceptance và manifest thống nhất; source ứng dụng không khác checkout hiện tại/main. Đã kiểm tra đủ **15 ảnh** lịch sử tồn tại và khớp SHA-256 trong manifest. Sáu record HTTP là TC-01–05/07; TC-06 nằm trong báo cáo browser, không phải một ca HTTP bị thiếu.

Những kiểm tra tĩnh trên chỉ xác minh tính nhất quán của bằng chứng cũ. Ngày hôm nay/ngày nghiệp vụ 28–29/10 và kết quả test 149 ca của lượt cũ không được đổi nhãn thành lượt chạy 03/11. Các lượt 25–26/10 có SHA sai/`targetSHA:null` tiếp tục giữ nguyên như lịch sử đã chú thích, không suy đoán nguồn hoặc tái dùng token.

Ca hết hạn cũ ghi rõ rút deadline fixture xuống 1,5 giây; không coi đó là đã chờ đủ 10 phút. Kết quả ô quá giờ `UNAVAILABLE` từ GET cũng không tự chứng minh POST đặt ô đã bắt đầu bị chặn; nếu thử POST trong lần mới phải ghi kết quả riêng.

## Bảy nhóm ca lần bổ sung 03/11/2026

Source của tất cả kết quả mới dưới đây là **`507ad768ed1b25b6c680544601f7e02e1c4a5e0d`**. [12 ca HTTP/DB](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/http-results.json) gồm ba ca chuyển trạng thái qua POST và chín ca đọc; [17 record browser](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/browser-results.json) có thời điểm, phép đo và ảnh riêng. Commit chỉ thêm báo cáo/ảnh sau đó không được gọi là source đã chạy nếu khác SHA này.

| Ca / bước | Mong đợi | Thực tế lần mới / kết quả | Bằng chứng |
| --- | --- | --- | --- |
| TC-01: khách, CUSTOMER, OWNER chờ/chưa cấp; OWNER A/B; A chèn query owner/facility của B | Trái quyền bị chặn; mỗi chủ chỉ thấy đúng sân/cơ sở mình | **ĐẠT:** khách 303 → `/login`; CUSTOMER/pending/unassigned 403, không lộ hàng sân. A/B 200 và đúng 4/2 sân; query không đổi scope hoặc lộ ID sân cơ sở khác | HTTP `HTTP-AUTH`, `HTTP-OWNER-SCOPE` |
| TC-02: sân 00:00, sáng 05–08, tối 17–22 và inactive 08–09 | Trục giờ là hợp các giờ cấu hình, không chèn giờ giả; ngoài giờ/inactive không phục vụ | **ĐẠT:** 19 cột từ dữ liệu, có 00:00 và khoảng ngắt; trục giống nhau trên các hàng, outside-hours/inactive toàn UNAVAILABLE, nhãn Tạm ngừng đúng | HTTP `HTTP-AXIS-INACTIVE`; ảnh normal bên dưới |
| TC-03: GET ô 05:30 trống → POST HOLD 05:30/06:00 thật → GET → POST demo-payment thật → GET | AVAILABLE → LOCKED → BOOKED; đủ lock và Payment mô phỏng | **ĐẠT:** hai POST đều 303, Booking CONFIRMED/DEMO_PAID, 2 lock và 1 Payment. Có thêm HOLD 06:30 để đối chứng; không giao dịch tiền thật | HTTP `HTTP-TRANSITION`; ảnh normal có BOOKED/LOCKED khi tải trang |
| TC-04: POST HOLD 07:00; rút deadline riêng fixture rồi chờ; thử ô hôm nay 00:00 bằng GET và POST | Ô tương lai hết hạn mở lại; ô đã bắt đầu không đặt được; CONFIRMED/lock khác giữ nguyên; GET không dọn DB | **ĐẠT:** 07:00 LOCKED → AVAILABLE; 06:30 còn LOCKED, 05:30 vẫn BOOKED. Booking hết hạn vẫn HOLD và lock còn trong DB sau GET. Ô 00:00 hôm nay UNAVAILABLE, POST giữ thật trả 400, snapshot nghiệp vụ không đổi | HTTP `HTTP-LIVE-EXPIRED-HOLD`, `HTTP-STARTED-POST` |
| TC-05: GET mặc định VN/7 ngày/+20 ngày; sáu query ngày lỗi; nhập ngày, Tab và Enter | Đúng ngày/lựa chọn, giữ ngày sau GET; query lỗi không thành lịch trống | **ĐẠT:** mặc định 03/11; 7 link 03–09/11; tương lai 23/11 trả 200, vẫn giữ tuần từ hôm nay và không đánh dấu nhầm ngày đang xem. Sáu query rỗng/sai/không tồn tại/quá khứ/lặp đều 400. Browser Enter mở 07/11 ở mobile, 23/11 ở desktop và giữ input/URL | HTTP `HTTP-DATES`, `HTTP-BAD-DATES`; ảnh date-focus/date-submit |
| TC-06: thường/rỗng/tên dài tại 390×844 và 1366×900; Tab vào bảng, phím phải/trái | Đọc được, không tràn trang, focus rõ; bảng cuộn riêng, tên sân cố định | **ĐẠT:** 17/17 record và 17 JPEG thật. Normal 4 sân, long 3 sân với tên 150/địa chỉ 500 ký tự escape, empty 0 sân. Document không tràn ngang; focus solid 2.66667px. ArrowRight làm region cuộn, documentScrollX vẫn 0 và tọa độ cột tên sân không đổi | [Browser](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/browser-results.json), [manifest](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/screenshot-manifest.json) |
| TC-07: snapshot/hash 7 collection sau chuẩn bị fixture, trước/sau GET hợp lệ/lỗi và toàn bộ browser | User/Facility/Court/Booking/SlotLock/Payment/BookingRequest không đổi; loại session | **ĐẠT:** count và SHA-256 bảy collection giữ nguyên qua cả HTTP và browser. User 7, Facility 4, Court 9, Booking 3, SlotLock 4, Payment 1, BookingRequest 0; session được loại riêng | HTTP `HTTP-READ-ONLY`; [snapshot trước browser](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/browser-db-before.json), [sau browser](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/browser-db-after.json), [đối chiếu cuối](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/final-db-readonly.json) |

**Phương pháp TC-04 mới:** tạo HOLD bằng POST thật; chỉ trong DB QA đặt deadline Booking/SlotLock của ô 07:00 thành now+1,5 giây và chờ thực **1.850ms** trước khi GET. Không thay source hoặc đồng hồ hệ điều hành; không khẳng định đã chờ đủ 10 phút. Các ảnh normal được chụp khi HOLD 06:30 còn hạn trước deadline **03/11/2026 07:33:23.460 UTC** (14:33:23.460 UTC+7); lịch hiển thị trạng thái tại lúc tải trang.

### 17 ảnh mới và thao tác browser

| Trạng thái / thao tác | 390×844 | 1366×900 |
| --- | --- | --- |
| Cơ sở thường, 4 sân, BOOKED/LOCKED | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/normal-390.jpg) | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/normal-1366.jpg) |
| Tên cơ sở/địa chỉ/sân dài | [Toàn trang](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/long-390.jpg), [bảng](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/long-table-390.jpg) | [Toàn trang](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/long-1366.jpg), [bảng](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/long-table-1366.jpg) |
| Cơ sở chưa có sân | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/empty-390.jpg) | [Ảnh](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/empty-1366.jpg) |
| Focus Xem lịch qua Tab và Enter gửi GET | [Focus](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/date-focus-390.jpg), [ngày 07/11](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/date-submit-390.jpg) | [Focus](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/date-focus-1366.jpg), [ngày 23/11](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/date-submit-1366.jpg) |
| Focus region và cuộn bằng phím | [Focus](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/table-focus-390.jpg), [phải](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/table-right-390.jpg) | [Focus](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/table-focus-1366.jpg), [phải](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/table-right-1366.jpg), [trái](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/table-left-1366.jpg) |

Tại cả hai viewport, Tab từ liên kết ngày cuối đến region lịch có focus rõ. ArrowRight được đo trong lúc animation native: `scrollLeft` từ 0 thành **32.6667px ở mobile / 34px ở desktop**; không đổi `documentScrollX`, cột tên sân vẫn tại tọa độ cũ. Desktop ArrowLeft sau khi ổn định về 0. Không đổi các giá trị đo trung gian này thành 40px chỉ để khớp lần cũ.

Form ngày: điền input 07/11 ở mobile hoặc 23/11 ở desktop, Tab qua bốn segment/điểm dừng native tới nút Xem lịch rồi Enter thật. URL và input sau GET giữ ngày đã điền; tuần lựa chọn vẫn 03–09/11. Các đo DOM và kết quả phím đến từ cùng phiên browser, không suy ra từ lint.

### Check, test và dọn môi trường

- `npm run check`: **PASS, 19 EJS** tại source `507ad768ed1b25b6c680544601f7e02e1c4a5e0d`.
- `npm test`: **149/149 PASS, 0 fail/skip**, chạy mới trên DB thử tại cùng source; [tổng hợp validation](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/validation-summary.json).
- Các nhánh DB lỗi trả 500, quyền bị thu hồi/chuyển cơ sở với session cũ và biên ngày/năm UTC+7 nằm trong bộ test tự động mới. Test lỗi DB mock method trong process test, clock boundary dùng clock service có kiểm soát; không gọi đó là thử mất replica hoặc quan sát browser thủ công.
- Snapshot cuối sau toàn bộ HTTP/browser **giữ nguyên** bảy collection; session được loại riêng. [Đối chiếu cuối](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/final-db-readonly.json) chứa count/hash trước/sau, không chứa raw dữ liệu người đặt.
- App và MongoDB QA đã dừng; chỉ drop DB fixture sau kiểm tra marker/phạm vi; database khác không đổi. Runtime đã kiểm tra đường dẫn và reparse point trước khi dọn. [Kết quả cleanup](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/cleanup-summary.json).
- [Review quyền riêng tư và tính toàn vẹn](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/privacy-review.json): **PASS**, 17 ảnh và 10 file text; 17 ảnh khớp hash/kích thước manifest. Đây là review bằng chứng bởi agent, không phải xác nhận QA độc lập của con người.
- CI của commit bàn giao cuối được theo dõi tại [PR #71](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/71); kết quả sau push ghi trong PR. Không dùng CI thay kiểm thử trình duyệt hoặc xác nhận nhóm trưởng.
- [Tổng hợp nghiệm thu mới](kiem-thu-lich-dieu-hanh/acceptance-2026-11-03/acceptance.json). HTTP, template và CI không thay bằng chứng bố cục/bàn phím.

### Giới hạn và bàn giao

- Chỉ khẳng định những ca, viewport và chuỗi bàn phím thực sự đã chạy. Resize browser desktop không phải thử điện thoại vật lý hoặc mọi engine/zoom.
- Nếu điều chỉnh deadline trong DB QA, ghi cụ thể mốc, thời gian chờ và phạm vi dữ liệu; không thay đồng hồ hệ điều hành hoặc mô tả như đã đợi 10 phút thật.
- Snapshot phải bao quanh các GET sau khi hoàn tất bước tạo/đổi trạng thái fixture; POST chuẩn bị dữ liệu không được lẫn vào kết luận GET chỉ đọc. Phiên browser có snapshot riêng; session được loại khỏi bảy collection nghiệp vụ.
- Review báo cáo bởi agent khác không thay xác nhận QA độc lập của thành viên khác hoặc quyết định review/merge của nhóm trưởng. Giữ `Refs #76` khi chưa có xác nhận đó.

---

**Lịch sử nguyên văn — lượt nghiệm thu #66 ngày 28/10/2026.** Nội dung và kết luận bên dưới chỉ áp dụng lượt cũ/SHA đã ghi; phần `Closes #66` cũ không phải tham chiếu đóng issue #76.

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
