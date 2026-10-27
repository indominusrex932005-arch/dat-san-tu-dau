# Giao diện lịch điều hành — #63 / PR #69

**Cập nhật ngày 27/10/2026: đã tích hợp main, đổi base PR sang `main` và hoàn tất bằng chứng nghiệm thu UI. Sẵn sàng gửi review; chuyển khỏi Draft sau khi đẩy bản cập nhật và đối chiếu CI.**

## Nền tích hợp hiện tại

- [Backend PR #68](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/68) đã merge lúc **26/10/2026 16:42:55 UTC** (23:42:55 giờ Việt Nam).
- Nhánh UI `draft/ui-owner-calendar` đã merge `main` tại `923543f` bằng commit **`de43a7052a0675e3cefc6d985a6a746c6c80582c`**. [PR #69](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/69) hiện có base là **`main`**.
- SHA source cuối đã thử: **`e3aea06119c7cddadf6ec3d357d71a390986e04f`**, gồm sửa selector CSS cho góc cố định của bảng; các commit bằng chứng sau đó chỉ bổ sung tài liệu/ảnh.
- Hợp đồng locals backend không thay đổi so với bản nháp; giữ view lịch của UI khi xử lý xung đột lịch sử merge. Hợp đồng chính thức: [backend #62](../HOP_DONG_LICH_DIEU_HANH.md).
- Hai file QA #66 `docs/KIEM_THU_LICH_DIEU_HANH.md` và `docs/kiem-thu-lich-dieu-hanh/qa-results-66.json` đã được tách khỏi diff UI. [PR #71](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/71) tại `dbb0933f8f886352f2fd899c55bccff06d17f582` được giữ nguyên trong lần cập nhật này; kết quả của #71 không được dùng thay bằng chứng UI #63.

## Phạm vi UI

| File | Thay đổi |
| --- | --- |
| `views/owner-calendar.ejs` | Cơ sở/ngày đang xem, form GET, bảy lựa chọn ngày, chú giải, bảng và trạng thái rỗng; bỏ CSS inline |
| `public/css/owner-calendar.css` | CSS riêng của trang lịch, màu dự án, tên dài xuống dòng, focus, vùng bảng cuộn và cột/tiêu đề sticky, breakpoint 700px/480px |
| `views/owner-dashboard.ejs` | Giữ liên kết thật `/owner/calendar`, nhãn “Lịch điều hành” |

View dùng `facility, selectedDate, dayOptions, timeColumns, courtRows` do backend truyền; không tự tạo giờ phục vụ hoặc suy ra sân trống. Trạng thái có chữ, ký hiệu và màu: Trống ○, Đang giữ ◷, Đã đặt ✓, Không phục vụ —; sân inactive có nhãn Tạm ngừng. Có hai nhánh “Cơ sở chưa có sân.” và “Chưa có giờ phục vụ.”.

Tên cơ sở, địa chỉ và tên sân giữ EJS escape. Chọn ngày chỉ dùng GET hiện có. Không thêm JS, API, thao tác đặt/giữ/hủy/đổi, giá hoặc thông tin riêng của đơn. Phần UI không sửa controller/service/model/routes/CI/package hoặc CSS chung. Chỉ dùng dữ liệu thử trên DB localhost riêng; không đọc `.env` hoặc ghi dữ liệu Atlas.

## Nghiệm thu lại trên nền main — 27/10/2026

Chạy ứng dụng/controller/service/EJS thật với ba OWNER và cơ sở tổng hợp trên MongoDB replica set localhost riêng. Chrome **156.0.8078.48** trên Windows; dùng DevTools Responsive với viewport **390×844** và **1366×900**. Ảnh là ảnh cửa sổ Chrome gốc, có thanh công cụ hiện kích thước viewport; không cắt/chỉnh ảnh. Desktop dùng Fit (tự thu nhỏ phần hiển thị trong cửa sổ), mobile ở 100%; kích thước nêu trên là CSS viewport.

[Kết quả nghiệm thu](review-2026-10-27/acceptance.json) · [Manifest 28 ảnh, SHA và thời điểm chụp UTC](review-2026-10-27/screenshot-manifest.json). Ảnh được chụp ngày 27/10 theo UTC+7; timestamp UTC trong manifest bắt đầu tối 26/10.

| Hạng mục | Trạng thái |
| --- | --- |
| `npm run check` | **PASS**, 18 EJS tại SHA cuối `e3aea06` |
| `npm test` trên bản tích hợp | **135/135 PASS** tại `de43a70`, trước bản sửa chỉ thay một selector CSS; không gán lần chạy này cho SHA sau sửa |
| HTTP/DB thật: thường/rỗng/tên dài, ngày, quyền, navigation và GET không sửa dữ liệu nghiệp vụ | **11/11 PASS** chạy lại tại SHA cuối `e3aea06` |
| Trang thường tại cả hai viewport | **PASS**: ba sân khác giờ, gồm sân inactive; xem ngày 30/10 có đủ bốn trạng thái thật, bảng cuộn trong vùng riêng |
| Cơ sở chưa có sân tại cả hai viewport | **PASS**: đúng OWNER/cơ sở, số sân 0, thông báo rỗng và liên kết về quản lý; không tạo bảng giả |
| Tên dài tại cả hai viewport | **PASS**: tên cơ sở/sân 150 ký tự, địa chỉ 500 ký tự xuống dòng; chuỗi HTML hiển thị dạng văn bản đã escape, không tràn trang |
| Tab/Shift+Tab và phím trái/phải tại cả hai viewport | **PASS**: tới liên kết ngày cuối rồi vùng bảng, focus rõ; phím mũi tên cuộn cột giờ, góc và cột tên sân giữ cố định |
| Enter/đổi ngày/liên kết về quản lý | **PASS**: Enter trong input desktop gửi GET ngày 27/10; chọn ngày 30/10 cập nhật lựa chọn. Enter trên liên kết ngày mobile gửi GET 02/11 và input giữ ngày. Enter trên liên kết footer desktop mở `/owner`; liên kết lịch trong dashboard mở lại lịch |
| Cuộn bảng và góc cố định | **PASS sau sửa CSS**; không quan sát thấy cuộn ngang toàn trang trong các ca đã thử |

Trong lần kiểm tra Chrome có phát hiện góc “Sân / giờ” bị cột giờ che khi cuộn ngang desktop. Selector góc có độ ưu tiên thấp hơn quy tắc tiêu đề cột; đã tăng selector thành `th.owner-calendar-corner`, giữ nguyên thuộc tính và các quy tắc khác. Đã thử lại cuộn phải của bảng thường, bảng tên dài và bàn phím trên source cuối; góc và cột tên sân giữ cố định. Không phát hiện lỗi chức năng UI mới khác trong phạm vi các ca đã chạy.

### Ảnh thường / rỗng / tên dài

| Dữ liệu | 390×844 | 1366×900 |
| --- | --- | --- |
| Thường | [Đầu trang](review-2026-10-27/normal-390-top.jpg) · [Chọn ngày](review-2026-10-27/normal-390-controls.jpg) · [Bảng](review-2026-10-27/normal-390-table-left.jpg) · [Cuộn bảng](review-2026-10-27/normal-390-table-scroll.jpg) | [Đầu trang](review-2026-10-27/normal-1366-top.jpg) · [Bảng/bốn trạng thái](review-2026-10-27/normal-1366-table-left.jpg) · [Cuộn đến giờ tối](review-2026-10-27/normal-1366-table-right.jpg) |
| Chưa có sân | [Đầu trang](review-2026-10-27/empty-390-top.jpg) · [Thông báo rỗng](review-2026-10-27/empty-390-state.jpg) | [Đầu trang](review-2026-10-27/empty-1366-top.jpg) · [Thông báo rỗng](review-2026-10-27/empty-1366-state.jpg) |
| Tên dài | [Đầu trang](review-2026-10-27/long-390-top.jpg) · [Tên/địa chỉ dài](review-2026-10-27/long-390-facility.jpg) · [Tên sân trong bảng](review-2026-10-27/long-390-table.jpg) | [Tên/địa chỉ dài](review-2026-10-27/long-1366-top.jpg) · [Tên sân trong bảng](review-2026-10-27/long-1366-table.jpg) · [Cuộn bảng](review-2026-10-27/long-1366-scroll.jpg) |

### Ảnh thao tác bàn phím

| Ca | 390×844 | 1366×900 |
| --- | --- | --- |
| Shift+Tab đến ngày cuối, Tab đến bảng | [Focus ngày](review-2026-10-27/keyboard-390-day-focus.jpg) · [Focus bảng](review-2026-10-27/keyboard-390-table-focus.jpg) | [Focus ngày](review-2026-10-27/keyboard-1366-day-focus.jpg) · [Focus bảng](review-2026-10-27/keyboard-1366-table-focus.jpg) |
| Phím mũi tên cuộn cột giờ | [Sang phải](review-2026-10-27/keyboard-390-arrow-right.jpg) | [Sang trái](review-2026-10-27/keyboard-1366-arrow-left.jpg) · [Sang phải](review-2026-10-27/keyboard-1366-arrow-right.jpg) |
| Enter điều hướng bằng GET | [Ngày 02/11 được giữ](review-2026-10-27/keyboard-390-enter-date.jpg) | [Submit input ngày](review-2026-10-27/keyboard-1366-enter-get.jpg) · [Focus liên kết về](review-2026-10-27/keyboard-1366-back-focus.jpg) · [Mở dashboard](review-2026-10-27/keyboard-1366-enter-back.jpg) |

Các kết quả bố cục và bàn phím trên được quan sát trong Chrome, tách với kết quả HTTP/DB và lint. Đây là nghiệm thu UI #63 trên dữ liệu thử của PR #69; không thay báo cáo QA #66 của PR #71 hoặc quyết định review/merge của nhóm trưởng.

## Bằng chứng lịch sử

### Ngày 25/10/2026 — nhánh UI trước khi backend merge

- SHA đã thử: `777fe65bc56ac3de076d405b803ef15a840fdd35`, chứa backend `014117349e9f460fd70ebddd54765663877c8334`; chưa phải nền main mới.
- **11/11 ca HTTP/DB PASS** trên app/controller/service/EJS thật và DB riêng: thường/rỗng/tên dài, ngày mặc định/bảy ngày/ngày xa hơn, đổi và tải lại ngày bằng GET, navigation/CSS, quyền và snapshot dữ liệu. [JSON kết quả đã lọc thông tin riêng](acceptance-2026-10-25.json).
- `npm run check` **PASS**, 18 EJS; `npm test` **134/134 PASS**, 0 fail/skip. Node 24.15.0, MongoDB 8.3.11, replica set localhost riêng `qaCalendarUi69`.
- Chưa có ảnh 390px/1366px hoặc bằng chứng Tab/Enter/cuộn bảng của lần chạy này. Computer Use bị dừng trước khi hoàn tất kiểm tra. Người yêu cầu báo bố cục thường/tên dài và bàn phím hoạt động; đây là xác nhận từ người yêu cầu, không phải kết quả công cụ có ảnh/SHA đi kèm.

### Ngày 24/10/2026 — chuẩn bị template

- Nền nháp: main `f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7` và backend `014117349e9f460fd70ebddd54765663877c8334`. Base PR khi đó là `feat/owner-calendar` để tách diff UI trong lúc chờ review backend.
- `npm run check` **PASS**, 18 EJS. Render EJS riêng **5/5 tình huống PASS**: thường, rỗng, không có cột giờ, tên dài/payload escape/inactive và ngày ngoài bảy lựa chọn. [JSON kết quả render nháp](draft-render-results.json).
- Đây là locals tổng hợp kiểm tra template; chưa chạy app/DB, `npm test` hoặc trình duyệt trong lần ngày 24. Không coi năm tình huống render là bằng chứng dữ liệu hoặc giao diện ứng dụng thật.
