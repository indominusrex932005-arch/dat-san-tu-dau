# Bản nháp giao diện lịch điều hành — #63

**Trạng thái: CHUẨN BỊ, CHƯA HOÀN THÀNH ISSUE #63.** Khi bắt đầu và khi bàn giao nháp, [backend PR #68](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/68) còn mở, chưa merge. Issue #63 cho phép phác bố cục trước, nhưng yêu cầu backend merge trước khi tích hợp UI. Không tự merge backend để bỏ qua bước review.

## Nền và phạm vi

- Main khi bắt đầu: `f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7`.
- Hợp đồng backend: nhánh `feat/owner-calendar` tại `014117349e9f460fd70ebddd54765663877c8334`, [tài liệu bàn giao #62](../HOP_DONG_LICH_DIEU_HANH.md).
- Nhánh nháp UI: `draft/ui-owner-calendar`, dựa trên đúng SHA backend trên. PR UI nháp đặt base là `feat/owner-calendar` để diff chỉ gồm UI/tài liệu, không trộn các thay đổi backend chưa merge vào diff #63.
- Không sửa controller/service/model/routes/CI/package hoặc CSS chung. Không đọc `.env`, không khởi động DB/app, không ghi dữ liệu Atlas.

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
2. Chạy ứng dụng thật với DB thử riêng và OWNER đã cấp cơ sở; kiểm tra normal/empty/no-hours/tên dài, các sân khác giờ phục vụ và inactive. Fixture tổng hợp có thể dùng trên DB thử, nhưng phải đi qua route/controller/service thật để làm bằng chứng tích hợp.
3. Đổi ngày bằng form/bảy lựa chọn GET, giữ đúng ngày và xác nhận không tạo/sửa đơn/lock/giá/quyền; kiểm tra scope OWNER và navigation hiện có.
4. Kiểm tra trình duyệt **390px và 1366px**: không tràn toàn trang, cuộn riêng trong bảng, tiêu đề/cột cố định không che nội dung, focus, Tab/Enter và phím mũi tên. Chụp ảnh thực tế thường/rỗng/tên dài cùng SHA, browser, viewport và dữ liệu thử.
5. Chạy lại `npm run check`, các test cần thiết và CI trên nền tích hợp; chỉ đánh dấu PR ready/`Closes #63` sau khi đủ tiêu chí.

Hiện **chưa chạy** app/DB integration, `npm test` cho UI mới, kiểm tra bàn phím/bố cục và ảnh trình duyệt. Không dùng kết quả 134 test của PR backend #68 để gán cho bản UI này. Workflow hiện chỉ tự chạy PR hướng tới main; không đổi CI để ép chạy PR nháp có base là nhánh backend.
