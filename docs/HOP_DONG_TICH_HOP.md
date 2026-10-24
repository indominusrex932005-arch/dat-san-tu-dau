# Hợp đồng tích hợp — 23/10/2026

Quyết định của nhóm trưởng: MVC ở gốc; chủ sân đăng ký chờ ADMIN duyệt/cấp cơ sở; khách CUSTOMER đăng ký hoặc đặt vãng lai; nhiều ô 30 phút rời nhau một sân/một ngày; giá thường/cao điểm/giờ mở cửa do chủ sân cấu hình; giữ tối đa 10 phút, trước khi ô đầu tiên bắt đầu; chỉ thanh toán MÔ PHỎNG khi DEMO_MODE=true; khách có tài khoản gửi yêu cầu hủy/đổi cho chủ sân; khách vãng lai gọi điện. Phiếu có In/Lưu PDF. QR thật/ngân hàng còn dở phải có tài liệu và hình minh họa rõ.

Cập nhật hạn giữ theo issue #37 ngày **24/10/2026**: máy chủ dùng UTC, `holdExpiresAt = min(now + 10 phút, earliestSelectedSlot.startAt)`. Đây là hạn chung của cả Booking và toàn bộ SlotLock của đơn; không kéo dài hạn khi đọc lại. HOLD cũ có mốc lưu muộn hơn giờ bắt đầu phải áp dụng cùng hạn thực tế. Từ đúng mốc này, HOLD chưa xác nhận hết hiệu lực và không được thanh toán; CONFIRMED/lock đã xác nhận không bị cleanup HOLD giải phóng.

## Model chung (giữ tên field cũ nếu được)

- User: fullName,email,passwordHash; role CUSTOMER/OWNER/ADMIN mặc định CUSTOMER; ownerStatus PENDING/APPROVED/REJECTED; phone,requestedFacilityName,requestedFacilityAddress. Người dùng cũ thiếu role được coi là CUSTOMER. Chỉ script cấp ADMIN, web không tự đăng ký ADMIN.
- Facility: name,address,phone,owner nullable ref User; owner unique partial chỉ ObjectId (mỗi chủ một cơ sở). ADMIN có thể cấp cơ sở chưa có owner hoặc tạo mới từ thông tin đề nghị. OWNER không tự nhận cơ sở có sẵn.
- Court: facility ref,name,active; openTime 06:00,closeTime 22:00,peakStartTime 17:00,peakEndTime 22:00; basePriceVND,peakPriceVND giá MỖI Ô 30 PHÚT, integer>=0; pricePerHour giữ optional tương thích dữ liệu cũ.
- Booking: user nullable ref; facility,court refs; publicCode unique; guestName,guestPhone; guestTokenHash select:false; date YYYY-MM-DD; slots[{startAt,endAt,priceVND}],totalPrice integer; status HOLD/CONFIRMED/EXPIRED/CANCELLED/LEGACY_RESERVED; paymentStatus UNPAID/DEMO_PAID/PAID; holdExpiresAt; legacy bool; startHour optional cho dữ liệu cũ. Không đánh dấu đơn cũ là đã trả tiền.
- SlotLock: court,booking refs,slotStart Date,expiresAt Date/null; unique court+slotStart; không TTL làm mất chỗ booked.
- Payment: booking ref,amountVND integer,type INITIAL_DEMO/EXTRA_DEMO,method DEMO,recordedBy nullable; unique booking+type cho mô phỏng ban đầu idempotent.
- BookingRequest: booking,user nullable,type CANCEL/CHANGE,status PENDING/APPROVED/REJECTED; reason,requestedCourt,requestedDate,requestedTimes[]; ownerNote,refundAmount,refundStatus NONE/PENDING/TRANSFERRED,extraAmount,processedAt,refundRecordedAt. Một request PENDING mỗi Booking bằng partial unique index. Guest hủy qua chủ sân dùng source OWNER_CALL, user nullable.

## Quy tắc và quyền

