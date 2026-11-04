document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.hasAttribute('data-media-fallback')) return;
  image.removeAttribute('data-media-fallback');
  image.src = '/assets/images/court-1.svg';
  image.alt = 'Minh họa không gian sân thể thao';
  const caption = image.closest('figure')?.querySelector('.media-illustration');
  if (caption) caption.hidden = false;
}, true);

for (const manager of document.querySelectorAll('[data-media-manager]')) {
  const form = manager.querySelector('[data-image-upload]');
  const status = manager.querySelector('[role="status"]');
  if (!form) continue;
  const input = form.querySelector('input[type="file"]');
  const preview = form.querySelector('.media-preview');
  const button = form.querySelector('button[type="submit"]');
  let previewUrl;
  let uploading = false;
  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = undefined;
    preview.hidden = true;
  };
  const selectedFile = () => {
    const file = input.files?.[0];
    if (!file) throw new Error('Hãy chọn một ảnh trước.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Chỉ nhận ảnh JPG, PNG hoặc WebP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Ảnh vượt quá 5 MB. Hãy chọn ảnh nhỏ hơn.');
    return file;
  };
  input.addEventListener('change', () => {
    clearPreview();
    status.textContent = '';
    try {
      previewUrl = URL.createObjectURL(selectedFile());
      preview.querySelector('img').src = previewUrl;
      preview.hidden = false;
    } catch (error) { status.textContent = error.message; }
  });
  window.addEventListener('pagehide', clearPreview);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (uploading) return;
    try {
      const file = selectedFile();
      uploading = true;
      button.disabled = true;
      input.disabled = true;
      status.textContent = 'Đang tối ưu và tải ảnh…';
      const body = new FormData();
      body.append('image', file);
      const response = await fetch(manager.dataset.uploadUrl, {
        method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': manager.dataset.csrf }, body
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || 'Chưa tải được ảnh. Hãy tải lại trang và thử lại.');
      window.location.reload();
    } catch (error) {
      status.textContent = error.message || 'Không kết nối được. Vui lòng thử lại.';
      uploading = false;
      button.disabled = false;
      input.disabled = false;
    }
  });
}

for (const form of document.querySelectorAll('[data-photo-delete]')) {
  form.addEventListener('submit', event => { if (!window.confirm('Xóa ảnh này khỏi sân/cơ sở?')) event.preventDefault(); });
}

const lightbox = document.querySelector('.media-lightbox');
if (lightbox && typeof lightbox.showModal === 'function') {
  for (const link of document.querySelectorAll('[data-gallery-image]')) {
    link.addEventListener('click', event => {
      event.preventDefault();
      lightbox.querySelector('img').src = link.href;
      lightbox.showModal();
    });
  }
}
