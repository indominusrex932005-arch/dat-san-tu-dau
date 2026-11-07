export function coverImage(entity) {
  const images = (entity?.images || []).filter(image => /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(image.url));
  const image = images.find(item => item.id === entity.coverImageId) || images[0];
  if (image) return { ...image, illustration: false };
  const theme = entity?.illustrationIndex;
  const number = Number.isInteger(theme) && theme >= 1 && theme <= 4 ? theme : (parseInt(String(entity?._id || '0').slice(-2), 16) || 0) % 4 + 1;
  return { url: `/assets/images/court-${number}.svg`, illustration: true };
}
