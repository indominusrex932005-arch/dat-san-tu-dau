# Lịch điều hành cơ sở — backend #62

## Đường dẫn và quyền

`GET /owner/calendar?date=YYYY-MM-DD` nằm sau `requireAuth` và `requireOwner` hiện có. Trên `/owner` có liên kết **Lịch điều hành sân** khi đã được cấp cơ sở.

- Khách chưa đăng nhập: **303 → /login**.
- CUSTOMER, ADMIN, OWNER PENDING/REJECTED hoặc chưa được cấp cơ sở: **403**.
- OWNER APPROVED có cơ sở: service đọc lại danh tính/quyền trong `User`, rồi tìm `Facility.owner` từ `_id` người đăng nhập. Query/body `owner`, `ownerId`, `facility`, `facilityId` không quyết định phạm vi.
- Mỗi request đọc DB; session cũ không giữ quyền sau khi bị thu hồi vai trò/duyệt hoặc chuyển cơ sở sang người khác.
- Ngày sai/trống/lặp/quá khứ: **400**. Lỗi đọc DB đi qua xử lý lỗi chung **500**, không đổi thành lịch rỗng hoặc trả nội dung lỗi DB.

Chỉ đọc lịch; không có thao tác đặt, đổi trạng thái sân, bảo trì, doanh thu hay cập nhật thời gian thực trong phần này. GET có thể ghi session/CSRF như ứng dụng hiện tại; không ghi dữ liệu nghiệp vụ.

## Ngày và trục giờ

- Không có tham số `date`: hôm nay theo `Asia/Ho_Chi_Minh` (UTC+7).
- Nếu có `date`, phải là một chuỗi ISO hợp lệ, không được trống, lặp, sai kiểu hoặc trong quá khứ. Cho phép ngày tương lai xa hơn bảy ngày.
- `dayOptions` luôn là **hôm nay → hôm nay + 6**, không phải bảy ngày từ ngày đang xem. Nếu xem ngày xa hơn, không mục nào có `isSelected=true`; input ngày vẫn giữ ngày đã chọn.
- `timeColumns` là **hợp các ô 30 phút** trong giờ phục vụ của tất cả sân thuộc cơ sở, kể cả sân inactive. Sắp tăng theo giờ, không cố định 06–22 và không tự chèn các khoảng mà không sân nào phục vụ.
- Ví dụ sân sáng 05–08, sân tạm ngừng 08–09 và sân tối 21–23:30 tạo các cột 05:00…08:30, 21:00…23:00; không thêm cột 09:00…20:30.
- Từng hàng có số ô/thứ tự `time,endTime` giống hệt `timeColumns`. Ô ngoài giờ riêng của sân là `UNAVAILABLE`, `priceVND=null`.

Sân active dùng trực tiếp `makeSlots` của `domain/booking-rules.js`: ô bắt đầu đúng lúc hiện tại hoặc đã qua là `UNAVAILABLE`; lock còn hạn là `LOCKED`; lock không có hạn là `BOOKED`; lock hết hạn hoặc đúng hạn bị bỏ qua khi đọc. Không dọn lock hay chuyển Booking thành EXPIRED trong GET lịch.

Sân `active=false` vẫn có hàng, view ghi **Tạm ngừng**, toàn bộ ô là `UNAVAILABLE`, kể cả ô có lock. Giá trong giờ có thể giữ giá hiện tại do `makeSlots` tính; không suy ra trạng thái/tiền của đơn từ giá này.

## Locals bàn giao cho UI #63

Controller `showOwnerCalendar` render `views/owner-calendar.ejs` với `title='Lịch điều hành sân'` và các locals sau:

| Local | Kiểu / ý nghĩa |
| --- | --- |
| `facility` | Object `{_id, name, address, phone?}` của đúng cơ sở được cấp. Không populate OWNER hoặc thông tin đơn |
| `selectedDate` | Chuỗi `YYYY-MM-DD` đang xem |
| `dayOptions` | 7 object `{date: string, label: string, isSelected: boolean}`; `label` định dạng tiếng Việt |
| `timeColumns` | Mảng `{time: 'HH:MM', endTime: 'HH:MM'}` đã sắp tăng, có thể không liên tục |
| `courtRows` | Mảng `{courtId: string, name: string, active: boolean, slots: [...]}`; đủ sân active/inactive, sắp theo name rồi ID |
| `courtRows[].slots[]` | `{time, endTime, status, priceVND}`; `status` chỉ `AVAILABLE / LOCKED / BOOKED / UNAVAILABLE`; `priceVND` là số hoặc `null` ngoài giờ |

Đây là **locals EJS, không phải API JSON mới**. Service export `getOwnerCalendar(owner, query = {}, now = new Date())`; controller chỉ truyền `req.currentUser, req.query`. Tham số `now` phục vụ kiểm thử xác định mốc UTC+7; route không nhận đồng hồ từ client.

`priceVND` là **giá niêm yết hiện tại mỗi ô 30 phút**, không phải snapshot tiền của Booking, tiền đã thu hay doanh thu. View tối thiểu chỉ hiển thị giờ/trạng thái, chưa hiển thị giá. Service không đọc Booking/Payment, không trả mã đơn, người đặt, điện thoại khách hoặc token/link phiếu.

Cơ sở chưa có sân: `courtRows=[]`, `timeColumns=[]`, vẫn trả ngày và bảy lựa chọn; view ghi **Cơ sở chưa có sân.**. Lỗi DB khác hoàn toàn trạng thái rỗng này.

