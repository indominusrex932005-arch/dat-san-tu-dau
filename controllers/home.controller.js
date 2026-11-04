import { facilityCatalog } from '../services/facility-catalog.service.js';

export async function showHome(req, res) {
  res.render('home', {
    title: 'Hệ thống quản lý đặt sân thể thao', facilities: await facilityCatalog()
  });
}
