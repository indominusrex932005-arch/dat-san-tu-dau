(() => {
  const form = document.querySelector('.login-form');
  const toggle = document.querySelector('[data-password-toggle]');
  const password = document.getElementById('password');
  const captchaImg = document.querySelector('[data-captcha-image]');
  const captchaRefresh = document.querySelector('[data-captcha-refresh]');
  const captchaInput = document.getElementById('botAnswer');

  if (toggle && password) {
    toggle.addEventListener('click', () => {
      const visible = password.type === 'text';
      password.type = visible ? 'password' : 'text';
      toggle.setAttribute('aria-pressed', String(!visible));
      toggle.textContent = visible ? 'Hiện' : 'Ẩn';
    });
  }

  if (captchaRefresh && captchaImg) {
    captchaRefresh.addEventListener('click', () => {
      captchaImg.src = `/captcha.svg?refresh=1&t=${Date.now()}`;
      if (captchaInput) {
        captchaInput.value = '';
        captchaInput.focus();
      }
    });
  }

  if (form) {
    form.addEventListener('submit', () => {
      const submit = form.querySelector('.login-submit');
      if (!submit || submit.disabled) return;
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      submit.textContent = 'Đang xử lý…';
    });
  }
})();
