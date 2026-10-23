# Bằng chứng và mẫu ghi kết quả #17

Hiện thư mục chỉ có tài liệu chuẩn bị. **Chưa có ảnh thực thi form thêm/sửa/lỗi**, chưa có phiên chạy dữ liệu thật hoặc giả lập. Kế hoạch nằm tại [`../KIEM_THU_THEM_SUA_CO_SO.md`](../KIEM_THU_THEM_SUA_CO_SO.md); ghi nhận đọc code tại [`doi-chieu-truoc-khi-chay.md`](doi-chieu-truoc-khi-chay.md).

## Cách thu thập sau khi đủ điều kiện

1. Nhận xác nhận G01–G04 từ nhóm trưởng, ghi liên kết bàn giao/cho phép dữ liệu; chỉ dùng database và bản ghi thử đã thống nhất.
2. Ghi `git rev-parse HEAD` của **ứng dụng đang chạy**, ngày giờ/múi giờ, người thử, trình duyệt/phiên bản, kích thước viewport và nguồn dữ liệu. Không đưa `.env`, URI hoặc mật khẩu vào Git.
3. Tạo một bản ghi kết quả cho từng ca/biến thể và viewport. Điền dữ liệu trước, thao tác, phản hồi thật và bằng chứng sau khi chạy; phần chưa chạy giữ CHỜ.
4. Sau lưu, tải lại danh sách/mở lại đúng ID bằng lượt điều hướng mới. Ảnh các ô nhập ngay sau submit không đủ chứng minh dữ liệu đã lưu.
5. Chụp ít nhất thêm/sửa/lỗi backend ở cả `390 × 844` và `1366 × 900`; lưu thêm ảnh trước/sau F06. Ảnh lỗi phải chỉ rõ lỗi đến từ trình duyệt hay backend; ảnh thiết kế/render giả lập không thay thế kết quả tích hợp.
6. Đặt ảnh trong thư mục này, liên kết ảnh vào bản ghi ca. Không có ảnh thì ghi “chưa có”, không tạo liên kết tới file chưa tồn tại.
7. Ghi lại các ID thử đã tạo/sửa để bàn giao. Không tự xóa dữ liệu chung hoặc tự khôi phục hàng loạt; chỉ dọn đúng bản ghi theo quy trình nhóm trưởng cho phép.

Tên ảnh gợi ý: `F02-R01-them-390.png`, `F04-R01-sua-1366.png`, `F07-B-R01-loi-backend-390.png`, `F06-R01-truoc-xoa-390.png`, `F06-R01-doc-lai-390.png`. Đây là **quy ước tên, chưa phải ảnh đã có**. Có thể chọn viewport khác trong ảnh bổ sung, nhưng phải có hai chiều rộng yêu cầu.

## Mẫu ghi một ca/biến thể

Sao chép khối dưới đây vào báo cáo khi thực thi. Các ô chờ không được suy ra từ một ca khác; nếu dùng chung phiên R01 vẫn phải ghi ID biến thể và ảnh tương ứng.

```text
Ca / biến thể / phiên: CHỜ ĐIỀN
Trạng thái: CHỜ
Ngày giờ và múi giờ: CHƯA CHẠY
Người kiểm thử: CHỜ ĐIỀN
SHA ứng dụng thực sự chạy / nhánh tích hợp: CHƯA CHẠY
PR backend + bản sửa đã ghép, UI và điều hướng: CHỜ XÁC NHẬN
Nguồn xác nhận G01–G04 của nhóm trưởng: CHỜ
Trình duyệt / phiên bản: CHƯA CHẠY
Viewport CSS px: CHƯA CHẠY
Nguồn dữ liệu: Atlas phát triển / local được duyệt / giả lập (chọn đúng)
Phạm vi database và bản ghi được phép thử (không ghi URI): CHỜ BÀN GIAO
ID A/B/ID vừa tạo và giá trị trước thao tác: CHỜ BÀN GIAO
URL thực tế / action / method: CHỜ BÀN GIAO
Dữ liệu nhập cụ thể: CHỜ BÀN GIAO
Các bước đã thực hiện: CHƯA CHẠY
Mong đợi và nguồn hợp đồng/phiên bản: CHỜ BÀN GIAO
Phản hồi thực tế / HTTP code / URL sau thao tác: CHƯA CHẠY
Dữ liệu sau lần tải lại/mở lại độc lập: CHƯA CHẠY
Ảnh / log đã loại thông tin nhạy cảm: CHƯA CÓ
Kết quả đối chiếu (ĐẠT/LỖI chỉ khi đã thực thi): CHƯA CHẠY
Lý do chờ / liên kết lỗi nếu có: CHỜ G01–G04
Liên kết nhóm trưởng xác nhận phần hoãn nếu có: CHƯA CÓ
```

Nguồn dữ liệu **giả lập** phải ghi rõ chỉ xác minh được phần nào; không dùng để kết luận đã lưu/đọc lại Atlas. Việc lint đạt hoặc render EJS độc lập không thay một ca end-to-end của #17.

## Mẫu báo lỗi mới sau khi chạy

```text
Mã lỗi / ca / biến thể: CHỜ ĐIỀN
SHA / trình duyệt / viewport / phiên: CHỜ ĐIỀN
Môi trường và bản ghi thử được phép: CHỜ ĐIỀN
Điều kiện ban đầu và đầu vào: CHỜ ĐIỀN
Các bước tái hiện đã chạy: CHỜ ĐIỀN
Mong đợi (kèm nguồn đã được bàn giao): CHỜ ĐIỀN
Thực tế (gồm phản hồi và dữ liệu đọc lại): CHỜ ĐIỀN
Ảnh / log / liên kết ca: CHƯA CÓ
Phân biệt lỗi đã tái hiện hay chỉ nghi vấn đọc code: CHỜ ĐIỀN
Đề nghị nhóm trưởng phân công / trạng thái xử lý: CHỜ XÁC NHẬN
```

Không tự bổ sung luật điện thoại, giới hạn độ dài, chống trùng, quyền quản lý, trạng thái lưu hoặc schema. Nếu thiếu hợp đồng để xác định mong đợi thì ghi CHỜ bàn giao; không kết luận ĐẠT chỉ vì không thấy lỗi.
