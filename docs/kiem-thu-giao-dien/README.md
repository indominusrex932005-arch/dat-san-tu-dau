# Bằng chứng và mẫu ghi kết quả #32

Hiện thư mục chỉ có tài liệu chuẩn bị. **Chưa có ảnh thực thi trang chủ, cơ sở, đăng nhập hoặc danh sách sân**, chưa có phiên chạy dữ liệu thật hoặc giả lập. Kế hoạch nằm tại [`../KIEM_THU_GIAO_DIEN.md`](../KIEM_THU_GIAO_DIEN.md).

## Cách thu thập sau khi đủ điều kiện

1. Nhận xác nhận G01–G04 từ nhóm trưởng, ghi liên kết bàn giao/cho phép dữ liệu; chỉ dùng database và bản ghi thử đã thống nhất.
2. Ghi `git rev-parse HEAD` của **ứng dụng đang chạy**, ngày giờ/múi giờ, người thử, trình duyệt/phiên bản, kích thước viewport và nguồn dữ liệu. Không đưa `.env`, URI hoặc mật khẩu vào Git.
3. Tạo một bản ghi kết quả cho từng ca/biến thể và viewport. Điền dữ liệu trước, thao tác, phản hồi thật và bằng chứng sau khi chạy; phần chưa chạy giữ CHỜ.
4. Sau khi tải trang, kiểm tra Network/Console trong DevTools; ghi lại mã lỗi nếu có.
5. Chụp ít nhất bốn trang ở cả `390 × 844` và `1366 × 900`; lưu thêm ảnh ca lỗi/rỗng nếu chạy được. Ảnh lỗi phải chỉ rõ lỗi đến từ trình duyệt hay backend; ảnh thiết kế/render giả lập không thay thế kết quả tích hợp.
6. Đặt ảnh trong thư mục này, liên kết ảnh vào bản ghi ca. Không có ảnh thì ghi "chưa có", không tạo liên kết tới file chưa tồn tại.

Tên ảnh gợi ý: `H01-R01-trang-chu-1366.png`, `H01-R01-trang-chu-390.png`, `F01-R01-co-so-1366.png`, `L01-R01-dang-nhap-1366.png`, `L04-R01-loi-dang-nhap-390.png`, `C01-R01-san-1366.png`, `C03-R01-san-rong-1366.png`. Đây là **quy ước tên, chưa phải ảnh đã có**. Có thể chọn viewport khác trong ảnh bổ sung, nhưng phải có hai chiều rộng yêu cầu.
