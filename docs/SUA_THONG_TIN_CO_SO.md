# Bàn giao sửa thông tin cơ sở — issue #9

Luồng hiện tại chỉ sửa cơ sở đã được ADMIN cấp cho OWNER APPROVED. Không dùng
lại các route công khai của PR #13 đã đóng; tạo/cấp cơ sở vẫn qua luồng ADMIN.

## Đường dẫn và quyền

| Mục | Hợp đồng |
| --- | --- |
| Lối vào | Nút **Sửa thông tin cơ sở** trên `/owner`, chỉ ở khu vực quản lý |
| Mở form | `GET /owner/facilities/:id/edit` |
| Submit | `POST /owner/facilities/:id`, form URL-encoded, có `_csrf` |
| Thành công | `303` về `/owner` |
| View | `views/owner-facility-form.ejs` |
| Locals | `title`, `facility` từ DB hoặc giá trị được giữ khi lỗi, `errorMessage`; `currentUser` và `csrfToken` từ middleware |

Middleware đọc tài khoản từ session/DB mỗi request, yêu cầu role OWNER và
ownerStatus APPROVED. Controller tìm cơ sở bằng owner của tài khoản đó,
đối chiếu ID URL; câu lệnh cập nhật vẫn lọc đồng thời `_id` và `owner`.

Không lấy owner/facility từ body, không cập nhật quyền, chủ sở hữu hoặc ID.
Chỉ `$set` ba trường `name`, `address`, `phone`; tên trường bổ sung bị bỏ qua.

## Dữ liệu và lỗi

| Input | Kiểm tra và lưu |
| --- | --- |
| `name` | Chuỗi, trim, bắt buộc từ 1 đến 150 ký tự |
| `address` | Chuỗi, trim, bắt buộc từ 1 đến 500 ký tự |
| `phone` | Chuỗi đầu vào không quá 30 ký tự; bắt buộc; bỏ khoảng trắng/dấu chấm/gạch ngang, đổi tiền tố `+84` thành `0`; kết quả là `0` và 9 chữ số |

Đã chốt với người giao việc: **không cho xóa số điện thoại**. Số hợp lệ tiếp tục
thỏa điều kiện nhận đơn trong booking service; không đổi quy tắc đặt sân.
Sửa số cơ sở không sửa số điện thoại tài khoản OWNER.

- Dữ liệu sai hoặc ID URL sai: `400`. Lỗi input render lại form, giữ các chuỗi
  đã nhập sau trim và escape EJS; mảng/object không được biến thành chuỗi để lưu.
- Chưa đăng nhập: `303` đến `/login` khi đã qua kiểm tra CSRF đối với POST.
- Sai role, OWNER chưa duyệt hoặc chưa được cấp cơ sở: `403`.
- ID hợp lệ nhưng không phải cơ sở được cấp/không tồn tại: `404`; không lộ dữ liệu cơ sở khác.
- CSRF thiếu/sai: `403` qua middleware chung; không ghi DB.

## Kiểm tra và phần việc tiếp theo

Chạy `npm run check` và `npm test`. Bộ test `tests/owner-facility.test.js` dùng
database tạm trên MongoDB replica set cục bộ theo `tests/helpers/database.js`;
không đọc `.env` hoặc dùng Atlas chung.

Khi bàn giao UI: giữ action/method/ID URL, tên input, CSRF, EJS escape và giá trị
khi lỗi. Form hiện dùng CSS owner có sẵn; không thêm nút ghi dữ liệu vào danh
sách cơ sở công khai. Có thể lấy mẫu PR #14 làm tham khảo, chưa coi là mẫu đã duyệt.

Khi bàn giao QA: thử owner đúng/khác/chờ duyệt/khách, ID lỗi, CSRF, input sai,
giá trị giữ lại, không thay owner/quyền qua body, sửa hợp lệ và nhận đơn sau khi
đổi số điện thoại. Ghi SHA đã chạy, dữ liệu giả cục bộ, trình duyệt và kết quả
thực tế; kiểm tra390px/1366px. Không tự seed/migrate/chỉnh Atlas chung.
