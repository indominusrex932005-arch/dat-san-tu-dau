import Facility from '../models/Facility.js';

export async function showFacilities(req, res) {
  const facilities = await Facility.find();

  res.render('facilities', {
    facilities: facilities
  });
}