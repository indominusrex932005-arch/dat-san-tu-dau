> **DRAFT — CHƯA NGHIỆM THU #67 (review 27/10/2026).** Các bảng PASS bên dưới là kết quả mock/EJS lịch sử được báo cáo, không chứng minh hai phiên thật, transaction/DB hoặc trình duyệt. Chưa chạy lại trên SHA tích hợp cuối.
>
> PR #74 đã loại source backend #70/UI #73 khỏi diff main. Runner mock lịch sử được lưu dạng `.txt` tại `docs/kiem-thu-goi-y-san/court-suggestion-qa.test.js.txt`, không chạy trên main đang thiếu backend/UI. Sau khi #70/#73 merge, khôi phục runner phù hợp và chạy lại; không cherry-pick cả chuỗi source qua PR QA.
>
> Bắt buộc còn thiếu: A thấy gợi ý, B giữ trước, A gửi lựa chọn cũ nhận HTTP 409; snapshot DB chứng minh không đơn A một phần/không lock trùng; browser 390/1366, Tab/Enter, chi tiết rồi Back; hash dữ liệu đặt sân trước/sau GET gợi ý. Đây là tiêu chí #67, không phải ngoài phạm vi.
>
> #73 có bằng chứng UI bổ sung trên source f056f19; không tự chuyển thành nghiệm thu #67 hoặc main cuối. #74 giữ Draft, chỉ Refs #67. Người bàn giao: Triều; Codex thực hiện phiên sửa này.
# Kiểm thử gợi ý sân và giờ thay thế — Issue #67

## Thông tin tổng quan

| Mục | Giá trị |
|-----|---------|
| **Issue** | #67 |
| **Nhánh** | `docs/kiem-thu-goi-y-san` |
| **Base** | `feat/ui-court-suggestions` (commit `ae55bac`) |
| **Ngày kiểm thử** | 2026-10-26 |
| **Người thực hiện** | lhtrieu2703-beep |
| **Phạm vi** | `suggestCourts`, `searchCourts`, `views/partials/court-suggestions.ejs`, `views/courts.ejs` |
| **Phương pháp** | Unit test tự động (Node.js test runner + mock) |
| **Công cụ** | `node --test`, `ejs` render, `node:assert/strict` |

## Kết quả tổng hợp

| Suite | Ca kiểm thử | PASS | FAIL |
|-------|------------|------|------|
| QA-01: Điều kiện kích hoạt gợi ý | 6 | **6** | 0 |
| QA-02: Đúng ngày, thời lượng, facilityId | 5 | **5** | 0 |
| QA-03: Xử lý locks và trạng thái sân | 7 | **7** | 0 |
| QA-04: Xếp hạng và giới hạn 3 gợi ý | 5 | **5** | 0 |
| QA-05: Tính giá qua mốc cao điểm | 4 | **4** | 0 |
| QA-06: Link Xem lịch và GET-idempotent | 3 | **3** | 0 |
| QA-07: Ca tranh chỗ (race condition) | 4 | **4** | 0 |
| QA-08: View — biên giới và accessibility | 9 | **9** | 0 |
| **TỔNG** | **43** | **43** | **0** |

> **Ghi chú**: File test `tests/court-suggestion-qa.test.js` chứa 51 test nodes được báo cáo (test runner đếm test/subtest, không đếm từng assert). Tất cả `pass 51 / fail 0`.

---

## QA-01: Điều kiện kích hoạt gợi ý

Xác nhận `searchCourts` chỉ sinh gợi ý khi đủ điều kiện.

| ID | Mô tả | Đầu vào | Kết quả mong đợi | Kết quả thực tế |
|----|-------|---------|-----------------|----------------|
| QA-01-a | Query đủ date+startTime+endTime, 0 kết quả chính | `date=2026-11-02, start=18:00, end=19:00`, sân bị chặn hết | `suggestions.length > 0`, message chứa "Khung giờ bạn tìm hiện đã kín" | ✅ PASS |
| QA-01-b | Có kết quả chính → KHÔNG sinh gợi ý | Query hợp lệ, sân trống hoàn toàn | `suggestions = []`, `suggestionMessage = null` | ✅ PASS |
| QA-01-c | Chỉ có date (thiếu startTime/endTime) | `date=2026-11-02` | `suggestions = []`, không gọi suggestCourts | ✅ PASS |
| QA-01-d | Query lỗi: endTime ≤ startTime | `start=18:00, end=17:00` | `RuleError` chứa "sau giờ bắt đầu" | ✅ PASS |
| QA-01-e | suggestCourts trực tiếp — thiếu date | `startTime=18:00, endTime=19:00` (không có date) | `RuleError` chứa "chọn ngày" | ✅ PASS |
| QA-01-f | Tham số lặp lại (array) | `date=[...,...], startTime=18:00, endTime=19:00` | `RuleError` chứa "lặp lại" | ✅ PASS |

---

## QA-02: Đúng ngày, đúng thời lượng, lọc facilityId

