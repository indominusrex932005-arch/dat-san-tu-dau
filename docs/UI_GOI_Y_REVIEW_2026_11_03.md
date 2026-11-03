# Bổ sung nghiệm thu UI gợi ý sân — #75 / PR #73

Refs #75. Tiếp tục [PR #73](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/73) trên nhánh `feat/ui-court-suggestions`; giữ [báo cáo ngày 27/10](UI_GOI_Y_REVIEW_2026_10_27.md) và ảnh cũ như bằng chứng lịch sử.

**Trạng thái ngày 03/11/2026: 20/20 ca trình duyệt đạt trên source UI cuối, đủ 20 ảnh ở hai viewport; đã dọn môi trường thử.** CI của commit bàn giao được liên kết trong phần mô tả PR sau khi push. Chưa kết luận hoàn thành #75: điều kiện review/merge thuộc nhóm trưởng. Không tự merge hoặc dùng `Closes #75` trước khi đủ điều kiện của issue.

## Nền và phạm vi

- SHA bắt đầu nghiệm thu: `4b5c02d7c025ec29bff30bece3f9a629e312b7d5`, đã chứa main `36e75cdf33dc7cf7bd568ed3ae938698af47bca1`; PR hiện trỏ vào `main`, không cần merge lại cùng nền này.
- Source UI cuối đã thử: `e353727dbcaa4985a155bd5f0974915284db620b`. Commit này chỉ sửa CSS để bỏ khoảng trống cao quá mức trong thông tin gợi ý trên mobile; các commit báo cáo/ảnh sau đó cần ghi riêng.
- Backend [PR #70](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/70) đã merge; head bàn giao `d115d4ad3bb562d1a46681dd4a662ea57480ac15`. Không viết lại luật xếp hạng, giá hoặc backend để làm UI đạt.
- File UI chính: `views/partials/court-suggestions.ejs`, `public/css/court-suggestions.css`, `views/courts.ejs`. Giữ bộ lọc hiện tại, EJS escape và liên kết thật đến đúng sân/ngày; thao tác xem gợi ý không tự chọn ô hoặc tạo lượt giữ chỗ.
- Dùng ứng dụng/controller/service/EJS và DB thử cục bộ riêng: replica set `qaSuggestionsUi75`, cổng `27060`; không đọc `.env`, không dùng hoặc thay đổi Atlas chung.

## Kết quả lần chạy này

[JSON nghiệm thu](ui-goi-y-review-2026-11-03/acceptance.json) · [20 ca trình duyệt](ui-goi-y-review-2026-11-03/browser-results.json) · [HTTP/DB](ui-goi-y-review-2026-11-03/http-results.json) · [Check và test](ui-goi-y-review-2026-11-03/validation-summary.json) · [Dọn môi trường](ui-goi-y-review-2026-11-03/cleanup-summary.json) · [Kiểm tra thông tin riêng](ui-goi-y-review-2026-11-03/privacy-review.json).

Trình duyệt **Codex in-app qua CUA (IAB)**; chưa thu được phiên bản engine, không ghi thành kết quả Chrome. Viewport **390×844** và **1366×900**; ảnh full-page có bề rộng nội dung **375px/1351px** vì thanh cuộn dọc chiếm 15px. Đây là viewport trình duyệt, không phải điện thoại vật lý.

| Trạng thái qua app/DB thật | Kết quả | 390×844 | 1366×900 |
| --- | --- | --- | --- |
| 0 gợi ý | **Đạt**: thông báo mời đổi ngày/khoảng giờ, không dựng thẻ giả | [Ảnh](ui-goi-y-review-2026-11-03/zero-390.jpg) | [Ảnh](ui-goi-y-review-2026-11-03/zero-1366.jpg) |
| 1 gợi ý | **Đạt**: đúng sân, cơ sở, ngày/giờ, thời lượng, lý do và tổng giá server | [Ảnh](ui-goi-y-review-2026-11-03/one-390.jpg) | [Ảnh](ui-goi-y-review-2026-11-03/one-1366.jpg) |
| 3 gợi ý, tên sân/cơ sở dài | **Đạt**: tối đa ba thẻ; chuỗi dài xuống dòng, không tràn toàn trang | [Ảnh](ui-goi-y-review-2026-11-03/three-390.jpg) | [Ảnh](ui-goi-y-review-2026-11-03/three-1366.jpg) |
| Phương án qua mốc cao điểm | **Đạt**: hiển thị tổng giá phương án do backend tính, không gắn nhãn giá mỗi giờ | [Ảnh](ui-goi-y-review-2026-11-03/peak-390.jpg) | [Ảnh](ui-goi-y-review-2026-11-03/peak-1366.jpg) |
| Query sai | **Đạt**: có thông báo lỗi phù hợp, giữ filter, không hiện gợi ý | [Ảnh](ui-goi-y-review-2026-11-03/invalid-390.jpg) | [Ảnh](ui-goi-y-review-2026-11-03/invalid-1366.jpg) |
| Thiếu ngày | **Đạt**: không hiện gợi ý khi bộ lọc thiếu điều kiện ngày | [Ảnh](ui-goi-y-review-2026-11-03/missing-date-390.jpg) | [Ảnh](ui-goi-y-review-2026-11-03/missing-date-1366.jpg) |
| Có kết quả chính | **Đạt**: giữ danh sách sân, không hiện gợi ý đồng thời | [Ảnh](ui-goi-y-review-2026-11-03/primary-390.jpg) | [Ảnh](ui-goi-y-review-2026-11-03/primary-1366.jpg) |

| Thao tác và kiểm tra bổ sung | Trạng thái |
| --- | --- |
| Mobile: Tab đến Xem lịch, focus rõ | **Đạt** — [ảnh focus](ui-goi-y-review-2026-11-03/focus-390.jpg) |
| Mobile: Enter mở đúng courtId/date, không tự chọn hoặc giữ ô | **Đạt** — [ảnh trang chi tiết](ui-goi-y-review-2026-11-03/detail-390.jpg) |
| Mobile: Back giữ URL và bộ lọc | **Đạt** — [ảnh quay lại](ui-goi-y-review-2026-11-03/back-390.jpg) |
| Desktop: Tab đến Xem lịch, focus rõ | **Đạt** — viền focus đo được 2.66667px; [ảnh focus](ui-goi-y-review-2026-11-03/focus-1366.jpg) |
| Desktop: Enter đến chi tiết đúng courtId/date, không tự chọn hoặc giữ ô | **Đạt** — 0 ô được chọn, nút giữ chỗ vẫn disabled; [ảnh chi tiết](ui-goi-y-review-2026-11-03/detail-1366.jpg) |
| Desktop: Back giữ URL và bộ lọc | **Đạt** — [ảnh quay lại](ui-goi-y-review-2026-11-03/back-1366.jpg) |
| HTTP/DB trên source cuối `e353727` | **10/10 đạt**; kết quả và snapshot chi tiết trong JSON HTTP/DB |
| `npm run check` trên source cuối `e353727` | **Đạt**, 19 EJS |
| `node --test tests/court-suggestions-view.test.js` trên `e353727` | **7/7 đạt**, 0 lỗi/bỏ qua |
| `npm test` trên source tích hợp `4b5c02d` | **156/156 đạt** trước commit chỉ thay CSS; không trình bày như đã chạy lại toàn bộ sau sửa CSS |
| Snapshot sau toàn bộ thao tác trình duyệt và dọn DB thử | **Đạt**: count/hash của 7 collection nghiệp vụ không đổi; chỉ DB fixture có marker được xóa, tên các DB khác không đổi; app và MongoDB thử đã dừng |

Dữ liệu thử có bốn cơ sở/sân riêng và bốn đơn xác nhận qua luồng POST + thanh toán DEMO thật, tạo tám ô đã đặt. Ngày tìm 07/11/2026, ngày có kết quả chính 08/11/2026. Ca qua mốc cao điểm gợi ý 16:30–17:30: ô 16:30 giá 50.000đ + ô 17:00 giá 75.000đ = **125.000đ/60 phút**. Ca ba gợi ý giữ thứ tự backend: 16:00–17:00 (100.000đ), 18:00–19:00 và 18:30–19:30 (đều 150.000đ). Tên sân/cơ sở 150 ký tự, địa chỉ 500 ký tự là dữ liệu tổng hợp.

### Sửa khoảng trống thông tin trên mobile

Trước sửa, `.court-suggestion-info-item` giữ `flex-basis: 80px` khi khối thông tin chuyển sang xếp dọc, khiến mỗi dòng ngày/giờ/thời lượng cao dư. Commit `e353727` đặt riêng trong breakpoint mobile `flex: 0 1 auto`; chiều cao tự nhiên quan sát được còn **41.1875px** thay vì 80px. Đã quan sát lại các trạng thái trên ở source cuối; không sửa luật giá hoặc xếp hạng.

Kết quả bố cục/bàn phím phải đến từ trình duyệt thật; HTTP, render template hoặc CI không thay cho các bằng chứng này. SHA của phần source và commit chỉ bổ sung tài liệu/ảnh cần được ghi riêng nếu khác nhau.

## Kiểm tra riêng thay đổi CI

Đối chiếu với main và commit `4b5c02d`: `.github/workflows/ci.yml` chỉ đổi runner **`ubuntu-24.04` → `ubuntu-22.04`** cùng hai comment. Package và lockfile không đổi; vẫn giữ `npm ci`, `npm run check`, khởi tạo replica set MongoDB thật, chờ primary, `npm test`, log khi lỗi và cleanup `always()`.

- [Run cũ 40661959085](https://github.com/indominusrex932005-arch/dat-san-tu-dau/actions/runs/40661959085), source `5674c15`, runner `ubuntu-24.04`: kiểm tra JavaScript/EJS thành công, khởi tạo MongoDB thất bại; bước test bị bỏ qua vì DB chưa sẵn sàng, cleanup vẫn thành công.
- [Run 40667598117](https://github.com/indominusrex932005-arch/dat-san-tu-dau/actions/runs/40667598117), source `4b5c02d7c025ec29bff30bece3f9a629e312b7d5`, runner `ubuntu-22.04`: các bước check, replica set, test và cleanup đều thành công. Chỉ bước log khi lỗi được bỏ qua đúng điều kiện `failure()`.

Đã xác minh nhãn runner và kết quả từng bước từ metadata GitHub Actions. Chú thích kernel `6.8`/SERVER-121912 là lý do lịch sử trong workflow/PR; lần review này chưa xác minh trực tiếp kernel hoặc quan hệ nguyên nhân đó. Không bỏ hoặc làm yếu bước test để lấy dấu xanh. Kết quả và liên kết CI trên commit bàn giao được ghi ở mô tả PR; commit báo cáo/ảnh không thay source UI đã nghiệm thu.

## Bàn giao

Giữ `Refs #75` trong PR khi còn chờ nhóm trưởng review/merge. Báo cáo mới chỉ bổ sung kết quả của lần chạy này; không đổi các ca chưa chạy thành đã đạt và không trình bày UI này như đã được tích hợp vào main trước khi PR được merge.
