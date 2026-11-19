// Chuẩn EMVCo / VietQR (NAPAS247) sinh chuỗi payload chuyển khoản có số tiền và nội dung đối soát.
// Lưu ý: Tạo mã QR chỉ giúp khách quét đúng STK + số tiền + mã đơn; xác nhận tiền về vẫn phải qua webhook ngân hàng/cổng thanh toán.

function tlv(id, value) {
  const str = String(value);
  return `${id}${String(str.length).padStart(2, '0')}${str}`;
}

export function crc16CcittFalse(input) {
  let crc = 0xFFFF;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function buildVietQrPayload({ bankBin, accountNumber, amountVND, description }) {
  const cleanBin = String(bankBin ?? '').trim();
  const cleanAccount = String(accountNumber ?? '').trim();
  if (!/^\d{6}$/.test(cleanBin)) throw new Error('Mã BIN ngân hàng VietQR phải gồm 6 chữ số.');
  if (!/^[A-Za-z0-9]{4,32}$/.test(cleanAccount)) throw new Error('Số tài khoản ngân hàng không hợp lệ.');
  if (!Number.isSafeInteger(amountVND) || amountVND <= 0) throw new Error('Số tiền VND phải là số nguyên dương.');

  const safeDesc = String(description ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .trim()
    .slice(0, 50);

  // Field 38: NAPAS247 Consumer Presented / Merchant Account Information
  const beneficiary = tlv('00', cleanBin) + tlv('01', cleanAccount);
  const merchantAccount = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');

  const body = [
    tlv('00', '01'), // Payload Format Indicator
    tlv('01', '12'), // Dynamic QR (12 = one-time with amount)
    tlv('38', merchantAccount),
    tlv('53', '704'), // VND (ISO 4217)
    tlv('54', String(amountVND)),
    tlv('58', 'VN'),
    ...(safeDesc ? [tlv('62', tlv('08', safeDesc))] : []),
    '6304' // CRC tag + length
  ].join('');

  return body + crc16CcittFalse(body);
}