| ID | Mô tả | Đầu vào | Kết quả mong đợi | Kết quả thực tế |
|----|-------|---------|-----------------|----------------|
| QA-02-a | Gợi ý đúng ngày tìm kiếm | date=2026-11-02 | Tất cả `sug.date === '2026-11-02'` | ✅ PASS |
| QA-02-b | Thời lượng đúng yêu cầu (90 phút) | start=09:00, end=10:30 | Tất cả `sug.totalMinutes === 90` | ✅ PASS |
| QA-02-c | facilityId lọc đúng | facilityId=A, candidates=[courtA, courtB] | Chỉ gợi ý sân cơ sở A; reason chứa "Cùng cơ sở" | ✅ PASS |
| QA-02-d | Không có facilityId → gợi ý nhiều cơ sở | facilityId='' | reason chứa tên cơ sở đầy đủ | ✅ PASS |
| QA-02-e | Sân giờ phục vụ hẹp (60 phút) vs yêu cầu 90 phút | closeTime - openTime < durationMin | suggestions = 0 | ✅ PASS |

---

## QA-03: Xử lý locks và trạng thái sân/cơ sở

| ID | Mô tả | Đầu vào | Kết quả mong đợi | Kết quả thực tế |
|----|-------|---------|-----------------|----------------|
| QA-03-a | HOLD còn hạn (expiresAt > now) | lock 18:00 expiresAt +1h | Không gợi ý 18:00 | ✅ PASS |
| QA-03-b | BOOKED (expiresAt = null) | lock 18:00 expiresAt=null | Không gợi ý 18:00 | ✅ PASS |
| QA-03-c | Lock hết hạn (expiresAt < now) | lock 18:00 expiresAt -1m | Gợi ý 18:00-19:00 được sinh ra | ✅ PASS |
| QA-03-d | Sân inactive | `active: false` | suggestions = 0 | ✅ PASS |
| QA-03-e | Cơ sở chủ sân PENDING | ownerStatus='PENDING' | suggestions = 0 | ✅ PASS |
| QA-03-f | Cơ sở SĐT không hợp lệ | phone='123' | suggestions = 0 | ✅ PASS |
| QA-03-g | Ô quá khứ (hôm nay, giờ qua) | now=12:00, tìm 10:00-11:00 hôm nay | Tất cả gợi ý bắt đầu ≥ 12:00 | ✅ PASS |

---

## QA-04: Xếp hạng và giới hạn 3 gợi ý

| ID | Mô tả | Đầu vào | Kết quả mong đợi | Kết quả thực tế |
|----|-------|---------|-----------------|----------------|
| QA-04-a | Xếp theo độ lệch giờ tuyệt đối tăng dần | 2 sân, 18:00 bị chặn | `|offset[0]| ≤ |offset[1]| ≤ |offset[2]|` | ✅ PASS |
| QA-04-b | Cùng offset → giá tăng dần | courtA1 (50k) vs courtA2 (60k), cùng offset | courtA1 đứng trước courtA2 | ✅ PASS |
| QA-04-c | Tối đa 3 không trùng | 3 sân × nhiều ô | `length ≤ 3`, không trùng courtId+date+startTime | ✅ PASS |
| QA-04-d | 0 sân khả dụng | Tất cả ô bị lock | suggestions=[], message chứa "đổi ngày" hoặc "khoảng giờ khác" | ✅ PASS |
| QA-04-e | Đúng 1 ô trống → 1 gợi ý | Chỉ 17:00 còn trống | suggestions.length === 1, startTime=17:00 | ✅ PASS |

---

## QA-05: Tính đúng giá qua mốc cao điểm

> Không dùng giá client — giá được tính từ `quoteSelection()` phía server.

| ID | Mô tả | Đầu vào | Kết quả mong đợi | Kết quả thực tế |
|----|-------|---------|-----------------|----------------|
| QA-05-a | Khung 16:30-17:30 vắt qua peak 17:00 | peakStart=17:00, base=50k, peak=80k | totalPriceVND = 130.000 ₫ (50k+80k) | ✅ PASS |
| QA-05-b | Khung 20:00-21:00 ngoài peak | 2 ô × base 50k | totalPriceVND = 100.000 ₫ | ✅ PASS |
| QA-05-c | quoteSelection — 4 ô peak 80k | times=['17:00','17:30','18:00','18:30'] | 320.000 ₫ | ✅ PASS |
| QA-05-d | quoteSelection — 2 ô hỗn hợp | times=['16:30','17:00'] | 130.000 ₫ | ✅ PASS |

---

## QA-06: Link "Xem lịch" và tính GET-idempotent

| ID | Mô tả | Đầu vào | Kết quả mong đợi | Kết quả thực tế |
|----|-------|---------|-----------------|----------------|
| QA-06-a | HTML chứa link đúng courtId/date | courtId=aabbcc..., date=2026-11-05 | `href="/courts/aabbcc...?date=2026-11-05"` | ✅ PASS |
| QA-06-b | Link là thẻ `<a>` (GET), không có form POST | — | `<a class="courts-button court-suggestion-action">`, không có `method=post` | ✅ PASS |
| QA-06-c | aria-label chứa courtName và date | courtName='Sân Kiểm Thử' | `aria-label="Xem lịch sân Sân Kiểm Thử..."` | ✅ PASS |

