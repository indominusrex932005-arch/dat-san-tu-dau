# Kiểm thử Render sau triển khai — #83

**Trạng thái ngày 04/11/2026: CHUẨN BỊ; toàn bộ ca online CHƯA CHẠY.** Chưa có URL HTTPS, release SHA hoặc xác nhận DB demo được bàn giao. Báo cáo này là kế hoạch và biểu mẫu ghi kết quả; không phải bằng chứng website đã hoạt động online.

## Mốc nguồn và điều kiện bắt đầu

| Mục | Thông tin hiện có / phần còn thiếu |
| --- | --- |
| Mã nguồn đã đọc | Main `5c3e72d50a9802a1533a9ca7b17db0fb8fc3aa47`; **khác release SHA chưa biết** |
| Giới hạn POST dự kiến | [PR #92 / #80](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/92), nguồn đọc `5a5cf91dc817e1597cd8ba7673c48431e3f6ded9`; đang mở, chưa merge |
| Production/mode/health dự kiến | [PR #95 / #81](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/95), nguồn đọc `2aa7942cb0132230336d7b57a1eea22cff1ef6ef`; đang mở, chưa merge |
| Triển khai | [#82](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/82), [PR #94](https://github.com/indominusrex932005-arch/dat-san-tu-dau/pull/94) còn Draft; chưa có URL/bình luận bàn giao hoặc deployment được ghi nhận tại thời điểm chuẩn bị |
| URL HTTPS / release SHA thực tế | **CHƯA ĐƯỢC CẤP / CHƯA BIẾT**; operator phải đối chiếu SHA trong lần deploy với code tích hợp trước khi chạy |
| DB và dữ liệu | **CHƯA XÁC NHẬN** project/cluster/DB riêng, replica set, tài khoản và dữ liệu tổng hợp; không dùng Atlas chung/dữ liệu thật |
| Phiên bản trình duyệt, OS, thiết bị | **CHƯA CHẠY**; ghi tên + phiên bản thực tế khi thực hiện, không suy từ trình duyệt đã dùng ở báo cáo local |
| Viewport / thiết bị thật | Dự kiến `390 × 844` và `1366 × 900` CSS px; kích thước thực tế, DPR, zoom và thiết bị thật **chưa được ghi nhận** |
| Người thử / người vận hành / cửa sổ thao tác | **CHƯA PHÂN CÔNG**; cần operator cho restart, đọc DB và ca 429 có cấu hình riêng |
| Kết quả online hiện có | **0 ca đã chạy; 0 PASS; 0 FAIL; chưa có ảnh/PDF/log online**. Chưa phát hiện lỗi không đồng nghĩa không có lỗi |

Chỉ bắt đầu khi #82 bàn giao URL HTTPS truy cập được từ thiết bị khác, SHA tích hợp chứa các thay đổi cần thiết của #92/#95, tài khoản thử và xác nhận dữ liệu demo. Đọc lại hợp đồng trên **release đó** nếu khác các nguồn trên. Không chạy production-demo trực tiếp từ main `5c3e72d`: main này còn cờ cũ và chưa có `/health` hoặc limiter của các PR đang chờ. Không tự ghép cờ cũ để vượt điều kiện triển khai.

Hợp đồng dự kiến sau #95: server dùng duy nhất `PAYMENT_MODE`, mặc định `off`; `demo` cho mô phỏng có nhãn; `live` còn dành cho #84 và bị từ chối startup. Production demo cần `DEMO_DATA_ONLY=true`, `DB_NAME` tường minh và **xóa hoàn toàn** key cũ `DEMO_MODE`, kể cả giá trị false. Cờ dữ liệu chỉ là cam kết operator, không tự kiểm tra nội dung DB. Không ghi secret hoặc connection string vào báo cáo. Khi tích hợp #92 phải giữ resolver IP/CIDR `TRUST_PROXY_IPS` đã kiểm thử, cấu hình proxy thực tế; không thay trở lại hop 1 của nền #95.

## Chuẩn bị dữ liệu và cách ghi kết quả

- Operator cấp các alias `ADMIN-QA`, `OWNER-A`, `OWNER-B`, `OWNER-PENDING`, `CUSTOMER-A`, `CUSTOMER-B`, `GUEST-A`; chuẩn bị hai hồ sơ OWNER chờ nếu thử cả hai cách duyệt ở A03. Mật khẩu bàn giao ngoài repo. ADMIN được cấp theo script hiện có trong #82, không thêm route nâng quyền. Dùng email thử thuộc `example.com` và thông tin tên/địa chỉ/SĐT tổng hợp đã được operator xác nhận không thuộc khách thật; không gọi/SMS tới số mẫu.
- Cơ sở `FAC-A` thuộc OWNER-A, `FAC-B` thuộc OWNER-B; thêm cơ sở chưa có sân, sân inactive và tên dài trong giới hạn backend. Không biến cơ sở thành sân hoặc thay dữ liệu thật để tạo trạng thái rỗng.
- Sân `COURT-A`: `06:00–22:00`, cao điểm `17:00–22:00`, giá mỗi ô 30 phút thường `50.000`, cao điểm `75.000` đồng. Ngày `D` là ngày mai theo giờ Việt Nam, ghi ngày thật khi chạy. Chọn `16:30`, `17:00`, `19:00`: 3 ô, 90 phút, `200.000` đồng; `17:30` vẫn trống. Các ca hết hạn gần giờ bắt đầu dùng ngày hôm nay và ghi riêng UTC/giờ Việt Nam do server công bố.
- Hai phiên tranh ô phải độc lập cookie/session: hai profile trình duyệt hoặc Chrome và Edge riêng. Hai tab thường, hoặc hai cửa sổ ẩn danh cùng chia sẻ phiên, không đủ chứng minh điều kiện này.
- Mỗi dòng bên dưới là một ca; ca có nhiều biến thể phải ghi kết quả từng biến thể trước khi kết luận PASS. Thực tế hiện ghi **chưa thực hiện**, trạng thái **CHƯA CHẠY**. Khi có kết quả, bổ sung giờ chạy, release SHA, browser/OS, viewport, alias dữ liệu, quan sát, mã HTTP cần thiết và mã bằng chứng. Không suy PASS từ expected hoặc ảnh cũ.
- Các ca UI cần đối chiếu 390px và 1366px, gồm trạng thái thường/lỗi tương ứng. Nếu thử thêm trên **thiết bị vật lý khác máy triển khai**, ghi model/OS/browser/mạng; nếu chỉ thử bằng viewport thì ghi rõ, không gọi đó là thử trên điện thoại thật. Bằng chứng URL mở từ máy khác là phần bàn giao #82, chưa có trong báo cáo này.

## Bảng ca kiểm thử

Các mã `E-...` là bằng chứng **dự kiến chưa tồn tại**, theo quy tắc lưu ở cuối báo cáo. Mã đơn/sân trong đường dẫn dùng alias `:id`; không đưa query chứa token vào kết quả công khai.

S06 (đổi mode trên host) và P06 (gián đoạn DB có kiểm soát) là ca bổ sung, không phải yêu cầu bắt buộc của #83. Chỉ chạy khi operator có cửa sổ phù hợp trên service QA cô lập; nếu không, ghi HOÃN cùng lý do và giới hạn, không tính PASS. Các ca restart/cold-start và luồng chính vẫn phải có kết quả thực tế để nghiệm thu.

### Truy cập, tài khoản và quản lý

| ID | Bước thực hiện | Mong đợi | Thực tế | Trạng thái | Bằng chứng dự kiến |
| --- | --- | --- | --- | --- | --- |
| R01 | Operator đối chiếu release SHA/DB/mode; mở URL HTTPS từ desktop và thiết bị vật lý khác; đi qua `/`, `/facilities`, `/courts` bằng menu. | Đúng release/DB demo; HTTPS hợp lệ, CSS tải được; `/courts` dùng navigation chung có nhãn public-demo theo #95. Điều hướng hoạt động, không có lỗi trang hoặc secret hiển thị; không mặc định header riêng của trang chủ/cơ sở đã có banner này. | Chưa có URL/release để mở. | CHƯA CHẠY | `E-R01`: bàn giao đã lọc + ảnh hai viewport và thiết bị thật. |
| R02 | Mở `/courts`, thử lọc cơ sở/ngày/khoảng giờ hợp lệ, không kết quả, ngày quá khứ/sai và lặp tham số ngày; mở chi tiết từ kết quả. | Dữ liệu đúng cơ sở/ngày; lọc chỉ dùng GET, không tạo đơn; trạng thái rỗng/lỗi rõ, dữ liệu dài không tràn. Ngày sai bị từ chối theo hợp đồng release, không hiện như lịch trống hợp lệ. | Chưa thực hiện online. | CHƯA CHẠY | `E-R02`: thường/rỗng/lỗi 390 và 1366; xác nhận ghi DB nếu cần. |
| A01 | `/register`: gửi `fullName,email,phone,password,confirmPassword`; thử email sai, mật khẩu không khớp, email thử trùng rồi đăng ký CUSTOMER mới hợp lệ; đăng nhập. | Lỗi 400/409 theo trường hợp; giữ trường được phép và không điền lại password; hợp lệ 303 `/login`, tài khoản CUSTOMER, đăng nhập về `/courts`. | Chưa thực hiện online. | CHƯA CHẠY | `E-A01`: form thường/lỗi, redirect đã lọc, vai trò bằng alias. |
| A02 | `/register/owner`: thêm `phone,requestedFacilityName,requestedFacilityAddress`; thử thiếu/sai SĐT rồi đăng ký hợp lệ; đăng nhập và mở `/owner/courts/new`. | OWNER-PENDING thấy trạng thái chờ tại `/owner`; chưa tạo/sửa sân hoặc tự nhận APPROVED; thông tin lỗi hiển thị rõ. | Chưa thực hiện online. | CHƯA CHẠY | `E-A02`: trạng thái chờ/lỗi/403 hai viewport. |
| A03 | ADMIN-QA vào `/admin`, dùng form POST `/admin/owners/:id/approve`: một lần `facilityId` là cơ sở chưa có chủ, một lần để trống tạo từ hồ sơ; thử duyệt lại hồ sơ đã xử lý. | Cấp đúng OWNER/cơ sở trong transaction, 303 về `/admin`; không cấp trùng cơ sở; xử lý lại báo xung đột, dữ liệu chủ khác không đổi. | Chưa thực hiện online. | CHƯA CHẠY | `E-A03`: trước/sau theo alias và xác nhận DB chỉ đọc. |
| O01 | OWNER-A mở `/owner/courts/new`, POST `/owner/courts`, sau đó `/owner/courts/:id`; nhập tên, giờ mở/đóng/cao điểm, `basePriceVND,peakPriceVND,active`; thử giờ/giá sai, tên dài rồi lưu hợp lệ. | Chỉ sân FAC-A được tạo/sửa; lỗi giữ dữ liệu form; giá là mỗi 30 phút, giờ và trạng thái active phản ánh đúng. Sân inactive không nhận đặt mới. | Chưa thực hiện online. | CHƯA CHẠY | `E-O01`: tạo/sửa/lỗi/inactive/tên dài 390 và 1366. |
| O02 | OWNER-A dùng GET `/owner/facilities/:id/edit` và POST `/owner/facilities/:id` với `name,address,phone`; thử phone rỗng/sai rồi hợp lệ. | Bắt buộc SĐT liên hệ hợp lệ; giữ dữ liệu khi lỗi; không thay owner qua body. Header/card/chi tiết xử lý tên dài không tràn ngang. | Chưa thực hiện online. | CHƯA CHẠY | `E-O02`: form lỗi/đúng, tên dài và xác nhận cơ sở B không đổi. |
| O03 | OWNER-A mở `/owner/calendar`, đổi ngày bằng Tab/Enter, cuộn bảng; dùng FAC-A thường/rỗng/nhiều sân khác giờ/inactive/tên dài; OWNER-B đối chiếu FAC-B. | Đúng cơ sở/ngày/quyền; GET không giữ sân hoặc tạo đơn; ô quá giờ/HOLD còn hạn/hết hạn/BOOKED rõ; nội dung đọc được, bảng cuộn trong vùng của nó. | Chưa thực hiện online. | CHƯA CHẠY | `E-O03`: thường/rỗng/dài/focus/hai đầu bảng ở 390 và 1366. |

### Giữ sân, thanh toán mô phỏng và phiếu

| ID | Bước thực hiện | Mong đợi | Thực tế | Trạng thái | Bằng chứng dự kiến |
| --- | --- | --- | --- | --- | --- |
| B01 | CUSTOMER-A chọn 3 ô của COURT-A ngày D; POST `/bookings` dùng `courtId,date,times,_csrf`; đối chiếu checkout và ô ở giữa. Trong lượt riêng, thử trường giá/user/status do client tự thêm. | Tổng server `200.000`, 90 phút, đúng 3 ô; `17:30` không bị giữ. Giá/nhân thân/trạng thái lấy từ server, không tin body tự thêm; mỗi đơn một sân/ngày, giữ toàn bộ hoặc không ô nào. | Chưa thực hiện online. | CHƯA CHẠY | `E-B01`: chọn ô/checkout/hở lịch, operator xác nhận Booking/SlotLock đã lọc. |
| B02 | Gửi form đặt thiếu ô, phone sai; thử ô lặp/đã qua/ngoài giờ và ngày sai trong lượt riêng; quay lại sửa dữ liệu hợp lệ. | 400 theo dữ liệu; giữ tên/SĐT được phép khi phục hồi, tải lại giá và lịch mới, không khôi phục ô không còn khả dụng; không có HOLD/lock thừa. | Chưa thực hiện online. | CHƯA CHẠY | `E-B02`: lỗi và sửa lại 390/1366, tổng ghi DB chỉ đọc. |
| B03 | Hai phiên A/B độc lập cùng mở lịch có hai ô trống chung; A giữ một ô trước, B gửi lựa chọn cũ gồm ô đó và một ô còn trống; chạy thêm một lượt gửi gần đồng thời cùng bộ ô. | Chỉ bên thắng giữ được; bên còn lại nhận 409, không có giữ một phần, ô chưa xung đột không bị chiếm bởi đơn thua. Không khẳng định A luôn thắng ở lượt đồng thời. | Chưa thực hiện online. | CHƯA CHẠY | `E-B03`: trình tự/giờ hai phiên, 409, kết quả DB đã lọc cho cả lượt. |
| B04 | Tạo HOLD cho ô tương lai cách xa; ghi `createdAt`, hạn do server cung cấp; không thanh toán, chờ qua hạn rồi tải lại checkout/lịch và gửi POST thanh toán từ form cũ. | Hạn không quá 10 phút; qua hạn checkout/POST không xác nhận (410 khi hết hạn theo hợp đồng), HOLD thành EXPIRED, giải phóng ô tương lai; không hồi sinh hoặc tạo Payment. | Chưa thực hiện online. | CHƯA CHẠY | `E-B04`: trước/sau hạn, thời gian server và xác nhận DB. |
| B05 | Gần mốc bắt đầu, giữ bộ ô có ô đầu bắt đầu sau dưới 10 phút; chờ qua giờ ô đầu rồi thử POST cũ; phiên B đặt một ô tương lai vừa được giải phóng. | Hạn bằng `min(createdAt+10 phút, ô đầu bắt đầu)`. Ô đã bắt đầu UNAVAILABLE, các ô tương lai được mở lại; A không chiếm lại ô của B. Kiểm thử qua biên thời gian thật, không tuyên bố đã bắn đúng 1 ms bằng browser. | Chưa thực hiện online; biên đúng từng mili giây chưa được đo. | CHƯA CHẠY | `E-B05`: UTC/giờ Việt Nam trước/sau, hai phiên, xác nhận DB. |
| B06 | HOLD hợp lệ: POST `/bookings/:id/demo-payment` bằng form thật; mở receipt; gửi lại cùng thao tác trong cửa sổ thử được phép, reload và mở checkout. | CONFIRMED/DEMO_PAID, phiếu ghi MÔ PHỎNG/QR không thu tiền; checkout chuyển receipt. Chỉ một `INITIAL_DEMO`, lock đã xác nhận không hết hạn; bấm lại không thu/ghi lần hai. | Chưa thực hiện online. | CHƯA CHẠY | `E-B06`: checkout/phiếu/nhãn, xác nhận Payment/locks chỉ đọc. |
| B07 | Đăng xuất, GUEST-A đặt với `guestName,guestPhone`; giữ link checkout/receipt riêng trong phiên thử; mở lượt không token hoặc token sai từ phiên B. | Vãng lai đặt được, form/phiếu có nhãn demo; chỉ link riêng hợp lệ cho xem. Thiếu/sai token 403; mã đơn/SĐT không cấp quyền, không có quyền tự hủy/đổi. | Chưa thực hiện online. | CHƯA CHẠY | `E-B07`: vùng nội dung thường/lỗi, không lưu query/token. |
| B08 | Trên phiếu hợp lệ, chọn “In / Lưu PDF”; kiểm tra preview desktop/mobile và thiết bị thật, tắt header/footer browser trước khi lưu bản thử an toàn. | Phiếu đủ cơ sở/sân/ngày/ô/tổng/nhãn mô phỏng, bố cục đọc được và không cắt mất dòng; không có URL/token, secret hoặc metadata nhạy cảm. Không coi ảnh preview là đã lưu PDF. | Chưa thực hiện online; chưa tạo PDF online. | CHƯA CHẠY | `E-B08`: preview đã an toàn và PDF tổng hợp đã kiểm tra; số trang/browser/thiết bị thực tế. |

### Đổi, hủy và hoàn thủ công

| ID | Bước thực hiện | Mong đợi | Thực tế | Trạng thái | Bằng chứng dự kiến |
| --- | --- | --- | --- | --- | --- |
| C01 | CUSTOMER-A mở `/bookings/:id/request`, POST `/bookings/:id/requests` với `type=CHANGE,reason,requestedCourt,requestedDate,requestedTimes`; thử yêu cầu trùng, khác cơ sở và ô đã bị chiếm ngay lúc gửi. Ở lượt riêng, gửi CHANGE hợp lệ trước, để phiên B chiếm ô đích sau đó rồi OWNER duyệt; thử từ chối yêu cầu khác. | Chỉ chủ đơn yêu cầu; yêu cầu trùng 409/khác cơ sở 400. Ô bị chiếm trước lúc gửi trả 409, không tạo request. Xung đột sau khi đã tạo request hợp lệ khiến duyệt trả 409, giữ lịch/giá cũ và request PENDING. Từ chối có ghi chú, không giải phóng lịch cũ. | Chưa thực hiện online. | CHƯA CHẠY | `E-C01`: form/chờ/hai thời điểm xung đột/từ chối và DB đối chiếu. |
| C02 | Tạo yêu cầu đổi hợp lệ cùng FAC-A; OWNER POST `/owner/requests/:id/approve` với `refundAmount,ownerNote,extraPaymentConfirmed` khi cần thu thêm; thử thiếu xác nhận rồi xác nhận. | Đổi toàn đơn nguyên tử; lịch cũ giữ tới khi đổi thành công. Chênh lệch đúng snapshot mới, mode demo mới cho `EXTRA_DEMO`; không tự thu tiền thật hoặc tự áp phí cố định. | Chưa thực hiện online. | CHƯA CHẠY | `E-C02`: trước/sau/thiếu xác nhận, giá và Payment đã lọc. |
| C03 | CUSTOMER-A gửi `type=CANCEL,reason`; OWNER duyệt với khoản hoàn trong mức được phép, rồi `/owner/requests/:id/refund` ghi `ownerNote`; thử xử lý lại cùng yêu cầu. | Hủy giải phóng đúng ô; khoản hoàn từ PENDING sang TRANSFERRED chỉ là ghi nhận thủ công. Không tự chuyển tiền, không ghi hoàn trùng khi xử lý lại; đơn khác không đổi. | Chưa thực hiện online. | CHƯA CHẠY | `E-C03`: yêu cầu/duyệt/hoàn/lặp, DB chỉ đọc; không giao dịch thật. |
| C04 | GUEST-A không tự gửi yêu cầu; hai người thử mô phỏng trao đổi với cơ sở ngoài ứng dụng, OWNER dùng `/owner/bookings/:id/cancel` với `refundAmount,ownerNote`. | Guest không có quyền tự hủy/đổi. Chỉ OWNER đúng cơ sở xử lý và ghi chú theo trao đổi; không gọi/SMS tới số mẫu, không hoàn tiền thật. | Chưa thực hiện online. | CHƯA CHẠY | `E-C04`: quyền bị chặn/trang OWNER/kết quả đơn theo alias. |

### Session, quyền, CSRF và giới hạn POST

| ID | Bước thực hiện | Mong đợi | Thực tế | Trạng thái | Bằng chứng dự kiến |
| --- | --- | --- | --- | --- | --- |
| S01 | `/login` sai thông tin thử cố định rồi đúng; kiểm tra cookie qua HTTPS, reload; POST `/logout`, sau đó truy cập lại trang bảo vệ/Back + reload. | Sai 400/401, giữ email/không password; đúng 303 theo vai trò. Cookie `dat_san_sid` Secure/HttpOnly/SameSite=Lax; session được đổi lúc login, logout hủy session, không còn xem trang bảo vệ bằng session cũ. | Chưa thực hiện online. | CHƯA CHẠY | `E-S01`: lỗi/navigation; chỉ ghi boolean thuộc tính cookie và kết quả, không chụp giá trị. |
| S02 | Trên form thử, bỏ/sửa `_csrf` rồi gửi một POST không hợp lệ; mở lại form để gửi token hiện tại. Không xuất DOM/body ra file. | CSRF sai/thiếu 403 trước ghi nghiệp vụ và trước limiter #92; form mới hoạt động. Không đổi quyền/giá/Booking/Payment khi bị chặn. | Chưa thực hiện online. | CHƯA CHẠY | `E-S02`: thông báo 403 + xác nhận không ghi DB; không chứa token. |
| S03 | Thử guest/CUSTOMER/OWNER-PENDING/OWNER-B truy cập các route ADMIN, sân/cơ sở/đơn FAC-A; CUSTOMER-B mở đơn CUSTOMER-A; thử body thêm owner/facility/role. | Guest chuyển login ở route cần tài khoản; sai vai trò bị 403. OWNER hợp lệ sửa sân/cơ sở không thuộc mình bị 404; xem đơn trái quyền bị 403. Server không nâng quyền từ body; owner đúng và ADMIN chỉ thực hiện quyền đã cấp. | Chưa thực hiện online. | CHƯA CHẠY | `E-S03`: ma trận alias/route/status và DB FAC-B không đổi. |
| S04 | Sau khi #92 đã tích hợp và operator duyệt ngân sách bên dưới, kiểm tra riêng quota login theo account+IP, booking theo actor và các quota IP của bốn endpoint. Dừng ngay lần 429 đầu mỗi tiêu chí. | 429 kèm `Retry-After` số giây dương, `Cache-Control:no-store`, trang lỗi đọc được; không ghi nghiệp vụ. Sau cửa sổ mới nhận lại request; không suy quota IP đạt chỉ từ việc actor bị chặn. | Chưa thực hiện; chưa có host/cấu hình/ngân sách được duyệt. | CHƯA CHẠY | `E-S04`: chính sách thực tế đã lọc, số lần/status/header an toàn, ảnh429 390/1366, xác nhận DB. |
| S05 | Operator đối chiếu proxy thực; từ hai phiên/thiết bị thử độc lập kiểm tra nhận diện client và một request thử header giả trong phạm vi đã duyệt. | Không gom mọi người vào IP proxy, không cho client tùy ý đổi IP limiter/HTTPS bằng header không tin cậy. Kết quả inconclusive nếu không quan sát được đường proxy thật. | Chưa thực hiện; cấu hình proxy chưa bàn giao. | CHƯA CHẠY | `E-S05`: xác nhận resolver và kết quả đã ẩn IP/header riêng tư. |
| S06 | Trong cửa sổ operator riêng, chuyển mode `off`, restart đúng SHA/DB, thử POST INITIAL/EXTRA mô phỏng bằng form/lượt thử hợp lệ; mở lại phiếu DEMO_PAID cũ và nghiệp vụ hủy/hoàn; sau đó phục hồi demo. | Off chặn cả hai mô phỏng mới phía server, không chỉ ẩn nút. Phiếu cũ vẫn nhãn mô phỏng; hủy/ghi hoàn thủ công giữ quyền hiện có. Client không bật lại demo; `live` chưa được dùng. | Chưa thực hiện; chưa có cửa sổ đổi cấu hình. | CHƯA CHẠY | `E-S06`: mode không secret, trước/sau, hai POST bị chặn và xác nhận DB. |

Nguồn chính sách **chưa phải cấu hình online**: PR #92 áp dụng limiter sau CSRF cho POST `/login`, `/register`, `/register/owner`, `/bookings`; không áp mặc định cho GET hoặc mọi POST khác.

| Endpoint | Mặc định trong nguồn #92 | Chốt trước ca S04 |
| --- | --- | --- |
| `/login` | 900 giây; IP 60, account+IP 8 | Giá trị thực tế và cách tách lượt actor/IP |
| `/register` | 900 giây; IP 12 | Cửa sổ riêng, request dữ liệu lỗi không tạo tài khoản |
| `/register/owner` | 900 giây; IP 12 | Cửa sổ riêng, request dữ liệu lỗi không tạo tài khoản |
| `/bookings` | 600 giây; IP 60, actor 12 (user hoặc session) | Dữ liệu lỗi có CSRF hợp lệ, không tạo HOLD |

Không chạy vòng lặp, dò mật khẩu, tải lớn hoặc cố chạm quota IP 60 trên service có người khác dùng. Ưu tiên **service QA cô lập** và operator phê duyệt chính sách tạm nhỏ: cửa sổ 60 giây, IP max 2; login account+IP max 1, booking actor max 1 qua các biến `RATE_LIMIT_*` thực sự có trong release. Đối chiếu tên biến với nguồn #92 trước đặt; không tự chỉnh môi trường đang dùng chung. Ngân sách tối đa **22 POST** cho toàn nhóm S04: 4 lượt cho hai tầng actor (2 mỗi tầng), 12 lượt cho bốn tầng IP (3 mỗi tầng), cộng 6 lượt xác minh sau khi từng cửa sổ đã hết hạn. Không gửi thêm ngoài ngân sách. Mỗi khối dừng ở lần 429 đầu; lượt xác minh chỉ gửi sau khi cửa sổ đó đã qua, dùng dữ liệu lỗi để mong đợi 400/401 thay vì 429 và không tạo bản ghi nghiệp vụ. Các cửa sổ không lẫn lượt khác. Login dùng một mật khẩu sai cố định của tài khoản tổng hợp; không thử nhiều mật khẩu. Mỗi tiêu chí IP dùng actor khác để không bị quota actor chặn trước. POST lỗi controller 400/401 có CSRF hợp lệ vẫn được tính; CSRF 403 không tính quota.

Limiter giữ bộ đếm trong RAM từng instance, reset khi restart. Ghi số instance, lần restart, giờ bắt đầu/reset và traffic khác; nếu đổi instance/có traffic ngoài hoặc chưa được phép chỉnh policy thì đánh dấu **CHƯA CHẠY / KHÔNG KẾT LUẬN**, không nới ngân sách. Sau ca thử operator phục hồi cấu hình dự kiến dùng, restart có kiểm soát và kiểm tra lại; không công bố kết quả policy tạm như đã thử đủ default production.

### Health, restart và cold start

| ID | Bước thực hiện | Mong đợi | Thực tế | Trạng thái | Bằng chứng dự kiến |
| --- | --- | --- | --- | --- | --- |
| P01 | Sau merge #95, gọi GET và HEAD `/health` khi sẵn sàng, không login; operator đối chiếu session trước/sau bằng tổng số đã lọc. | GET 200 `{"status":"ok"}`, HEAD cùng status không body; không Set-Cookie/tạo session, không lộ DB/URI/user. DB ping giới hạn 2 giây và dùng chung lần ping đang chạy theo hợp đồng #95. | Chưa thực hiện; endpoint chưa có trong main nguồn báo cáo. | CHƯA CHẠY | `E-P01`: status/body công khai và xác nhận session chỉ đọc. |
| P02 | Operator hẹn cửa sổ restart thủ công **trước hạn**; CUSTOMER-A tạo HOLD mới còn đủ thời gian, ghi deadline và trạng thái login; restart cùng release/DB, không đổi SESSION_SECRET; mở lại khi vẫn trước deadline. | Session MongoStore tiếp tục hợp lệ, hạn HOLD giữ mốc cũ, không cộng thêm 10 phút. Còn hạn/đủ lock mới được xác nhận; gián đoạn kéo qua hạn phải đánh giá như P03, không PASS P02. | Chưa thực hiện; chưa có quyền/cửa sổ restart. | CHƯA CHẠY | `E-P02`: operator timeline trước/sau, deadline, session boolean và DB đã lọc. |
| P03 | Với HOLD khác, để deadline qua rồi operator restart; mở lại checkout và POST form cũ; đối chiếu ô tương lai từ phiên B. | Startup dọn HOLD theo hạn thật; đơn EXPIRED, không hồi sinh, không Payment mới. Ô tương lai mở lại, ô đã bắt đầu không thể đặt; đơn xác nhận khác không bị ảnh hưởng. | Chưa thực hiện online. | CHƯA CHẠY | `E-P03`: thời gian restart/hạn, 410, lịch và DB sau restart. |
| P04 | Có đơn CONFIRMED/DEMO_PAID, operator restart cùng SHA/DB/secret; mở phiếu và gửi lại thao tác mô phỏng trong phạm vi thử. | Đơn/phiếu/nhãn và lock xác nhận còn nguyên; không biến thành EXPIRED, không giải phóng ô, không nhân đôi `INITIAL_DEMO` hoặc lịch sử Payment. | Chưa thực hiện online. | CHƯA CHẠY | `E-P04`: phiếu/lịch trước/sau, xác nhận Payment/SlotLock chỉ đọc. |
| P05 | Nếu service thực dùng gói có ngủ do idle, operator xác nhận đã spin down; không ping/monitor giữ thức trong lúc chờ. Ghi thời điểm request đầu đánh thức và khi dùng được; mở phiếu xác nhận cũ và HOLD tạo trước khi ngủ. | Ghi độ trễ thực tế, không hứa SLA. Với Free Render, idle 15 phút vượt hạn HOLD tối đa 10 phút: HOLD cũ phải hết hạn, **không kỳ vọng HOLD chưa hết hạn sống qua lần ngủ này**. CONFIRMED/Payment/session còn hợp lệ phải tồn tại nếu chưa quá TTL. | Chưa thực hiện; chưa biết gói service/có spin down. | CHƯA CHẠY | `E-P05`: xác nhận idle/wake, thời gian/status, phiếu/lịch/DB; không giả lập restart thành cold start. |
| P06 | Chỉ operator trong service QA cô lập tạo gián đoạn DB đã duyệt khi process còn sống; gọi `/health`, mở trang đọc lịch, phục hồi kết nối. Không ngắt Atlas chung. | Khi DB không sẵn sàng, health 503 `unavailable`, không secret; lỗi DB không bị trình bày như lịch trống hợp lệ. Khi process không chạy, lỗi gateway/cold start phải ghi đúng thay vì gán 503 của app; phục hồi hoạt động mà không nhân đôi Payment. | Chưa thực hiện; chưa có cửa sổ gây lỗi. | CHƯA CHẠY | `E-P06`: timeline/status/log chỉ có thông tin đã lọc và xác nhận operator. |

Theo [tài liệu Free Render](https://render.com/docs/free), service miễn phí có thể ngủ sau 15 phút idle và mất khoảng một phút để đánh thức; gói thực tế phải được xác nhận. [Health Checks](https://render.com/docs/health-checks) mô tả readiness/deploy health. Những thông tin nhà cung cấp không thay kết quả P01–P06 trên URL/release của đồ án.

## Thu thập bằng chứng an toàn

**Thiết kế cách chụp trước khi thao tác**, không lưu ảnh bí mật rồi mới che. Dùng dữ liệu tổng hợp; chọn screenshot phần tử hoặc vùng nội dung bằng công cụ CUA gốc để loại thanh địa chỉ, query và browser chrome. Không chụp DevTools có Cookie/CSRF/body, giá trị password, link vãng lai, dashboard secret hoặc log URI. Không xuất HAR, HTML đầy đủ, request body, cookie jar hoặc console dump chứa thông tin đăng nhập. Header chỉ ghi status, `Retry-After`, `Cache-Control` và boolean thuộc tính cookie; không lưu `Set-Cookie` nguyên văn.

Với PDF: ưu tiên phiếu tài khoản thử không có query; tắt **Headers and footers** trong preview trước khi lưu. Nếu preview/tiêu đề/metadata có URL riêng hoặc token, dừng lưu và sửa cách tạo bằng chứng trước; không lưu PDF thô nhạy cảm vào repo rồi mới xóa. Chỉ nộp bản tổng hợp đã kiểm tra cả nội dung và metadata; ảnh preview không thay file PDF đã kiểm tra. Không chia sẻ link guest hoặc mật khẩu để reviewer mở lại; reviewer dùng tài khoản thử được cấp ngoài PR.

UI chứng minh trạng thái nhìn thấy, **không chứng minh chính xác số Booking/SlotLock/Payment hoặc DB cô lập**. Operator được phân quyền xác nhận chỉ đọc trên DB demo, dùng alias/mã ca, ghi tổng trước/sau và mốc thời gian; không tạo API quản trị, sửa DB bằng trình duyệt hoặc dump tài liệu/connection string để bổ sung bằng chứng. Nếu chưa có xác nhận, phần nguyên tử/idempotency/session DB giữ trạng thái chưa kết luận.

Chỉ sau khi có dữ liệu thật của lần thử mới tạo thư mục bằng chứng. Các đường dẫn dưới đây là **kế hoạch**, chưa là file hay link có thể mở:

| Bằng chứng dự kiến | Nội dung cần có | Hiện trạng |
| --- | --- | --- |
| `docs/kiem-thu-render/<release-sha>/manifest.json` | URL origin HTTPS được phép công khai; release SHA; ngày/giờ; browser/OS/viewport/DPR/zoom; thiết bị vật lý/mạng; alias fixture; map từng `E-ID` tới file an toàn | CHƯA TẠO |
| `docs/kiem-thu-render/<release-sha>/<case-id>-390-normal.png` và `...-error.png` | Nội dung thường/lỗi của từng ca UI, không thanh địa chỉ/query/secret | CHƯA CHỤP |
| `docs/kiem-thu-render/<release-sha>/<case-id>-1366-normal.png` và `...-error.png` | Cùng trạng thái desktop; thêm ảnh focus/cuộn bảng cho O03 | CHƯA CHỤP |
| `docs/kiem-thu-render/<release-sha>/physical-device.md` | Thiết bị thực/model/OS/browser/mạng và ID ảnh của R01/B07/B08/S01; không coi emulation là thiết bị thật | CHƯA TẠO |
| `docs/kiem-thu-render/<release-sha>/http-summary.json` | Case ID, giờ, route **không query**, method, status và header cho phép; không body request/cookie/token/IP thật | CHƯA TẠO |
| `docs/kiem-thu-render/<release-sha>/operator-confirmation.md` | Xác nhận SHA/DB demo/backup, timeline restart/idle, các tổng dữ liệu trước/sau chỉ đọc, policy limiter thực tế và giới hạn quan sát | CHƯA ĐƯỢC XÁC NHẬN |
| `docs/kiem-thu-render/<release-sha>/receipt-demo.pdf` | PDF phiếu tổng hợp đã kiểm tra nhãn, số trang, nội dung/metadata không token/URL riêng | CHƯA TẠO |

## Ghi lỗi và bàn giao

**Chưa có lỗi được kiểm thử/tái hiện online trong báo cáo này, vì số ca đã chạy bằng 0.** Khi thấy sai khác, tạo một bản ghi theo mẫu sau; không chuyển mẫu trống thành lỗi đã tồn tại:

```text
BUG-RENDER-<số> — <tóm tắt>
Trạng thái: CHƯA TÁI HIỆN / ĐÃ TÁI HIỆN / CHỜ RETEST / ĐÃ SỬA
Case ID; URL origin công khai (không query); release SHA; thời gian + múi giờ:
Browser/OS; viewport/DPR/zoom; thiết bị vật lý hay emulation:
Tiền điều kiện và alias dữ liệu/session:
Bước tái hiện tối thiểu:
Mong đợi:
Thực tế + mã HTTP đã lọc:
Bằng chứng E-ID/file đã kiểm tra riêng tư:
Ảnh hưởng, mức độ và giới hạn quan sát:
Người nhận sửa; PR/SHA sửa; kết quả retest:
```

Chỉ cập nhật kết luận sau khi điền kết quả thật cho từng ca/biến thể. Ca chưa chạy phải ghi lý do/người quyết định hoãn và ảnh hưởng; lỗi chưa sửa phải có người nhận và kế hoạch retest. `npm run check`, `npm test`, CI hoặc báo cáo local là điều kiện hỗ trợ riêng, **không tính PASS online**. Không dùng ảnh cũ khác SHA để kết luận về release này.

Hiện báo cáo còn chờ #82/PR #94 bàn giao, #92/#95 tích hợp và bằng chứng của toàn bộ ca trên. [Issue #83](https://github.com/indominusrex932005-arch/dat-san-tu-dau/issues/83) cần nhóm trưởng review kết quả thực tế trước khi nghiệm thu; tài liệu chuẩn bị này không tự đóng issue và không xác nhận website đã sẵn sàng dùng thật.
