import Facility from '../models/Facility.js';
import Court from '../models/Court.js';
import { coverImage } from '../utils/images.js';

export async function facilityCatalog() {
  const facilities = await Facility.find().sort({ name: 1 }).lean();
  const courts = facilities.length ? await Court.find({
    facility: { $in: facilities.map(item => item._id) }, 'images.0': { $exists: true }
  }).select('facility images coverImageId').sort({ _id: 1 }).lean() : [];
  const firstCourt = new Map();
  for (const court of courts) if (!firstCourt.has(String(court.facility))) firstCourt.set(String(court.facility), court);
  return facilities.map(facility => ({ ...facility,
    displayImage: coverImage(facility.images?.length ? facility : firstCourt.get(String(facility._id)) || facility)
  }));
}
