# Sân ghép và dịch vụ — bản mở rộng ngày 07/11/2026

## Cách chạy nhánh này

Bản này phát triển từ main `d6a6464`, giữ MVC, MongoDB, EJS và giao diện xanh hiện tại. Không tự seed, đổi tên database hay xóa dữ liệu. Sau khi lấy nhánh về, dùng `npm ci`, cấu hình .env riêng và `npm run dev`. Thanh toán vẫn dùng `PAYMENT_MODE=demo`; xóa biến legacy DEMO_MODE nếu còn. Không có biến bí mật mới. MongoDB cần replica set để sử dụng transaction. Startup tạo collection/index cho PlayGroup và ExtraService mới.

## Luồng thuê sân riêng hoặc mở sân ghép

1. Đăng nhập khách và chọn sân, ngày, các ô giờ như trước.
2. Chọn **Thuê sân riêng** hoặc **Tạo sân ghép, rủ bạn chia tiền**. Khách vãng lai vẫn thuê riêng; mở/tham gia nhóm cần đăng nhập.
3. Chọn dịch vụ thêm nếu cơ sở có mở, nhập thông tin và giữ chỗ.
4. Thanh toán mô phỏng tiền sân. Với lựa chọn sân ghép, web đưa sang form mở nhóm. Có thể mở nhóm sau từ phiếu hoặc **Sân ghép → Rủ bạn cùng chơi**.
5. Nhập tên nhóm, số người tối đa (2–30 tính cả người tạo), hạn đăng ký trước giờ chơi, số điện thoại liên hệ và ghi chú. Chấp thuận chia sẻ số điện thoại với người đã tham gia.
6. Nhóm xuất hiện trên trang Sân ghép. Sao chép link trang nhóm để mời bạn. Một đơn chỉ mở một nhóm, không tạo thêm đơn hay giữ thêm lock sân.
7. Người khác đăng nhập, nhập số liên hệ và tham gia một chỗ. Họ có thể chọn dịch vụ thêm cho mình. Số điện thoại thành viên chỉ hiện với người tạo; số người tạo chỉ hiện với người đã tham gia. Người ngoài vẫn xem được tên thành viên và thông tin buổi chơi.
8. Trước hạn, thành viên liên hệ người tạo để xin rời; người tạo bấm **Cho rời nhóm**. Thành viên không có nút tự rời. Người tạo có thể chốt sớm.
9. Tới hạn, lần đọc/thao tác tiếp theo chốt danh sách; không có email hay job riêng cho thông báo. Hệ thống vẫn chặn join/remove ngay từ hạn dù chưa có ai mở trang. Tiền lẻ chia theo thứ tự thành viên, tổng đúng tiền sân. Nếu chỉ có người tạo, người đó chịu toàn bộ.
10. Sau chốt không thêm/xóa người. Các thành viên tự thỏa thuận trả tiền bên ngoài; web không xác minh chuyển khoản và không lưu trạng thái đã chuyển.

## Hủy nhóm

Người tạo dùng nút gửi yêu cầu hủy, đi qua luồng yêu cầu của đơn hiện có. Trong khi có yêu cầu đang chờ, nhóm dừng nhận người/chỉnh danh sách. Chủ sân duyệt hủy thì Booking CANCELLED, lock được giải phóng, trang nhóm hiện đã hủy. Nếu bị từ chối, nhóm có thể nhận người trở lại khi còn hạn. Thành viên xem cập nhật trên trang nhóm hoặc **Buổi tôi tham gia**; chưa có hộp thông báo, email hay SMS. Không tự hoàn các khoản thành viên đã chuyển ngoài web.

Đơn đã mở nhóm chưa hỗ trợ đổi lịch: thay đổi sân/giờ và giá khi đã có thành viên cần luồng đồng ý mới, nên bản đầu chỉ cho gửi yêu cầu hủy. Check-in và thời hạn hủy theo quy tắc đơn hiện có.

## Nước và đồ thuê

OWNER đã duyệt vào **Quản lý cơ sở → Nước và đồ thuê**. Thêm tên, đơn vị tính và giá; có nút tạm ngừng/mở lại. Mỗi cơ sở tối đa 30 dịch vụ, mỗi lần khách chọn tối đa 20 đơn vị mỗi dịch vụ.

Khách chọn dịch vụ lúc đặt sân hoặc tham gia nhóm. Tên/giá/đơn vị/số lượng được lưu snapshot, không tin giá từ trình duyệt. Tiền sân và dịch vụ tách riêng:

- Tiền sân: chia đều theo nhóm, thao tác thanh toán vẫn mô phỏng.
- Dịch vụ: chỉ yêu cầu trước, cần cơ sở xác nhận còn hàng; khách trả trực tiếp tại sân. Không thu trước, chưa có tồn kho/cọc/bồi thường/hoàn phí tự động; không cộng vào báo cáo thu/hoàn mô phỏng hiện có.

OWNER thấy các yêu cầu dịch vụ gần đây trong chính cơ sở (tối đa 50 đơn và 50 nhóm gần đây; chưa là quản lý kho). Chưa có nút xác nhận hoàn tất giao dịch dịch vụ.

## Giới hạn bản đầu

Danh sách sân ghép hiện tối đa 60 buổi mới nhất; chưa có tìm kiếm nâng cao/phân trang. Form mở nhóm lấy tối đa 100 đơn tương lai của người dùng. Tạo nhóm một lần từ đơn đã xác nhận; không sửa tên/giới hạn sau tạo. Thông tin đăng ký chưa có OTP. Không xử lý ngân hàng thật, nhắn tin, tranh chấp, đánh giá hoặc tiền giữa các thành viên. Trang Render vẫn cần xử lý cấu hình proxy/cookie riêng để gửi form hoạt động; nhánh này không khẳng định đã khắc phục hosting.

## Kiểm tra

`npm run check` biên dịch 32 template và lint. Suite `tests/play-group.test.js` kiểm tra quyền, CSRF, tranh chỗ cuối, không đổi lock sân, chốt tiền lẻ, tự chốt theo hạn, luồng chọn sân ghép từ đặt sân, hủy nhóm, dữ liệu dịch vụ và riêng tư số điện thoại. Toàn bộ suite cũ chạy trên DB tạm riêng.

Trình duyệt Chromium ở 1440 và 390px đã mở danh sách nhóm, trang chi tiết công khai/người tạo, form tham gia, form tạo nhóm, quản lý dịch vụ và trang đặt sân; bấm tham gia thành công, không tràn ngang hoặc lỗi JavaScript. Dữ liệu trên MongoDB replica set cục bộ, không ghi Atlas. Ảnh và kết quả trong `docs/kiem-thu-san-ghep`.
