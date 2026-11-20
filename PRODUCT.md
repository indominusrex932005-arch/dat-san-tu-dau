# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Customer: người tìm sân thể thao, xem cơ sở/sân và đặt nhiều ô 30 phút.
- Khách vãng lai: người đặt bằng tên và số điện thoại, lưu và truy cập phiếu qua link riêng.
- Owner: chủ cơ sở, cấu hình sân/giá/đơn và xử lý yêu cầu hủy/đổi.
- Admin: duyệt tài khoản chủ sân và cấp quyền quản lý cơ sở.

## Product Purpose

Sân Thể Thao giúp người chơi tìm cơ sở thể thao, kiểm tra lịch sân và hoàn tất đặt sân; đồng thời hỗ trợ chủ sân vận hành cơ sở và xử lý các yêu cầu thay đổi/hủy.

## Positioning

Hệ thống đặt sân tích hợp đặt lịch nhiều ô 30 phút, giữ lịch trong thời gian ngắn và ghi nhận yêu cầu vận hành/hủy/đổi theo cơ sở.

## Operating Context

- Người dùng đặt lịch trên máy tính hoặc thiết bị di động.
- Chủ sân quản lý một cơ sở cụ thể; Admin cấp cơ sở và quyền owner.
- Một đơn thuộc một sân trong một ngày và nhiều ô rời nhau.
- Giá theo từng ô được lưu trong đơn; thanh toán hiện có thể là mô phỏng, không phải thanh toán ngân hàng thật.

## Capabilities and Constraints

- Express/EJS/Mongoose, MVC ở thư mục gốc.
- Customer và khách vãng lai đều đặt được.
- Owner chỉ thao tác cơ sở mình; mọi thay đổi POST đều qua CSRF.
- Không tự áp chính sách hủy/đổi hoặc hoàn tiền.
- Thanh toán phải tuân theo `PAYMENT_MODE` của server; `live` hiện chưa được hỗ trợ.
- Giữ lịch toàn bộ các ô bằng transaction; migration dữ liệu mặc định là dry-run.

## Brand Commitments

- Tên sản phẩm: Sân Thể Thao.
- Ngôn ngữ giao diện: tiếng Việt.
- Hướng thiết kế người dùng đã ưu tiên: chuyên nghiệp, tối giản và đáng tin.
- Bảo toàn tính xác thực và tên các chức năng hiện có.

## Evidence on Hand

- Giao diện MVC hiện có tại `views/`, CSS tại `public/css/`, JavaScript tại `public/js/`.
- Luồng booking, checkout, receipt, owner dashboard và admin dashboard đã có trong ứng dụng.
- Không có tài liệu thương hiệu hoặc bảng màu chính thức ngoài giao diện incumbent hiện hữu.

## Product Principles

- Dữ liệu và trạng thái lấy từ server luôn là nguồn chính xác.
- Luồng đặt sân rõ ràng, ít bước, dễ kiểm tra trước xác nhận.
- Chủ sân thao tác nhanh trên đúng phạm vi cơ sở được cấp.
- Sử dụng ngôn ngữ rõ ràng, tránh hứa hẹn hoặc chính sách không được xác nhận.
- Tính nhất quán quan trọng hơn trang trí.

## Accessibility & Inclusion

- Giao diện web cần tương thích máy tính và thiết bị di động.
- Các điều khiển phải có trạng thái rõ ràng, focus bàn phím và contrast đủ.
