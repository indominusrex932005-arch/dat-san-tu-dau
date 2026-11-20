(() => {
  const STORAGE_KEY = 'site-lang';
  const root = document.documentElement;
  const langBtn = document.querySelector('#site-lang-toggle');
  const langCodeEl = langBtn?.querySelector('[data-lang-code]');
  const langOptions = [...document.querySelectorAll('[data-lang-choice]')];

  const EXACT = {
    // Header, navigation & common dialogs
    'Đến nội dung chính': 'Skip to main content',
    'Đến danh sách sân': 'Skip to court list',
    'Đến nội dung đăng nhập': 'Skip to sign-in form',
    'Trang chủ': 'Home',
    'Về trang chủ': 'Back to Home',
    'Trở về trang chủ': 'Return to Home',
    'Cơ sở': 'Facilities',
    'Thuê sân riêng': 'Book a Court',
    'Sân ghép': 'Open Matches',
    'Đăng nhập': 'Sign In',
    'Đăng ký khách': 'Sign Up',
    'Dành cho chủ sân': 'For Court Owners',
    'Quản lý cơ sở': 'Manage Facility',
    'Lịch điều hành': 'Operations Calendar',
    'Lịch điều hành sân': 'Court Operations Calendar',
    'Quản trị': 'Admin',
    'Quản trị hệ thống': 'System Admin',
    'Xem sân': 'View Courts',
    'Thông tin tài khoản': 'Account Settings',
    'Đơn đặt sân của tôi': 'My Bookings',
    'Đơn đặt của tôi': 'My Bookings',
    'Đơn của tôi': 'My Bookings',
    'Lịch sử đặt sân': 'My Bookings',
    'Đăng xuất': 'Sign Out',
    'Đăng xuất tài khoản': 'Sign Out',
    'Khách hàng': 'Customer',
    'Chủ sân': 'Court Owner',
    'Chủ sân (chờ duyệt)': 'Owner (Pending)',
    'Quản trị viên': 'Administrator',
    'Sáng': 'Light',
    'Tối': 'Dark',
    'Theo hệ thống': 'System',
    'Xác nhận thao tác': 'Confirm Action',
    'Quay lại': 'Cancel',
    'Xác nhận': 'Confirm',
    'Đóng': 'Close',
    'Chọn ngày chơi': 'Choose Play Date',
    'Chọn giờ': 'Choose Time',
    'Hiện': 'Show',
    'Ẩn': 'Hide',

    // Home page
    'Đặt sân thể thao nhanh gọn, minh bạch.': 'Book sports courts fast and transparently.',
    'Khám phá các cơ sở thể thao, tìm địa điểm phù hợp và lên kế hoạch cho buổi chơi tiếp theo của bạn.': 'Explore sports venues, check real-time court availability, and plan your next game.',
    'Tất cả cơ sở': 'All facilities',
    '-- Tất cả cơ sở --': '-- All facilities --',
    'Ngày chơi': 'Play date',
    'Ngày': 'Date',
    'Tìm sân trống': 'Find Courts',
    'Lịch sân trực tiếp': 'Live Court Schedule',
    'Xem chi tiết': 'View details',
    'Trống': 'Available',
    'Đang chọn': 'Selected',
    'Đang giữ': 'Held',
    'Đã đặt': 'Booked',
    'Quá giờ': 'Passed',
    'Đã qua giờ': 'Passed',
    'Chọn các ô trống để đặt nhanh': 'Select open slots to book fast',
    'Đặt sân ngay →': 'Book now →',
    'Đang tải lịch sân…': 'Loading schedule…',
    'Không có ô giờ nào cho ngày này.': 'No time slots for this date.',
    'Ngày này đã hết ô trống. Hãy thử chọn ngày hoặc sân khác.': 'No open slots left today. Try another date or court.',
    'Cơ sở chưa mở nhận đơn mới': 'Venue not accepting bookings yet',
    'Cơ sở đang chờ cập nhật chủ sân hoặc số điện thoại.': 'Facility is awaiting owner approval or contact phone.',
    'Cơ sở thể thao': 'Sports Facilities',
    'Không gian thể thao': 'Sports Venue',
    'Khám phá sân': 'Explore courts',
    'Chưa có cơ sở để hiển thị.': 'No facilities to display yet.',
    'QUY TRÌNH 4 BƯỚC': '4-STEP PROCESS',
    'Cách đặt sân trên SanXanh': 'How to Book on SanXanh',
    'Từ lúc chọn khung giờ đến khi cầm phiếu ra sân — rõ giá từng ô, không trùng lịch, hỗ trợ cả khách vãng lai lẫn tài khoản thành viên.': 'From picking slots to walking onto the court — transparent per-slot pricing, zero double-bookings, for both guests and members.',
    'Chọn sân ngay': 'Pick a court',
    'Chọn sân & ô 30 phút': 'Pick Court & 30-Min Slots',
    'Xem lịch trống theo ngày thực tế, chọn một hoặc nhiều ô 30 phút (kể cả các ô rời nhau) với giá thường và cao điểm hiển thị rõ.': 'View live availability by date and choose one or multiple 30-minute slots (even non-consecutive) with clear standard and peak pricing.',
    'Giữ chỗ trong 10 phút': '10-Minute Instant Hold',
    'Đặt bằng tài khoản để quản lý đơn, hoặc đặt vãng lai chỉ cần họ tên và SĐT. Hệ thống khóa toàn bộ ô đã chọn trong tối đa 10 phút.': 'Book with an account to manage orders, or book as a guest with just your name and phone. All chosen slots are held for up to 10 minutes.',
    'Xác nhận & thanh toán': 'Confirm & Pay',
    'Kiểm tra lại chi tiết đơn, mã QR và hoàn tất xác nhận trước khi hết hạn giữ chỗ. Có thể tạo thêm': 'Review your booking details and QR code before the hold expires. You can also open an',
    'để rủ bạn chia tiền.': 'to invite players and split costs.',
    'Lưu phiếu & ra sân': 'Save Receipt & Play',
    'Lưu đường dẫn hoặc in phiếu PDF để check-in tại cơ sở. Thành viên có thể gửi yêu cầu hủy/đổi ngay trong mục': 'Save your receipt link or print a PDF to check in at the venue. Members can request cancellations or reschedules in',

    // Facilities page
    'Danh sách cơ sở': 'All Facilities',
    'Xem địa chỉ và các sân đang nhận đặt tại từng cơ sở.': 'View addresses and bookable courts at each facility.',
    'cơ sở trong hệ thống': 'facilities available',
    'Chưa có cơ sở nào.': 'No facilities yet.',
    'Thông tin cơ sở sẽ xuất hiện tại đây khi được cập nhật vào hệ thống. Bạn có thể ghé lại sau để khám phá các địa điểm thể thao.': 'Facility listings will appear here once added to the system.',
    'Địa chỉ': 'Address',
    'Xem cơ sở': 'View Facilities',

    // Courts listing & search
    'Chọn nhiều ô 30 phút, kể cả các ô không liền nhau. Đăng nhập hoặc đặt vãng lai đều được.': 'Pick multiple 30-minute slots, even non-consecutive. Sign in or book as a guest.',
    'sân trong danh sách': 'courts listed',
    'Tìm sân phù hợp': 'Find a Court',
    'Từ giờ': 'From',
    'Đến giờ': 'To',
    'Chọn ngày và cả hai mốc giờ (bước 30 phút) nếu muốn tìm sân còn trống liên tục trong khoảng giờ đó.': 'Select a date and both start/end times (30-min steps) to find continuously open courts.',
    'Tìm sân': 'Search Courts',
    'Xóa bộ lọc': 'Clear Filters',
    'Không tìm được sân phù hợp bộ lọc.': 'No courts match your filters.',
    'Không có sân nào thỏa mãn tất cả tiêu chí bạn đã chọn. Bạn hãy thử chọn cơ sở khác, đổi ngày hoặc nới rộng khoảng giờ tìm kiếm.': 'Try another facility, date, or a wider time range.',
    'Xóa bộ lọc về danh sách sân': 'Reset filters to all courts',
    'Chưa có sân đang hoạt động.': 'No active courts yet.',
    'Bạn có thể xem các cơ sở hoặc quay lại danh sách sân sau.': 'Explore facilities or check back later.',
    'Mở cửa': 'Open',
    'Giá thường / 30 phút': 'Standard / 30 min',
    'Cao điểm / 30 phút': 'Peak / 30 min',
    'Đang chờ cấp chủ sân hoặc số liên hệ.': 'Awaiting owner approval or contact phone.',
    'Xem giờ và đặt sân': 'View Schedule & Book',

    // Court detail
    '← Danh sách sân': '← Back to courts',
    'Danh sách sân': 'Courts',
    'Xem lại lịch sân': 'Back to court schedule',
    'Danh sách đối soát': 'Reconciliation List',
    'Trang quản lý': 'Dashboard',
    '1. Chọn ô': '1. Pick slots',
    '2. Giữ chỗ / thanh toán': '2. Hold / Pay',
    '3. Lưu phiếu': '3. Save receipt',
    'Xem lịch': 'View schedule',
    '30 phút / ô': '30 min / slot',
    'Buổi sáng': 'Morning',
    'Buổi chiều': 'Afternoon',
    'Buổi tối': 'Evening',
    '○ Trống': '○ Open',
    '◷ Đang giữ': '◷ Held',
    '✓ Đã đặt': '✓ Booked',
    '— Không phục vụ': '— Unavailable',
    'Đang giữ chỗ': 'Held',
    'Không phục vụ': 'Unavailable',
    'Đã phục vụ': 'Served',
    'Ngày này không còn ô trống. Bạn hãy chọn ngày khác.': 'No open slots left on this date. Please choose another date.',
    'Giữ các ô đã chọn': 'Hold Selected Slots',
    'Bạn muốn chơi theo cách nào?': 'How would you like to play?',
    'Tạo sân ghép, rủ bạn chia tiền': 'Create open match & split cost',
    'Đăng nhập để mở sân ghép →': 'Sign in to create an open match →',
    'Chưa chọn ô giờ.': 'No slots selected.',
    'Họ và tên': 'Full Name',
    'Họ tên': 'Full Name',
    'Số điện thoại': 'Phone Number',
    'Số điện thoại (không bắt buộc)': 'Phone Number (optional)',
    'Giữ chỗ tối đa 10 phút': 'Hold Slots (up to 10 min)',
    'Đang kiểm tra và giữ ô…': 'Checking & holding slots…',
    'Bấm “Xem lịch” để áp dụng ngày mới.': 'Click “View schedule” to apply the new date.',
    'Giá cuối cùng do server tính lại. Chỉ giữ các ô bạn chọn tối đa 10 phút, trước khi ô đầu tiên bắt đầu; hết hạn chưa xác nhận, các ô được mở lại.': 'Final price is calculated on the server. Slots are held for up to 10 minutes before the first slot starts.',
    'Tiếp tục': 'Continue',

    // Checkout & Receipt
    'GIỮ CHỖ / THANH TOÁN': 'HOLD / CHECKOUT',
    'BẢN DEMO — Chỉ dùng dữ liệu và tài khoản thử. Thanh toán được mô phỏng, không chuyển hoặc nhận tiền thật.': 'DEMO MODE — Synthetic test data only. Payments are simulated; no real money is transferred.',
    'Bạn muốn tiếp tục thế nào?': 'How would you like to continue?',
    'Nếu tiếp tục với tư cách khách vãng lai, bạn cần gọi cơ sở để hủy hoặc đổi lịch.': 'If you continue as a guest, you will need to call the facility to cancel or reschedule.',
    'Đăng nhập để quản lý đơn': 'Sign in to manage booking',
    'Tiếp tục với tư cách khách vãng lai': 'Continue as guest',
    'Đã hết hạn giữ chỗ. Hãy chọn lại ô giờ.': 'Your hold has expired. Please select slots again.',
    'Người chơi': 'Player',
    'SĐT người chơi': 'Player Phone',
    'Sân': 'Court',
    'Trạng thái': 'Status',
    'Thanh toán': 'Payment',
    'Tổng số tiền (100%)': 'Total Amount (100%)',
    'Tổng giá đơn': 'Order Total',
    'Giá từng ô đã được lưu vào đơn. Không có bước đặt cọc.': 'Per-slot prices are locked in your order. No deposit step.',
    'Chỗ đang được giữ': 'Slots Held',
    'Đang tính thời gian còn lại…': 'Calculating time remaining…',
    'Giữ chỗ tối đa 10 phút, trước khi ô đầu tiên bắt đầu. Đồng hồ dùng thời hạn máy chủ trả về; máy chủ kiểm tra lại khi thanh toán.': 'Held for up to 10 minutes before the first slot starts. Verified by server time.',
    'Thử nghiệm Sandbox': 'Sandbox Test',
    'Thanh toán thử': 'Test Payment',
    'Kiểm tra đúng người nhận và tổng tiền trước khi tiếp tục.': 'Verify the recipient and total amount before proceeding.',
    'Đang đọc trạng thái từ máy chủ…': 'Reading status from server…',
    'Chưa có yêu cầu thanh toán thử. Bấm tạo yêu cầu khi bạn sẵn sàng.': 'No test payment request yet. Click create when ready.',
    'Đang chờ máy chủ xác nhận thanh toán thử.': 'Waiting for server payment confirmation.',
    'Người nhận': 'Recipient',
    'Tổng thanh toán': 'Total Due',
    'Tổng thanh toán:': 'Total Due:',
    'Mã thanh toán': 'Payment Ref',
    'Tạo yêu cầu thanh toán thử': 'Create Test Payment QR',
    'Kiểm tra thanh toán': 'Check Payment Status',
    'Mở trang thanh toán thử': 'Open Test Payment Page',
    'Nếu đã thanh toán nhưng trạng thái chưa cập nhật hoặc đã hết hạn, hãy liên hệ cơ sở và cung cấp mã đơn.': 'If you already paid and status has not updated, contact the venue with your booking code.',
    'Ảnh QR chỉ minh họa — không quét hoặc chuyển tiền. Chưa kết nối ngân hàng và chưa xác minh tiền thật.': 'Illustrative QR only — do not scan or transfer money. No real bank connection.',
    'Mô phỏng thanh toán toàn bộ': 'Simulate Full Payment',
    'Chỉ dùng để trình bày. Phiếu sau bước này được ghi rõ là thanh toán mô phỏng.': 'For demonstration only. The receipt will be clearly labeled as simulated payment.',
    'Thanh toán trực tuyến đang tắt. Hãy liên hệ cơ sở để xác nhận lịch. Các ô sẽ mở lại khi hết hạn giữ.': 'Online payment is disabled. Contact the facility to confirm; slots release when hold expires.',
    'Hủy giữ chỗ (nhả sân ngay)': 'Cancel Hold (Release Slots)',
    'Hủy giữ chỗ': 'Cancel Hold',
    'Liên hệ cơ sở': 'Contact Facility',
    'Chỉ đường': 'Directions',
    'Chưa có số liên hệ.': 'No contact phone yet.',
    'Khách vãng lai liên hệ chủ sân khi cần hủy/đổi. Hãy lưu phiếu và đường dẫn đơn của bạn.': 'Guests should contact the facility owner for changes. Save your receipt link.',
    'Xem thông tin / phiếu': 'View Booking / Receipt',
    '← Xem lại lịch sân': '← Back to court schedule',
    'In / Lưu PDF': 'Print / Save PDF',
    'Phiếu thông tin đặt sân': 'Booking Receipt',
    'Mã đơn:': 'Booking Code:',
    'Mã đặt sân': 'Booking Code',
    'Các ô đã chọn': 'Selected Slots',
    'Điện thoại cơ sở:': 'Facility Phone:',
    'THANH TOÁN MÔ PHỎNG — Phiếu dùng để trình bày, chưa xác minh giao dịch ngân hàng hoặc nhận tiền thật.': 'SIMULATED PAYMENT — Demonstration receipt only; no real bank transfer verified.',
    'Chủ sân đối chiếu đơn trên hệ thống. Phiếu hoặc ảnh chụp không thay thế việc xác minh tiền.': 'Facility owners verify bookings in the system. Screenshots do not replace payment verification.',
    'Rủ bạn chia tiền sân': 'Invite Friends to Split Cost',
    'Đổi giờ / sân': 'Reschedule',
    'Gửi yêu cầu hủy đơn': 'Request Cancellation',
    'Hủy đơn': 'Cancel Booking',
    'Tiếp tục xem giữ chỗ': 'Return to Checkout',
    'Chọn “In / Lưu PDF”, rồi chọn “Lưu dưới dạng PDF” trong hộp thoại của trình duyệt.': 'Click “Print / Save PDF”, then choose “Save as PDF” in your browser dialog.',
    'Đã xác nhận': 'Confirmed',
    'Đã hết hạn': 'Expired',
    'Đã hủy': 'Cancelled',
    'Thanh toán mô phỏng': 'Simulated Payment',
    'Chưa ghi nhận thanh toán': 'Unpaid',
    'Đã ghi nhận thanh toán': 'Paid',

    // My bookings
    'Cần gửi yêu cầu trước ô đầu tiên ít nhất 36 giờ. Xem phiếu và theo dõi yêu cầu hủy/đổi của các đơn thuộc tài khoản này.': 'Requests must be submitted at least 36 hours before the first slot. View receipts and track requests here.',
    'Rủ bạn cùng chơi': 'Create Open Match',
    'Bạn chưa có lượt đặt sân nào.': 'You have no bookings yet.',
    'Chọn sân để đặt': 'Browse Courts',
    'Trạng thái thanh toán:': 'Payment status:',
    'Thanh toán mô phỏng, chưa xác minh tiền ngân hàng.': 'Simulated payment; no bank transfer verified.',
    'Xem giữ chỗ': 'View Hold',
    'Xem / lưu phiếu': 'View / Save Receipt',
    'Đã check-in — không thể hủy/đổi.': 'Checked in — cannot cancel or reschedule.',
    'Đã qua hạn gửi yêu cầu tự động (trước 36 giờ) — vui lòng liên hệ trực tiếp cơ sở nếu cần hủy/đổi.': 'Past the 36-hour online request window — please contact the facility directly.',
    'Chờ chủ sân xử lý': 'Pending owner review',
    'Chủ sân đã đồng ý': 'Approved by owner',
    'Chủ sân đã từ chối': 'Rejected by owner',
    '← Trang trước': '← Previous',
    'Trang sau →': 'Next →',

    // Play groups
    'Chọn buổi chơi hợp lịch, làm quen với bạn mới và cùng chia tiền sân.': 'Join a session that fits your schedule, meet players, and split court costs.',
    'Tất cả buổi chơi': 'All Matches',
    'Buổi tôi tham gia': 'My Matches',
    'Tìm theo tên buổi, cơ sở, sân…': 'Search by match title, facility, court…',
    'Chỉ hiện buổi còn chỗ': 'Open spots only',
    'Lọc': 'Filter',
    'Xóa lọc': 'Clear',
    'Không tìm thấy buổi chơi phù hợp': 'No matching open sessions',
    'Thử đổi ngày, từ khóa hoặc bỏ lọc chỗ trống.': 'Try changing the date, keyword, or filter.',
    'Bạn chưa tham gia buổi sân ghép nào': 'You have not joined any open matches yet',
    'Xem tất cả buổi chơi': 'View all matches',
    'Chưa có buổi sân ghép': 'No open matches yet',
    'Bạn có thể tạo buổi từ đơn đã xác nhận rồi gửi đường dẫn cho bạn bè.': 'Create a match from a confirmed booking and share the link with friends.',
    'Đang tìm bạn': 'Open',
    'Đủ người': 'Full',
    'Đã chốt nhóm': 'Locked',
    'Đã kết thúc': 'Ended',
    'Xem buổi chơi →': 'View match →',

    // Login & Register
    'Quản lý lượt đặt sân': 'Manage Your Bookings',
    'Xem phiếu đặt sân và theo dõi yêu cầu hủy hoặc đổi lịch trong tài khoản.': 'View receipts and track cancellation or reschedule requests from your account.',
    'Dùng tài khoản của bạn để xem đơn hoặc quản lý cơ sở.': 'Sign in to manage your bookings or sports facility.',
    'Không thể đăng nhập': 'Unable to sign in',
    'Email bạn đã dùng khi đăng ký tài khoản.': 'The email address used when creating your account.',
    'Mật khẩu': 'Password',
    'Quên mật khẩu?': 'Forgot password?',
    'Chưa có tài khoản?': 'New to SanXanh?',
    'hoặc': 'or',
    'đăng ký chủ sân': 'register as a court owner',
    'Bạn có thể': 'You can also',
    'tiếp tục đặt sân không cần đăng nhập': 'book a court without signing in',
    'TẠO TÀI KHOẢN': 'CREATE ACCOUNT',
    'Đăng ký chủ sân': 'Court Owner Sign Up',
    'Khách đặt sân': 'Customer',
    'Tài khoản cần được quản trị viên duyệt và cấp cơ sở. Bạn chỉ quản lý sân sau khi được duyệt.': 'Owner accounts require admin approval and facility assignment before managing courts.',
    'Xem lịch sử, lưu phiếu và gửi yêu cầu hủy/đổi cho chủ sân từ tài khoản của bạn.': 'Track history, save receipts, and send cancel/reschedule requests from your account.',
    '10 chữ số Việt Nam, bắt đầu bằng 0 hoặc +84.': '10-digit Vietnamese phone number (starts with 0 or +84).',
    'Tên cơ sở muốn quản lý': 'Facility Name',
    'Địa chỉ cơ sở': 'Facility Address',
    'Ít nhất 8 ký tự, không quá 72 byte.': 'At least 8 characters, max 72 bytes.',
    'Nhập lại mật khẩu': 'Confirm Password',
    'Gửi đăng ký chủ sân': 'Submit Owner Registration',
    'Tạo tài khoản khách': 'Create Customer Account',
    'Đã có tài khoản?': 'Already have an account?',
    'Bạn cũng có thể': 'You can also',
    'đặt sân không cần tài khoản': 'book without an account',

    // Account page
    'TÀI KHOẢN CÁ NHÂN': 'PERSONAL ACCOUNT',
    'Thông tin cá nhân': 'Personal Information',
    'Thông tin này sẽ được điền sẵn khi bạn giữ chỗ đặt sân.': 'These details will be pre-filled when you book a court.',
    'Email đăng nhập': 'Login Email',
    'Email dùng để đăng nhập và nhận thông báo, không thể tự thay đổi.': 'Used for login and notifications; cannot be changed here.',
    'Số điện thoại Việt Nam gồm 10 chữ số (bắt đầu bằng 0 hoặc +84).': '10-digit Vietnamese phone number (starting with 0 or +84).',
    'Ví dụ: 0901234567': 'e.g. 0901234567',
    'VD: 0901234567': 'e.g. 0901234567',
    'Lưu thay đổi': 'Save Changes',
    'Đổi mật khẩu': 'Change Password',
    'Dùng mật khẩu từ 8 ký tự trở lên để bảo vệ tài khoản của bạn.': 'Use at least 8 characters to keep your account secure.',
    'Mật khẩu hiện tại': 'Current Password',
    'Mật khẩu mới': 'New Password',
    'Nhập lại mật khẩu mới': 'Confirm New Password',
    'Cập nhật mật khẩu': 'Update Password',
    'Đã cập nhật thông tin tài khoản.': 'Account profile updated.',
    'Đã đổi mật khẩu thành công.': 'Password updated successfully.',

    // Footer
    'Nền tảng đặt sân thể thao theo ô 30 phút — hiển thị lịch trống thực tế, giữ chỗ minh bạch và kết nối người chơi sân ghép.': '30-minute slot sports booking platform — live court availability, transparent holds, and community open matches.',
    'Việt Nam (UTC+7)': 'Vietnam (UTC+7)',
    'Ô 30 phút linh hoạt': 'Flexible 30-min slots',
    'Phiếu đặt sân PDF': 'PDF Booking Receipt',
    'Khám phá': 'Explore',
    'Sân ghép tìm bạn': 'Open Matches',
    'Hướng dẫn đặt sân': 'How to Book',
    'Tài khoản & Đối tác': 'Account & Partners',
    'Buổi sân ghép của tôi': 'My Open Matches',
    'Đăng ký khách đặt sân': 'Customer Sign Up',
    'Đăng ký mở cơ sở / chủ sân': 'Register as Court Owner',
    'Quên mật khẩu': 'Forgot Password',
    'Quy định & Hỗ trợ': 'Policies & Support',
    'Giữ chỗ tối đa 10 phút, kết thúc trước giờ bắt đầu ô đầu tiên.': 'Slots are held for up to 10 minutes, ending before the first slot starts.',
    'Yêu cầu hủy hoặc đổi lịch gửi trước giờ chơi tối thiểu 36 giờ.': 'Cancellation or reschedule requests must be sent at least 36 hours before play.',
    'Khách vãng lai lưu đường dẫn phiếu và gọi trực tiếp số cơ sở khi cần hủy/đổi.': 'Guests should save their receipt link and call the venue directly for changes.',
    'Chế độ thanh toán:': 'Payment mode:',
    'Mô phỏng / Sandbox': 'Demo / Sandbox',
    'Chưa mở trực tuyến': 'Online payment disabled',
    '© 2026 SanXanh. Mọi quyền được bảo lưu.': '© 2026 SanXanh. All rights reserved.',
    'Nền tảng đặt sân thể thao trực tuyến · Hỗ trợ đặt vãng lai & thành viên': 'Online sports court booking platform · Guest & member booking supported'
  };

  const PATTERNS = [
    [/^Ô 30 phút · (.+)$/, '30-min slots · $1'],
    [/^(\d+) ô \((\d+) phút\) · (.+)$/, '$1 slots ($2 min) · $3'],
    [/^(\d+) ô · (\d+) phút$/, '$1 slots · $2 min'],
    [/^Khung giờ đặt \((\d+) ô\)$/, 'Booked slots ($1)'],
    [/^Còn <1p$/, '<1m left'],
    [/^Còn (\d+)p$/, '$1m left'],
    [/^(.+) · Còn (\d+)p$/, '$1 · $2m left'],
    [/^(.+) · Còn <1p$/, '$1 · <1m left'],
    [/^Lịch ngày (\d{2}\/\d{2}\/\d{4})$/, 'Schedule for $1'],
    [/^Kiểm tra đơn (.+)$/, 'Review Booking $1'],
    [/^Mở cửa (\d{2}:\d{2}–\d{2}:\d{2}), theo giờ Việt Nam\. Bạn được chọn các ô rời nhau\.$/, 'Open $1 (Vietnam time). Non-consecutive slots are supported.'],
    [/^Cao điểm (\d{2}:\d{2}–\d{2}:\d{2})$/, 'Peak hours $1'],
    [/^Hạn giữ: (\d{2}:\d{2}) \(giờ Việt Nam\)\. Thời hạn được máy chủ kiểm tra\.$/, 'Hold expires at $1 (Vietnam time), verified by server.'],
    [/^(\d+) đơn đặt sân$/, '$1 bookings'],
    [/^Tham gia (\d{2}\/\d{2}\/\d{4})$/, 'Joined $1'],
    [/^Gọi (.+)$/, 'Call $1'],
    [/^(\d{2}:\d{2}) còn lại$/, '$1 remaining'],
    [/^(\d+)\/(\d+) người$/, '$1/$2 players'],
    [/^\/người · (tạm tính|xấp xỉ)$/, '/player · est.'],
    [/^Trang (\d+)\/(\d+) · (\d+) đơn$/, 'Page $1/$2 · $3 bookings'],
    [/^Yêu cầu (đổi lịch \/ sân|hủy đơn)$/, (_, kind) => (kind === 'hủy đơn' ? 'Cancellation Request' : 'Reschedule Request')],
    [/^Bạn muốn đăng xuất khỏi tài khoản (.+)\?$/, 'Sign out of $1?'],
    [/^Ô (.+) vừa qua giờ đặt và đã được bỏ chọn\.$/, 'Slot $1 just passed and was deselected.']
  ];

  const origText = new WeakMap();
  const origAttr = new WeakMap();
  let currentLang = 'vi';
  let applying = false;

  function translateString(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return raw;
    const start = raw.indexOf(trimmed);
    const lead = raw.slice(0, start);
    const trail = raw.slice(start + trimmed.length);
    if (Object.hasOwn(EXACT, trimmed)) return lead + EXACT[trimmed] + trail;
    for (const [regex, replacement] of PATTERNS) {
      if (regex.test(trimmed)) return lead + trimmed.replace(regex, replacement) + trail;
    }
    return raw;
  }

  function translateSubtree(container, lang) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA'].includes(parent.tagName)) continue;
      if (parent.closest('#site-lang-menu') || parent.closest('[data-lang-code]')) continue;
      if (!origText.has(node)) {
        origText.set(node, node.nodeValue);
      } else if (lang === 'en') {
        const prev = origText.get(node);
        const translatedPrev = translateString(prev);
        if (node.nodeValue !== translatedPrev && node.nodeValue !== prev) {
          origText.set(node, node.nodeValue);
        }
      }
      const base = origText.get(node);
      const target = lang === 'en' ? translateString(base) : base;
      if (node.nodeValue !== target) node.nodeValue = target;
    }

    if (container instanceof Element || container === document.body) {
      for (const el of container.querySelectorAll('[placeholder]')) {
        if (!origAttr.has(el)) origAttr.set(el, el.getAttribute('placeholder'));
        const base = origAttr.get(el);
        const target = lang === 'en' ? translateString(base) : base;
        if (el.getAttribute('placeholder') !== target) el.setAttribute('placeholder', target);
      }
    }
  }

  const origTitle = document.title;

  function storedLang() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === 'vi' || value === 'en') return value;
    } catch { /* ignore */ }
    return 'vi';
  }

  function applyLanguage(lang, persist = false) {
    const next = lang === 'en' ? 'en' : 'vi';
    currentLang = next;
    root.lang = next;
    root.dataset.lang = next;
    if (langCodeEl) langCodeEl.textContent = next.toUpperCase();
    for (const opt of langOptions) {
      const active = opt.dataset.langChoice === next;
      opt.classList.toggle('is-active', active);
      opt.setAttribute('aria-checked', String(active));
    }
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, next); }
      catch { /* ignore */ }
    }

    applying = true;
    try {
      document.title = next === 'en'
        ? origTitle.replace('Đặt sân thể thao trực tuyến', 'Online Sports Court Booking').replace(/^([^|]+)(\s*\|\s*SanXanh)$/, (_, head, tail) => translateString(head.trim()) + tail)
        : origTitle;
      translateSubtree(document.body, next);
    } finally {
      applying = false;
    }
  }

  let observerFrame = 0;
  const observer = new MutationObserver(() => {
    if (applying || currentLang !== 'en' || observerFrame) return;
    observerFrame = window.requestAnimationFrame(() => {
      observerFrame = 0;
      if (currentLang !== 'en') return;
      applying = true;
      try { translateSubtree(document.body, 'en'); }
      finally { applying = false; }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  window.addEventListener('site:set-lang', event => {
    applyLanguage(event.detail?.lang, true);
  });

  applyLanguage(storedLang(), false);
})();
