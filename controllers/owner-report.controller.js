import { ownerDemoReport } from '../services/owner-report.service.js';

export async function showOwnerReport(req, res) {
  const report = await ownerDemoReport(req.currentUser, req.query);
  res.render('owner-report', { title: 'Báo cáo thu / hoàn mô phỏng', ...report });
}
