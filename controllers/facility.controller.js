import mongoose from 'mongoose';
import Facility from '../models/Facility.js';

function validateFacilityInput(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'Dữ liệu gửi lên không hợp lệ.' };
  }

  const { name, address, phone } = body;

  if (typeof name !== 'string' || !name.trim() || typeof address !== 'string' || !address.trim()) {
    return { error: 'Tên cơ sở và địa chỉ là bắt buộc.' };
  }

  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    return { error: 'Số điện thoại không hợp lệ.' };
  }

  return {
    data: {
      name: name.trim(),
      address: address.trim(),
      phone: typeof phone === 'string' ? phone.trim() : ''
    }
  };
}

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
  const validation = validateFacilityInput(req.body);

  if (validation.error) {
    return res.status(400).render('facility-new', {
      title: 'Thêm cơ sở mới',
      facility: {
        name: typeof req.body?.name === 'string' ? req.body.name : '',
        address: typeof req.body?.address === 'string' ? req.body.address : '',
        phone: typeof req.body?.phone === 'string' ? req.body.phone : ''
      },
      errorMessage: validation.error
    });
  }

  const { name, address, phone } = validation.data;

  try {
    await Facility.create({
      name,
      address,
      phone
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
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).send('Không tìm thấy cơ sở.');
  }

  try {
    const facility = await Facility.findById(id);

    if (!facility) {
      return res.status(404).send('Không tìm thấy cơ sở.');
    }

    res.render('facility-edit', {
      title: 'Chỉnh sửa cơ sở',
      facility: facility,
      errorMessage: null
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).send('Không tìm thấy cơ sở.');
    }
    console.error('Lỗi khi tải thông tin cơ sở:', error);
    res.status(500).send('Đã xảy ra lỗi máy chủ.');
  }
}

export async function updateFacility(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).send('Không tìm thấy cơ sở cần sửa.');
  }

  const validation = validateFacilityInput(req.body);

  if (validation.error) {
    return res.status(400).render('facility-edit', {
      title: 'Chỉnh sửa cơ sở',
      facility: {
        _id: id,
        name: typeof req.body?.name === 'string' ? req.body.name : '',
        address: typeof req.body?.address === 'string' ? req.body.address : '',
        phone: typeof req.body?.phone === 'string' ? req.body.phone : ''
      },
      errorMessage: validation.error
    });
  }

  const { name, address, phone } = validation.data;

  try {
    const updated = await Facility.findByIdAndUpdate(
      id,
      {
        name,
        address,
        phone
      },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updated) {
      return res.status(404).send('Không tìm thấy cơ sở cần sửa.');
    }

    res.redirect('/facilities');
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).send('Không tìm thấy cơ sở cần sửa.');
    }
    console.error('Lỗi khi cập nhật cơ sở:', error);
    res.status(500).render('facility-edit', {
      title: 'Chỉnh sửa cơ sở',
      facility: { _id: id, name, address, phone },
      errorMessage: 'Không thể cập nhật cơ sở do lỗi máy chủ.'
    });
  }
}