View dùng `<%=` để escape tên cơ sở/địa chỉ/tên sân, form GET chọn ngày, các liên kết bảy ngày và table có header hàng/cột. Bảng nhiều giờ nằm trong vùng cuộn ngang có thể focus bằng bàn phím. CSS nhỏ trong view chỉ phục vụ bảng tối thiểu; thiết kế hoàn chỉnh thuộc #63, kiểm thử chéo thuộc #66.

## Cách đọc dữ liệu và tác động

Service có tối đa bốn truy vấn đọc cho lịch có sân: `User.findOne`, `Facility.findOne`, `Court.find`, `SlotLock.find`. Middleware xác thực của app có truy vấn User riêng như trước. Với cơ sở rỗng không query lock.

Query Court giới hạn theo facility trong DB. Query SlotLock giới hạn `$in` các court ID đó và khoảng ngày UTC tương ứng 00:00 Việt Nam đến trước 00:00 hôm sau, chỉ lấy court/slotStart/expiresAt. Lock được nhóm bằng Map trong bộ nhớ; không query theo từng sân/ô, không sao chép bộ luật khả dụng mới.

Không thay schema/index/migration, không thêm thư viện. Không tạo/sửa/xóa Booking, SlotLock, Payment, BookingRequest, User, Facility hoặc Court khi đọc lịch; các test đối chiếu count và SHA-256 nội dung bảy collection, bỏ session khỏi so sánh theo đúng phạm vi.

## Kết quả kiểm thử backend ngày 24/10/2026

- Nền: main [`f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7`](https://github.com/indominusrex932005-arch/dat-san-tu-dau/tree/f8c1cfb900ab4ba4cd568e520dce46d9e2dbf0b7), mới hơn nền 5903881 ghi khi lập issue.
- Code đã kiểm thử: [`2fa29be2f1bf4e5d28bdf23456dce627c6bb2e37`](https://github.com/indominusrex932005-arch/dat-san-tu-dau/tree/2fa29be2f1bf4e5d28bdf23456dce627c6bb2e37). Commit sau chỉ bổ sung tài liệu/bằng chứng.
- Node **24.15.0**, MongoDB **8.3.11**, replica set riêng `qaOwnerCalendar62` trên `127.0.0.1:27057`; mỗi suite tự tạo và dọn DB `booking_test_*`. Không đọc `.env`, không dùng Atlas.
- `npm run check`: **PASS**, ESLint + **18 EJS**.
- `node --test --test-concurrency=1 tests/owner-calendar.test.js tests/owner-calendar-http.test.js`: **23/23 PASS** (21 ca con và 2 ca tổng).
- `npm test`: **134/134 PASS**, 0 fail/skip; gồm các chức năng có sẵn và phần mới.

| Tiêu chí #62 | Kết quả thực tế / test tương ứng |
| --- | --- |
| Hai OWNER, CUSTOMER/khách/chưa duyệt/chưa cấp cơ sở | PASS, service và HTTP kiểm tra phạm vi cùng mã 303/403; có ca thu hồi quyền và chuyển cơ sở khi session còn sống |
| Không đổi phạm vi bằng query/body | PASS, query trỏ OWNER/cơ sở B vẫn chỉ trả hàng của A; GET có body urlencoded cũng không đổi date hoặc phạm vi |
| Nhiều giờ phục vụ, inactive, ngoài giờ/đã qua | PASS, hợp cột 05–09 và 21–23:30; hàng inactive toàn UNAVAILABLE; ô ngoài giờ có giá null; đúng mốc bắt đầu không còn AVAILABLE |
| HOLD còn hạn/hết hạn/đúng hạn, đã đặt | PASS, cùng makeSlots; expired vẫn HOLD và lock vẫn lưu DB sau GET; BOOKED không lấy snapshot tiền làm giá hiện tại |
| Ngày sai/lặp/quá khứ, UTC+7, tương lai | PASS, có test qua năm mới UTC 17:00 → ngày mới Việt Nam và ngày xa hơn bảy ngày |
| Lỗi DB khác rỗng | PASS, giả lập lỗi từng bước đọc để xác nhận truyền lỗi; HTTP Facility/Court/SlotLock 500 chung, không lộ lỗi riêng |
| GET không ghi dữ liệu | PASS, snapshot count/digest bảy model trước/sau GET bằng nhau; session không nằm trong phép so sánh |
| View có dữ liệu/rỗng, escape và bảo mật | PASS qua route/controller/EJS thật trên HTTP; không có thông tin riêng của Booking/token trong HTML |
| View đọc được bằng trình duyệt, ảnh desktop/mobile | **CHƯA CHẠY**. Computer Use tự dừng vì không xác minh chắc chắn URL Chrome; không lấy EJS/HTTP/lint làm bằng chứng bố cục hoặc bàn phím thật |

[Kết quả máy chạy và cleanup](kiem-thu-lich-dieu-hanh/backend-62.json). Test thời gian service truyền `now` xác định; không đổi đồng hồ hệ điều hành. Test HTTP dùng đồng hồ thật và cookie jar riêng. Lỗi DB trong test được chủ động gây ra để kiểm tra nhánh lỗi, không khẳng định DB thật đã gặp sự cố.

Để chạy lại: dùng Node 24 và MongoDB replica set localhost riêng, đặt `TEST_MONGODB_URI` của DB thử rồi chạy các lệnh trên. Không chạy test/migration/seed vào Atlas chung. UI #63 chỉ bắt đầu trên backend đã review/merge; kiểm thử trình duyệt và ảnh cần làm bổ sung khi công cụ sẵn sàng, không đánh dấu đã chạy trong báo cáo này.
