import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import Facility from '../models/Facility.js';
import Court from '../models/Court.js';

export const demoFacilities = [
  { key: 'demo-mvc', name: 'Cơ sở Demo MVC', address: 'Địa chỉ minh họa phục vụ bài nhóm', legacy: true },
  { key: 'hai-chau', name: 'Cơ sở mẫu Hải Châu', address: 'Khu vực Hải Châu, Đà Nẵng — địa chỉ minh họa' },
  { key: 'thanh-khe', name: 'Cơ sở mẫu Thanh Khê', address: 'Khu vực Thanh Khê, Đà Nẵng — địa chỉ minh họa' },
  { key: 'son-tra', name: 'Cơ sở mẫu Sơn Trà', address: 'Khu vực Sơn Trà, Đà Nẵng — địa chỉ minh họa' }
];

function stableId(key) {
  return new mongoose.Types.ObjectId(createHash('sha256').update(`dat-san:demo-facility:v1:${key}`).digest('hex').slice(0, 24));
}

export async function seedDemoFacilities() {
  const results = [];
  for (const sample of demoFacilities) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const id = stableId(sample.key);
        let facility = await Facility.findOne({ $or: [{ _id: id }, { name: sample.name }] }).session(session);
        if (!facility && sample.legacy) {
          facility = await Facility.findOne({ _id: { $nin: demoFacilities.filter(item => !item.legacy).map(item => stableId(item.key)) } })
            .sort({ createdAt: 1, _id: 1 }).session(session);
        }
        if (!facility && await Facility.countDocuments().session(session) >= 4) {
          session.seedResult = null;
          return;
        }
        const created = !facility;
        if (!facility) {
          const illustrationIndex = demoFacilities.indexOf(sample) + 1;
          facility = (await Facility.create([{ _id: id, name: sample.name, address: sample.address, phone: '', owner: null, illustrationIndex }], { session }))[0];
          for (const [name, basePriceVND, peakPriceVND] of [
            ['Sân cầu lông 1', 50000, 75000], ['Sân cầu lông 2', 60000, 90000]
          ]) {
            await Court.create([{ facility: facility._id, name, basePriceVND, peakPriceVND, illustrationIndex,
              openTime: '06:00', closeTime: '22:00', peakStartTime: '17:00', peakEndTime: '22:00', active: true }], { session });
          }
        }
        // The callback can be retried. Do not append to results until the transaction commits.
        session.seedResult = { name: facility.name, created };
      });
      if (session.seedResult) results.push(session.seedResult);
    } finally { await session.endSession(); }
  }
  return results;
}
