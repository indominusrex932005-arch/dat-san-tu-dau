# Bản nháp giao diện lịch điều hành — #63

**Trạng thái: CHUẨN BỊ, CHƯA HOÀN THÀNH ISSUE #63.** Khi bắt đầu và khi bàn giao nháp, [backend PR #68](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/68) còn mở, chưa merge. Issue #63 cho phép phác bố cục trước, nhưng yêu cầu backend merge trước khi tích hợp UI. Không tự merge backend để bỏ qua bước review.

## Cập nhật nghiệm thu ngày 25/10/2026

- Đã bỏ hai file `docs/KIEM_THU_LICH_DIEU_HANH.md` và `docs/kiem-thu-lich-dieu-hanh/qa-results-66.json` khỏi diff PR UI. Đây là tài liệu QA #66 của PR #71; không sửa/push nhánh #71 và không gộp kết quả đó vào nghiệm thu UI #63.
- Bản đã chạy lần này: `777fe65bc56ac3de076d405b803ef15a840fdd35`, trên nhánh UI chứa backend `014117349e9f460fd70ebddd54765663877c8334`. Chưa phải bản tích hợp vào main.
- **11/11 ca HTTP/DB PASS** trên app/controller/service/EJS thật và DB riêng: lịch thường/cơ sở rỗng/tên dài, ngày mặc định/bảy ngày/ngày xa hơn, đổi và tải lại ngày qua GET, navigation/CSS, quyền và snapshot dữ liệu. [Kết quả chi tiết đã lọc thông tin riêng](acceptance-2026-10-25.json).
- `npm run check` **PASS**, 18 EJS; `npm test` **134/134 PASS**, 0 fail/skip, chạy lại trên source UI lần này. Node 24.15.0, MongoDB 8.3.11, replica set localhost riêng `qaCalendarUi69`. App/DB/MongoDB và runtime QA đã dọn.
- Người yêu cầu báo đã thử bố cục thường/tên dài và bàn phím thấy hoạt động. Đây là xác nhận từ người yêu cầu, không được gán thành kết quả công cụ hay ảnh của lần chạy này.
- **Chưa có ảnh 390px/1366px hoặc kết quả thao tác Tab/Enter/cuộn bảng của lần này.** Người dùng dừng Computer Use bằng phím Escape trước khi mở các trang QA; không tiếp tục thao tác trình duyệt sau đó. HTTP/DB/lint không thay thế các ca trực quan này.

PR vẫn Draft. Còn hai việc trước khi ready: backend #68 merge rồi đổi nền/cập nhật main và kiểm tra lại; hoàn tất ảnh/thao tác thường/rỗng/tên dài ở hai viewport. Không tự đánh dấu #63 hoặc #66 hoàn thành.

## Nền và phạm vi

