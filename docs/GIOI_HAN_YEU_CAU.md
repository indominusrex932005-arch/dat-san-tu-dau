# Giới hạn đăng nhập, đăng ký và giữ sân (#80)

Middleware chạy sau session, nhận diện người dùng và CSRF, trước controller. Chỉ bốn POST dưới đây dùng hạn mức. Mỗi lượt được chuyển đến controller tính một lần, kể cả khi validation hoặc mật khẩu thất bại. Lượt bị CSRF chặn hoặc trả 429 không trừ hạn mức, cũng không kéo dài cửa sổ. Khi bị giới hạn, trang báo thời gian thử lại và trả header `Retry-After` theo giây.

| POST | Cửa sổ mặc định | Khóa và hạn mức mặc định |
| --- | --- | --- |
| `/login` | 900 giây | 60 lượt/IP và 8 lượt cho cặp email chuẩn hóa + IP |
| `/register` | 900 giây | 12 lượt/IP |
| `/register/owner` | 900 giây | 12 lượt/IP, bộ đếm riêng với đăng ký khách |
| `/bookings` | 600 giây | 60 lượt/IP và 12 lượt cho mỗi tài khoản đã xác thực hoặc phiên khách vãng lai |

Các giới hạn đều cấu hình được qua biến `RATE_LIMIT_*` trong [.env.example](../.env.example). Biến `*_WINDOW_SECONDS` nhận số nguyên từ 1 đến 86400. Biến `*_MAX` nhận số nguyên từ 1 đến 100000. Bỏ biến để dùng mặc định. Cấu hình sai làm app từ chối khởi động.

Khóa IP dùng IPv4 hoặc tiền tố IPv6 /64. IPv4 dạng IPv6-mapped dùng cùng khóa với IPv4. Giới hạn IP chung chặn đổi email hoặc đổi session liên tục. Ngưỡng IP của login và bookings cao hơn ngưỡng theo email hoặc người đặt để những người dùng chung Wi-Fi vẫn có lượt riêng, cho tới khi chạm ngưỡng IP chung. Login ghép IP với email đã trim và viết thường, nên một IP gửi yêu cầu thay cho người khác chỉ có thể ảnh hưởng hạn mức của cặp đó và ngưỡng chung ở IP đó. Bộ đếm không thay đổi trạng thái tài khoản.

Mỗi khóa có cửa sổ cố định tính từ lượt đầu tiên. Bộ đếm ở RAM của một instance, tự bỏ các mục hết hạn khi xử lý yêu cầu tiếp theo. Mỗi lớp giữ tối đa 10.000 khóa đang hoạt động. Khi đầy, khóa mới đợi đến lượt hết hạn sớm nhất. Restart xóa bộ đếm và các instance không chia sẻ hạn mức. Middleware không log password, token, email hoặc giá trị khóa. Bộ đếm giữ hash của email và mã phiên. Unique index của SlotLock và transaction vẫn kiểm tra xung đột và bảo đảm giữ đủ ô.

## Proxy và HTTPS khi tích hợp #81

Mặc định `TRUST_PROXY_IPS` trống, Express lấy IP từ kết nối trực tiếp và bỏ qua các header chuyển tiếp. Khi có reverse proxy, cấu hình danh sách IP/CIDR của các proxy đã xác minh, phân cách bằng dấu phẩy. Express kiểm tra địa chỉ socket rồi duyệt `X-Forwarded-For` từ phải sang trái đến địa chỉ chưa được tin cậy đầu tiên. Chỉ đưa các hop do hạ tầng kiểm soát vào danh sách. Kiểm tra proxy xử lý `X-Forwarded-For`, `X-Forwarded-Proto` và `X-Forwarded-Host` an toàn, kể cả với đường truy cập trực tiếp hoặc qua mạng nội bộ. [Express phía sau proxy](https://expressjs.com/en/guide/behind-proxies/)

Render mô tả lưu lượng công khai đi qua Cloudflare và load balancer. Hướng dẫn của Render lưu ý phía khách có thể kiểm soát phần đầu chuỗi `X-Forwarded-For`. Đường mạng riêng tới web service cũng có thể tồn tại tùy cấu hình. Limiter dùng `req.ip` theo danh sách tin cậy và không lấy thẳng phần tử đầu chuỗi hay `CF-Connecting-IP`. Nếu chưa xác minh được các hop, để danh sách trống. Khi chạy sau proxy với cấu hình này, khách có thể dùng chung hạn mức theo IP proxy. [Render về IP phía khách](https://render.com/articles/host-pocketbase-on-render#making-pocketbase-see-the-real-client-ip) · [Mạng riêng trên Render](https://render.com/docs/private-network)

Đã kiểm thử cục bộ mô hình proxy tin cậy và kết nối trực tiếp. Cookie production vẫn có `Secure`, `HttpOnly`, `SameSite=Lax` khi Express nhận diện HTTPS từ proxy tin cậy. Header HTTPS giả từ kết nối chưa được tin cậy không khiến app phát cookie phiên. Trên Render thực tế, #81 cần xác minh chuỗi proxy và cookie/CSRF qua HTTPS trước khi mở demo. Dùng hai mạng khách khác nhau để xác nhận IP độc lập, rồi đổi header giả từ cùng một mạng để kiểm tra hạn mức không đổi.
