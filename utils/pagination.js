export const PAGE_SIZE = 20;
export function pageNumber(value) {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^[1-9]\d{0,5}$/.test(value)) {
    throw Object.assign(new Error('Số trang không hợp lệ.'), { status: 400 });
  }
  return Number(value);
}
export function pageInfo(requested, total) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, pages);
  return { page, pages, total, skip: (page - 1) * PAGE_SIZE };
}
