import {
  appendPaymentReview, getPaymentReceipt, listPaymentReceipts
} from '../services/payment-reconciliation.service.js';

const statusLabels = {
  UNCLASSIFIED: 'Chờ phân loại', PENDING: 'Chờ đối soát', REVIEWED: 'Đã rà soát',
  PARTIALLY_REFUNDED: 'Đã ghi nhận hoàn một phần', REFUNDED: 'Đã ghi nhận hoàn toàn bộ'
};
const flagLabels = {
  UNMATCHED: 'Chưa khớp đơn', WRONG_REFERENCE: 'Sai mã tham chiếu', RECIPIENT_MISMATCH: 'Sai thông tin người nhận',
  UNDERPAID: 'Thiếu tiền', OVERPAID: 'Thừa tiền', LATE: 'Quá hạn giữ sân',
  INVALID_DEADLINE: 'Cần kiểm tra hạn giữ sân', UNALLOCATED: 'Khoản nhận chưa phân bổ vào đơn'
};

function page(req, res, locals) {
  return res.render('payment-reconciliation', {
    title: 'Đối soát QR thử nghiệm', baseUrl: req.baseUrl,
    dashboardUrl: req.currentUser.role === 'ADMIN' ? '/admin' : '/owner',
    statusLabels, flagLabels, ...locals
  });
}

export async function listReceipts(req, res) {
  const { items, next } = await listPaymentReceipts(req.currentUser, req.query.before);
  return page(req, res, { items, next, receipt: null });
}

export async function showReceiptReview(req, res) {
  return page(req, res, { receipt: await getPaymentReceipt(req.params.id, req.currentUser) });
}

export async function recordReview(req, res) {
  await appendPaymentReview(req.params.id, req.currentUser, req.body);
  return res.redirect(303, `${req.baseUrl}/${req.params.id}`);
}