- Main khi bắt đầu: `f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7`.
- Hợp đồng backend: nhánh `feat/owner-calendar` tại `014117349e9f460fd70ebddd54765663877c8334`, [tài liệu bàn giao #62](../HOP_DONG_LICH_DIEU_HANH.md).
- Nhánh nháp UI: `draft/ui-owner-calendar`, dựa trên đúng SHA backend trên. PR UI nháp đặt base là `feat/owner-calendar` để diff chỉ gồm UI/tài liệu, không trộn các thay đổi backend chưa merge vào diff #63.
- Không sửa controller/service/model/routes/CI/package hoặc CSS chung. Không đọc `.env`, không ghi dữ liệu Atlas; lần thử ngày 25 dùng app và DB tổng hợp riêng trên localhost.

## Phần đã chuẩn bị trong source UI

| File | Thay đổi |
| --- | --- |
| `views/owner-calendar.ejs` | Bố cục riêng cho lịch, cơ sở/ngày đang xem, form GET, bảy lựa chọn ngày, chú giải, bảng và các trạng thái rỗng; bỏ CSS inline |
| `public/css/owner-calendar.css` | CSS chỉ áp dụng trang lịch: màu dự án, tên dài xuống dòng, focus, bảng cuộn trong vùng riêng, tiêu đề giờ/cột tên sân sticky, breakpoint 700px/480px |
| `views/owner-dashboard.ejs` | Giữ href `/owner/calendar`, nhãn liên kết là “Lịch điều hành” |

View dùng đúng `facility, selectedDate, dayOptions, timeColumns, courtRows` được bàn giao. Các cột và ô được lặp từ backend, không hardcode giờ mở cửa hoặc tự suy ra sân trống. Mỗi trạng thái có chữ/ký hiệu và màu: Trống ○, Đang giữ ◷, Đã đặt ✓, Không phục vụ —; hàng inactive có nhãn Tạm ngừng. Không hiển thị giá, doanh thu hoặc thông tin riêng của đơn.

Tên cơ sở, địa chỉ và tên sân vẫn dùng EJS escape. Form và các liên kết ngày chỉ dùng GET hiện có; không thêm JS, API, thao tác giữ/đặt/hủy/đổi hoặc realtime. View có riêng hai nhánh “Cơ sở chưa có sân.” và “Chưa có giờ phục vụ.”, đều có liên kết về quản lý.

## Kiểm tra nháp đã chạy

Ngày **24/10/2026**, Node **24.15.0**:

- `npm run check`: **PASS**, ESLint + biên dịch **18 EJS** trên nhánh nháp phụ thuộc backend.
- Render EJS riêng: **5/5 tình huống PASS**. Đây là locals tổng hợp để kiểm tra template, **không phải dữ liệu ứng dụng/DB** và không chứng minh route/backend hoạt động.
- Đọc diff và đối chiếu tĩnh với hợp đồng #62; giữ escape, form GET, tên trạng thái và dữ liệu giờ backend truyền.

| Tình huống render fixture | Kết quả kiểm tra template |
| --- | --- |
| Normal, bốn trạng thái, trục giờ gián đoạn | Có đủ cột/ô theo fixture, bảy href ngày và input giữ ngày; form GET |
| Chưa có sân | Hiện thông báo riêng, không tạo bảng giả |
| Có sân nhưng không có cột giờ | Hiện “Chưa có giờ phục vụ.”, không tạo ô giờ mặc định |
| Tên dài, payload HTML, inactive | Chuỗi được escape đầy đủ; nhãn Tạm ngừng xuất hiện |
| Ngày đang xem nằm ngoài bảy ngày | Input giữ ngày; bảy ngày vẫn từ locals, không đánh dấu nhầm một ngày đang xem |

[JSON kết quả render nháp](draft-render-results.json). Không lấy năm fixture, màu CSS hoặc lint để kết luận trạng thái sân hoặc độ rộng/bàn phím thực tế. Chưa có ảnh ứng dụng chạy thật trong thư mục này.

## Các bước còn lại trước khi hoàn thành #63

1. Nhóm trưởng review/merge #68. Sau đó lấy `main` mới, chuyển nền PR UI từ nhánh phụ thuộc sang `main`; giải quyết khác biệt hợp đồng nếu backend được chỉnh trong review.
2. Chạy lại ứng dụng thật trên nền main mới với DB thử riêng và OWNER đã cấp cơ sở; kiểm tra normal/empty/no-hours/tên dài, các sân khác giờ phục vụ và inactive. Kết quả HTTP trên nhánh UI ngày 25 ở trên không tự áp dụng cho source thay đổi sau đó.
3. Đổi ngày bằng form/bảy lựa chọn GET, giữ đúng ngày và xác nhận không tạo/sửa đơn/lock/giá/quyền; kiểm tra scope OWNER và navigation hiện có.
4. Kiểm tra trình duyệt **390px và 1366px**: không tràn toàn trang, cuộn riêng trong bảng, tiêu đề/cột cố định không che nội dung, focus, Tab/Enter và phím mũi tên. Chụp ảnh thực tế thường/rỗng/tên dài cùng SHA, browser, viewport và dữ liệu thử.
5. Chạy lại `npm run check`, các test cần thiết và CI trên nền tích hợp; chỉ đánh dấu PR ready/`Closes #63` sau khi đủ tiêu chí.

Ở lần nháp ngày 24, chưa chạy app/DB, npm test và trình duyệt. Kết quả bổ sung ngày 25 đã chạy lại HTTP/DB và 134 test trên nhánh UI, vẫn chưa có bằng chứng trực quan và main tích hợp. Workflow hiện chỉ tự chạy PR hướng tới main; không đổi CI để ép chạy PR nháp có base là nhánh backend.
