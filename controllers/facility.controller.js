import Facility from '../models/Facility.js';

export async function showFacilities(req, res) {
  const facilities = await Facility.find();

  res.render('facilities', {
    facilities: facilities
  });
}

export function showNewFacilityForm(req, res) {
  res.render('facility-new', {
    title: 'Thêm cơ sở mới',
    facility: {},
    errorMessage: null
  });
}

export async function createFacility(req, res) {
  const { name, address, phone } = req.body;

  if (!name || !name.trim() || !address || !address.trim()) {
    return res.status(400).render('facility-new', {
      title: 'Thêm cơ sở mới',
      facility: { name, address, phone },
      errorMessage: 'Tên cơ sở và địa chỉ là bắt buộc.'
    });
  }

  try {
    await Facility.create({
      name: name.trim(),
      address: address.trim(),
      phone: phone ? phone.trim() : undefined
    });

    res.redirect('/facilities');
  } catch (error) {
    console.error('Lỗi khi lưu cơ sở:', error);
    res.status(500).render('facility-new', {
      title: 'Thêm cơ sở mới',
      facility: { name, address, phone },
      errorMessage: 'Không thể lưu cơ sở do lỗi máy chủ.'
    });
  }
}

export async function showEditFacilityForm(req, res) {
  try {
    const facility = await Facility.findById(req.params.id);

    if (!facility) {
      return res.status(404).send('Không tìm thấy cơ sở.');
    }

    res.render('facility-edit', {
      title: 'Chỉnh sửa cơ sở',
      facility: facility,
      errorMessage: null
    });
  } catch (error) {
    console.error('Lỗi khi tải thông tin cơ sở:', error);
    res.status(500).send('Đã xảy ra lỗi máy chủ.');
  }
}

export async function updateFacility(req, res) {
  const { name, address, phone } = req.body;

  if (!name || !name.trim() || !address || !address.trim()) {
    return res.status(400).render('facility-edit', {
      title: 'Chỉnh sửa cơ sở',
      facility: { _id: req.params.id, name, address, phone },
      errorMessage: 'Tên cơ sở và địa chỉ là bắt buộc.'
    });
  }

  try {
    const updated = await Facility.findByIdAndUpdate(
      req.params.id,
      {
        name: name.trim(),
        address: address.trim(),
        phone: phone ? phone.trim() : undefined
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).send('Không tìm thấy cơ sở cần sửa.');
    }

    res.redirect('/facilities');
  } catch (error) {
    console.error('Lỗi khi cập nhật cơ sở:', error);
    res.status(500).render('facility-edit', {
      title: 'Chỉnh sửa cơ sở',
      facility: { _id: req.params.id, name, address, phone },
      errorMessage: 'Không thể cập nhật cơ sở do lỗi máy chủ.'
    });
  }
}