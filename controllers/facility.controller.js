import { facilityCatalog } from '../services/facility-catalog.service.js';

export async function showFacilities(req, res) {
  const facilities = await facilityCatalog();

  res.render('facilities', {
    facilities: facilities
  });
}