---

## QA-07: Ca tranh chỗ (race condition logic)

Mô phỏng kịch bản: Phiên A xem gợi ý → Phiên B can thiệp → Phiên A submit.

| ID | Mô tả | Kịch bản | Kết quả mong đợi | Kết quả thực tế |
|----|-------|---------|-----------------|----------------|
| QA-07-a | B HOLD ô mà A đang muốn | lock 18:00 expiresAt +10m | suggestCourts không trả 18:00 | ✅ PASS |
| QA-07-b | B BOOKED ô mà A đang muốn | lock 18:00 expiresAt=null | suggestCourts không trả 18:00 | ✅ PASS |
| QA-07-c | HOLD của B hết hạn → A thấy lại | lock 18:00 expiresAt -1s | suggestCourts trả lại 18:00-19:00 | ✅ PASS |
| QA-07-d | suggestCourts không tạo SlotLock (chỉ đọc) | Spy trên SlotLock.create | `SlotLock.create` không bị gọi | ✅ PASS |

> **Lưu ý kỹ thuật**: Ca tranh chỗ thực tế (A submit sau khi B đã HOLD) được xử lý ở tầng booking controller (409 Conflict + form phục hồi), không phải ở `suggestCourts`. Issue #67 kiểm thử rằng **danh sách gợi ý luôn phản ánh trạng thái DB tại thời điểm query**, nghĩa là nếu B đã HOLD/BOOK thì A sẽ nhận danh sách gợi ý không chứa ô đó — giảm thiểu xác suất xung đột khi A tiến hành đặt.

---

## QA-08: View — biên giới và accessibility

| ID | Mô tả | Kết quả mong đợi | Kết quả thực tế |
|----|-------|-----------------|----------------|
| QA-08-a | 0 gợi ý + message → section hiện, không có card | `court-suggestion-section` tồn tại, không có `court-suggestion-card` | ✅ PASS |
| QA-08-b | 1 gợi ý → đúng 1 card | `count(court-suggestion-card) === 1` | ✅ PASS |
| QA-08-c | 3 gợi ý → đúng 3 card | `count(court-suggestion-card) === 3` | ✅ PASS |
| QA-08-d | Tên sân 200 ký tự → không lỗi render | Không throw exception | ✅ PASS |
| QA-08-e | XSS escape — script/HTML trong tên | `<script>` → `&lt;script&gt;` | ✅ PASS |
| QA-08-f | aria-labelledby trên section gợi ý | `aria-labelledby="court-suggestion-heading"`, `id="court-suggestion-heading"` | ✅ PASS |
| QA-08-g | filterError → không hiển thị section gợi ý | Không có `court-suggestion-section` khi có filterError | ✅ PASS |
| QA-08-h | Thiếu startTime/endTime → không hiển thị gợi ý | Không có `court-suggestion-section` | ✅ PASS |
| QA-08-i | formatMoney đúng + nhãn "Tổng giá phương án" | `130.000`, không có "giá mỗi giờ" | ✅ PASS |

---

## Baseline unit tests (toàn bộ suite không cần DB)

```
node --test tests/booking-rules.test.js tests/court-search.test.js
         tests/court-suggestion.test.js tests/court-suggestions-view.test.js
         tests/court-suggestion-qa.test.js

pass 87 / fail 0 / cancelled 0 / skipped 0
```

---

## Các ca bắt buộc chưa chạy trong báo cáo lịch sử

| Hạng mục | Lý do |
|---------|-------|
| HTTP end-to-end qua live server | Cần PR #64 và #65 merge vào main, MongoDB replica set live |
| Viewport thực trên trình duyệt (390×844, 1366×900) | Cần Playwright/Selenium — nằm ngoài phạm vi unit/integration |
| Tab/Enter keyboard navigation thực tế | Kiểm thử trình duyệt thủ công |
| Back từ trang chi tiết → giữ filter | Browser history — cần E2E |

---

## Môi trường kiểm thử

| Thành phần | Giá trị |
|-----------|---------|
| Node.js | v22.x |
| MongoDB | Không dùng (unit test + mock) |
| `npm run check` | PASS (ESLint + 18 EJS template) |
| OS | Windows 11 |
| Nhánh | `docs/kiem-thu-goi-y-san` |
| Commit base | `ae55bac` (feat/ui-court-suggestions) |

---

## Refs

- Refs #67
- Depends on #64 (feat/backend-court-suggestions) + #65 (feat/ui-court-suggestions)
- Liên quan: PR #70 (#64), PR #73 (#65)

## Kiểm tra sau khi tách source (27/10/2026)

Nền main f8c1cfb; diff chỉ còn ba tệp tài liệu/JSON/runner lịch sử dạng txt. npm run check PASS (17 EJS), npm test 111/111 PASS, 0 fail/skip trên DB QA localhost riêng. Đây là kiểm tra nền main, không phải nghiệm thu gợi ý. Không force-push hoặc merge.
