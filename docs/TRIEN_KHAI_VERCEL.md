# Đưa bản demo sân ghép lên Vercel

## Phạm vi

Nhánh `feat/trien-khai-vercel` được tạo từ `feat/san-ghep-va-dich-vu` (512776d), nên có cả sân ghép, dịch vụ, giao diện và ảnh QR demo. Chưa cần merge main để thử Preview. Đây là cấu hình chuẩn bị triển khai; chưa phải bằng chứng website đã chạy trên Vercel.

`api/index.js` khởi tạo Express/MongoStore một lần cho mỗi function instance, dùng chung promise giữa request đồng thời; lỗi khởi tạo được phép thử lại. Mongo pool tối đa 5 kết nối/instance. View EJS và tài nguyên `public` được đóng gói cùng function; `/assets` vẫn do Express phục vụ. Node 24 được khai báo trong package.json. `npm start` tiếp tục chạy Node/Render như cũ.

Builder tắt `helpers` của Vercel Node để giữ stream request cho Express/Multer tự parse, thay vì thêm parser trước middleware của ứng dụng.

Không dùng interval trên function. Request sau mỗi 30 giây sẽ đợi dọn HOLD hết hạn; khi không có truy cập, trạng thái DB có thể chưa đổi ngay. Deadline vẫn được kiểm tra trong nghiệp vụ giữ/thanh toán, nên không thể dùng thời gian function ngủ để thanh toán đơn quá hạn.

## Import từ GitHub

1. Đăng nhập [Vercel](https://vercel.com/new), chọn **Add New → Project → Import Git Repository** và repo `indominusrex932005-arch/dat-san-tu-dau`.
2. Chọn nhánh **feat/trien-khai-vercel** làm nhánh triển khai. Nếu trang Import chỉ hiện main, đặt Production Branch trong Project Settings → Git rồi redeploy đúng nhánh; kiểm tra SHA trước khi thử.
3. Root Directory để gốc repo; Framework Preset **Other**. Không thêm `npm start` vào Build Command: Vercel dùng builder Node trong vercel.json, không giữ một server mở cổng.
4. Điền các biến bên dưới trong giao diện riêng. Không thêm file `.env` lên GitHub; xóa key `DEMO_MODE` nếu đã khai báo.

| Biến | Giá trị |
| --- | --- |
| NODE_ENV | production |
| PAYMENT_MODE | demo |
| DEMO_DATA_ONLY | true |
| DB_NAME | Tên database riêng chỉ chứa dữ liệu thử |
| MONGODB_URI | URI Atlas có quyền trên database thử, nhập riêng |
| SESSION_SECRET | Chuỗi ngẫu nhiên ít nhất 32 ký tự, giữ ổn định giữa các deploy |
| CLOUDINARY_CLOUD_NAME | Cloud name của kho ảnh |
| CLOUDINARY_API_KEY | Nhập riêng |
| CLOUDINARY_API_SECRET | Nhập riêng |

Cloudinary có thể để trống nếu chưa thử tải ảnh. Không cần tự đặt PORT hay VERCEL; Vercel cung cấp biến nền tảng. Môi trường Preview cũng phải dùng dữ liệu tổng hợp riêng; không cho nhánh thử nghiệm truy cập dữ liệu kinh doanh thật.

5. Atlas phải đang hoạt động, hỗ trợ transaction và cho phép kết nối từ môi trường Vercel. Dùng phương án mạng phù hợp gói Vercel/Atlas; không sao chép IP outbound Render sang đây. Không tự đổi allowlist sang mọi IP. Chưa có đường kết nối phù hợp thì xử lý cấu hình Atlas trước khi nghiệm thu.
6. Deploy và xem Function Logs. Không seed, migrate hay cấp ADMIN trong Build Command hoặc startup. Nếu cần dữ liệu mẫu, vận hành các CLI hiện có trên đúng DB demo, sau khi xác nhận đích; không có route công khai cấp ADMIN.

## Cookie HTTPS, ảnh và giới hạn

Riêng entry point Vercel dùng `express-session` với `proxy: true` khi biến nền tảng `VERCEL=1`: tin `X-Forwarded-Proto` được Vercel chuẩn hóa để cấp cookie Secure. Đây chỉ là lựa chọn cho cookie trong function do Vercel quản lý; không bật Express `trust proxy=true`, không áp dụng cho Node/Render. Cookie vẫn Secure/HttpOnly/SameSite=Lax; CSRF vẫn bắt buộc.

Tham khảo hợp đồng header nền tảng: https://vercel.com/docs/headers/request-headers#x-forwarded-proto. Cần kiểm tra lại cookie và gửi form qua HTTPS trên deployment thật. Không dùng entry point này sau một proxy tùy ý cho phép khách tự đặt header HTTPS.

Giới hạn upload là **3 MB/ảnh khi VERCEL=1**, cả trình duyệt và backend, để nằm dưới giới hạn request function 4,5 MB kể cả multipart. Node/Render vẫn 5 MB. Ảnh lưu Cloudinary, không lưu vào đĩa tạm của function. Chưa xác minh upload thực lên Cloudinary trong đợt chuẩn bị này.

Bộ đếm chống spam và giới hạn upload đồng thời hiện ở RAM từng instance, không chia sẻ giữa các function. Không tự tin header IP của khách; mặc định Express không tin IP proxy nên một số quota IP có thể dùng chung. Trước mở kinh doanh cần nhận diện IP nền tảng đã xác minh và limiter tập trung, thanh toán thật, tồn kho dịch vụ và quy trình vận hành/backup.

## Thử sau khi deploy

- `/health` trả 200, trang chủ/cơ sở/sân và CSS/JS tải được.
- Mở `/register` mới: có cookie `dat_san_sid` Secure; đăng ký, đăng nhập, refresh vẫn giữ phiên; form thiếu/sai CSRF bị chặn. Không gửi ảnh chụp cookie/token.
- Đặt ô tương lai → thanh toán mô phỏng → phiếu in; hết hạn không thanh toán được; đơn xác nhận còn sau cold start.
- Tạo nhóm từ đơn đã trả → tài khoản thứ hai tham gia → chốt chia tiền → thành viên thấy kết quả. Tiền giữa thành viên vẫn trả ngoài web.
- OWNER chỉ sửa cơ sở mình; tải ảnh sân/QR dưới 3 MB, thử file vượt giới hạn báo rõ; ADMIN duyệt chủ sân.

Chỉ công bố link dùng được sau các bước kiểm tra thật trên đúng SHA. Kiểm thử localhost không chứng minh Atlas, HTTPS hay cold start của Vercel đã đạt.

## Kết quả chuẩn bị ngày 10/11/2026

`npm run check` qua ESLint và 32 EJS. Bộ test đầy đủ tại thời điểm chạy: 289/289 qua; sau đó hai test bổ sung `vercel-entry.test.js` và `vercel-image-limit.test.js` cũng qua riêng (tổng 291 ca đã chạy). Dùng MongoDB replica set tạm cục bộ, không truy cập Atlas thật. Entry point thử qua HTTP với header nền tảng mô phỏng: health, CSS, EJS, đăng ký, đăng nhập và giữ session hoạt động. Chưa build/deploy qua tài khoản Vercel; truy cập vercel.com từ môi trường làm việc bị proxy trả 403, chưa có tài khoản Vercel được kết nối.