- slots 30 phút chọn rời nhau; chỉ giữ ô đã chọn; snapshot giá mỗi ô; ngày/giờ theo Việt Nam. Thu toàn bộ, không đặt cọc.
- Transaction tạo Booking + tất cả SlotLock; đủ ô hoặc không ô nào. Xử lý lock hết hạn trong transaction khi ghi. Xác nhận mô phỏng phải còn HOLD/chưa hết hạn/còn đầy đủ locks của đơn; không hồi sinh đơn hết hạn.
- DEMO_MODE chỉ khi process.env.DEMO_MODE==='true' và NODE_ENV!=='production'. Hiển thị rõ thanh toán mô phỏng, chưa nhận/xác minh tiền ngân hàng. Có thể in phiếu mô phỏng với nhãn đó.
- user của Booking lấy từ req.currentUser, không lấy từ body. Guest cần tên/SĐT; chỉ token ngẫu nhiên khó đoán cho xem/phiếu/mô phỏng đơn của mình, DB lưu hash, không cho guest tự hủy/đổi.
- CUSTOMER tự gửi CANCEL/CHANGE chỉ đơn của mình còn hiệu lực/chưa bắt đầu. Chưa tự hủy/đổi/hoàn theo chính sách gốc, chủ sân xét yêu cầu. CHANGE cùng cơ sở, giữ lịch cũ tới khi đổi thành công. Nếu giá mới cao hơn cần xác nhận đã xử lý chênh lệch; không tự áp phí30k. Khoản hoàn do chủ sân nhập/ghi nhận, không chuyển tiền tự động.
- OWNER duyệt chỉ Facility.owner của mình, từ chối/đồng ý request; hủy đơn qua điện thoại cho khách vãng lai; ghi nhận đã chuyển hoàn. Mọi POST CSRF. Không tin owner/facility/role/giá client gửi.
- ADMIN duyệt tài khoản OWNER; pending/rejected không quản lý sân. Không nâng quyền bằng request/cookie.

## Route + dữ liệu view

Auth: GET/POST /register (customer), GET/POST /register/owner (owner pending), GET/POST /login, POST /logout. View register nhận accountType='CUSTOMER'|'OWNER', fullName,email,phone,requestedFacilityName,requestedFacilityAddress,errorMessage,title. Login nhận email,errorMessage,title. Middleware exports attachCurrentUser,requireAuth,requireOwner,requireAdmin. res.locals currentUser,csrfToken,demoMode,formatMoney,formatDate.

Court: GET /courts (view courts: courts,title); GET /courts/:id?date=... (view court-detail: court populate facility,date,slots [{time,endTime,priceVND,status AVAILABLE/BOOKED/LOCKED/UNAVAILABLE}],title,errorMessage). Form hold POST /bookings body courtId,date,times[] OR times(single),guestName,guestPhone. Người đăng nhập cũng điền SĐT, tên mặc định currentUser.fullName.

Booking: POST /bookings → 303 /bookings/:id/checkout?token=... (token chỉ guest). GET /bookings/:id/checkout (booking populate court/facility với holdExpiresAt thực tế,serverNow ISO UTC,token,title,errorMessage), POST /bookings/:id/demo-payment body token,_csrf → receipt. Đồng hồ dùng hạn và thời điểm máy chủ; hết thời gian chỉ vô hiệu nút, không tự khẳng định DB đã chuyển EXPIRED. GET /bookings/:id/receipt cùng quyền xem. GET /my-bookings (bookings,title). GET /bookings/:id/request (booking,courts cùng cơ sở,token,title,errorMessage); POST /bookings/:id/requests body type,reason,requestedCourt,requestedDate,requestedTimes[]; chỉ user sở hữu, redirect /my-bookings.

