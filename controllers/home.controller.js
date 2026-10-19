export function showHome(req, res) {
  res.render('home', {
    title: 'Hệ thống quản lý đặt sân thể thao'
  });
}