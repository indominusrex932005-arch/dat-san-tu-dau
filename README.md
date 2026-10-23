# Đặt sân MVC: đăng ký, đăng nhập và đặt sân

Node.js 24; Express 5, EJS, Mongoose, MongoDB.

1. Chạy `npm ci`, tạo `.env` riêng từ `.env.example` nếu chưa có.
2. Điền `MONGODB_URI`; tạo `SESSION_SECRET` ngẫu nhiên ít nhất 32 ký tự.
3. Chạy `node scripts/tao-du-lieu-demo.js` để tạo cơ sở và hai sân mẫu.
4. Chạy `npm start`; mở http://localhost:3000/register để tự đăng ký.
5. Đăng nhập tại `/login`, chọn sân ở `/courts`, chọn ngày/giờ, đặt và xem `/my-bookings`.

Script mẫu chỉ tạo cơ sở và sân khi chưa có; không tạo hoặc đổi mật khẩu tài khoản.
Không cần DEMO_EMAIL/DEMO_PASSWORD. Người dùng nhập email và mật khẩu của mình trên form đăng ký.
Mật khẩu được băm bằng bcrypt trước khi lưu vào MongoDB. Session lưu trong MongoDB;
trình duyệt giữ cookie định danh phiên có chữ ký bằng SESSION_SECRET của server.

Mỗi lượt 1 giờ, từ 06:00 đến 22:00 theo giờ Việt Nam. Giá lấy từ database;
unique index chặn hai lượt trùng sân/ngày/giờ. Chưa có thanh toán hay hủy đơn.

Code và giải thích từng file nằm trong HUONG_DAN_COPY_CODE.md. Không commit .env hoặc node_modules.