Phục hồi form đặt sân (#38, 24/10/2026): POST `/bookings` lỗi đầu vào/xung đột hợp lệ trả **400/409** và render lại `court-detail` từ `getAvailability` mới nhất. Locals bổ sung: `bookingFormError=true`, `formValues:{guestName,guestPhone}` giữ chuỗi đã nhập (kể cả rỗng, EJS escape), `selectedTimes` chỉ còn các ô AVAILABLE được phép chọn, `unavailableSelections:[{time,endTime,status}]` nêu ô bị loại, `recoveryUrl` và header `Content-Location` cùng trỏ GET `/courts/:id?date=...`. Summary/giá lấy từ lịch mới, không dùng giá client.

JavaScript gửi bằng fetch cùng origin, thay nội dung form lỗi và giữ history ở URL GET; reload không tự POST lại, gửi lại phải do người dùng chủ động. Thành công vẫn theo redirect 303 của backend đến checkout. Mất mạng/phản hồi bất thường báo kết quả chưa xác nhận và đưa link tải lại lịch GET; không tự thử lại. Không có fetch/DOMParser thì dùng POST HTML thông thường, giữ 400/409 và dữ liệu; trình duyệt có thể hỏi xác nhận gửi lại khi reload trang POST. Không lưu dữ liệu form vào localStorage/sessionStorage. ID/ngày không an toàn, CSRF 403, sân mất/ngừng 404 và lỗi server giữ xử lý lỗi riêng; lỗi đọc lịch không bị đổi thành lịch rỗng.

Owner: GET /owner (view owner-dashboard: facility|null,courts,bookings,requests,title,errorMessage; owner pending dùng view owner-pending:title). GET /owner/courts/new và GET /owner/courts/:id/edit (view owner-court-form: court|null,facility,title,errorMessage). POST /owner/courts tạo; POST /owner/courts/:id cập nhật các giá/giờ whitelist. POST /owner/requests/:id/approve body refundAmount,ownerNote,extraPaymentConfirmed; POST /owner/requests/:id/reject body ownerNote; POST /owner/requests/:id/refund body ownerNote; POST /owner/bookings/:id/cancel body refundAmount,ownerNote.

Admin: GET /admin (view admin-dashboard: applications,facilities,owners,title,errorMessage). POST /admin/owners/:id/approve body facilityId optional (cấp cơ sở chưa có owner; nếu trống tạo theo đề nghị). POST /admin/owners/:id/reject.

Errors: dùng views/error.ejs title,message,backUrl. Controller không trả rawerror/dbconnection. HTTP400 input,403 quyền/CSRF,404 missing,409 tranh chấp/trạng thái,410 hết hạn. Success303.

## Service exports cho agent phối hợp

domain/booking-rules.js exports makeSlots(court,date,locks=[],now=new Date()), quoteSelection(court,date,times,locks=[],now), vietnamDate(now), slotInstant(date,time), holdExpiresAt(createdAt,slots=[]), effectiveHoldExpiresAt(booking), validateDate(date); holdExpiresAt nhận slots có startAt UTC để lấy hạn sớm nhất, effectiveHoldExpiresAt giữ mốc sớm nhất từ hạn đã lưu, createdAt+10 phút và các ô của HOLD cũ, không tự gia hạn. makeSlots theo peakEndTime; fallback giá Court cũ=pricePerHour/2. Reuse pure rules từ repo gốc có điều chỉnh. utils/booking-time.js giữ formatMoney/formatDate cũ và reexport/helper phù hợp.

services/booking.service.js exports getAvailability(courtId,date), createHold({courtId,date,times,guestName,guestPhone,user}), getBookingForViewer(id,{user,token}), simulatePayment(id,{user,token}), expireHolds(), createChangeRequest(id,user,body), approveRequest(requestId,owner,body), rejectRequest(requestId,owner,body), recordRefund(requestId,owner,body), cancelByOwner(bookingId,owner,body). Agent booking sở hữu service/controllers/routes và báo nếu cần đổi hợp đồng. user là object {_id,role,ownerStatus,...}. getBookingForViewer trả populated Booking plain object.

Migration: scripts/chuyen-du-lieu-v2.js mặc định dry-run, --apply rõ ràng; không tự chạy trên Atlas. Backfill user CUSTOMER, Court giá/giờ; Booking cũ →2ô giữ _id/user/tổng tiền/trạng tháiLEGACY_RESERVED,UNPAID + SlotLock; xử lý index cũ {court,date,startHour} để newslotsdocs không va null; không xóa booking. Không tự seed lại. scripts/cap-quyen-admin.js --email existingemail cấp ADMIN, không hardcode mật khẩu. Seed chỉ upsert mẫu 1cơ sở/2sân không tài khoản.
