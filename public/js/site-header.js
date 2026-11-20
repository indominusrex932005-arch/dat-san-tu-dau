(() => {
  const STORAGE_KEY = 'site-theme';
  const root = document.documentElement;
  const mediaDark = window.matchMedia?.('(prefers-color-scheme: dark)');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const langWrap = document.querySelector('#site-lang');
  const langBtn = document.querySelector('#site-lang-toggle');
  const langMenu = document.querySelector('#site-lang-menu');

  const themeWrap = document.querySelector('#site-theme');
  const themeBtn = document.querySelector('#site-theme-toggle');
  const themeMenu = document.querySelector('#site-theme-menu');
  const themeOptions = themeMenu ? [...themeMenu.querySelectorAll('[data-theme-choice]')] : [];

  const account = document.querySelector('#site-account');
  const accountTrigger = document.querySelector('#site-account-trigger');
  const accountMenu = document.querySelector('#site-account-menu');

  let currentMode = 'system';

  function storedMode() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === 'light' || value === 'dark' || value === 'system') return value;
    } catch { /* ignore storage errors */ }
    return 'system';
  }

  function resolveEffectiveTheme(mode) {
    if (mode === 'light' || mode === 'dark') return mode;
    return mediaDark?.matches ? 'dark' : 'light';
  }

  function commitTheme(mode) {
    const effective = resolveEffectiveTheme(mode);
    currentMode = mode;
    root.dataset.theme = effective;
    root.dataset.themeMode = mode;
    if (themeBtn) {
      const labels = { light: 'Sáng', dark: 'Tối', system: 'Theo hệ thống' };
      themeBtn.title = `Giao diện: ${labels[mode]}`;
      themeBtn.setAttribute('aria-label', `Giao diện hiện tại: ${labels[mode]}. Bấm để đổi.`);
    }
    for (const option of themeOptions) {
      const active = option.dataset.themeChoice === mode;
      option.setAttribute('aria-checked', String(active));
      option.classList.toggle('is-active', active);
    }
  }

  function applyTheme(mode, { persist = false, animate = false } = {}) {
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, mode); }
      catch { /* ignore storage errors */ }
    }
    const previousEffective = root.dataset.theme;
    const nextEffective = resolveEffectiveTheme(mode);
    const shouldAnimate = animate && previousEffective && previousEffective !== nextEffective && !reducedMotion?.matches;

    if (!shouldAnimate) {
      commitTheme(mode);
      return;
    }

    commitTheme(mode);

    if (themeBtn) {
      themeBtn.classList.remove('is-spinning');
      void themeBtn.offsetWidth;
      themeBtn.classList.add('is-spinning');
    }
  }

  applyTheme(storedMode(), { persist: false, animate: false });

  mediaDark?.addEventListener('change', () => {
    if (currentMode === 'system') {
      applyTheme('system', { persist: false, animate: true });
    }
  });

  function setLangMenuOpen(open, restoreFocus = false) {
    if (!langWrap || !langBtn || !langMenu) return;
    langMenu.hidden = !open;
    langWrap.classList.toggle('is-open', open);
    langBtn.setAttribute('aria-expanded', String(open));
    if (!open && restoreFocus) langBtn.focus();
  }

  function setThemeMenuOpen(open, restoreFocus = false) {
    if (!themeWrap || !themeBtn || !themeMenu) return;
    themeMenu.hidden = !open;
    themeWrap.classList.toggle('is-open', open);
    themeBtn.setAttribute('aria-expanded', String(open));
    if (!open && restoreFocus) themeBtn.focus();
  }

  function setAccountMenuOpen(open, restoreFocus = false) {
    if (!account || !accountTrigger || !accountMenu) return;
    accountMenu.hidden = !open;
    account.classList.toggle('is-open', open);
    accountTrigger.setAttribute('aria-expanded', String(open));
    if (!open && restoreFocus) accountTrigger.focus();
  }

  if (langWrap && langBtn && langMenu) {
    langBtn.addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = langMenu.hidden;
      setThemeMenuOpen(false);
      setAccountMenuOpen(false);
      setLangMenuOpen(willOpen);
    });

    langMenu.addEventListener('click', event => {
      const option = event.target.closest('[data-lang-choice]');
      if (!option) return;
      window.dispatchEvent(new CustomEvent('site:set-lang', { detail: { lang: option.dataset.langChoice } }));
      setLangMenuOpen(false, true);
    });
  }

  if (themeWrap && themeBtn && themeMenu) {
    themeBtn.addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = themeMenu.hidden;
      setLangMenuOpen(false);
      setAccountMenuOpen(false);
      setThemeMenuOpen(willOpen);
    });

    themeMenu.addEventListener('click', event => {
      const option = event.target.closest('[data-theme-choice]');
      if (!option) return;
      applyTheme(option.dataset.themeChoice, { persist: true, animate: true });
      setThemeMenuOpen(false, true);
    });
  }

  if (account && accountTrigger && accountMenu) {
    accountTrigger.addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = accountMenu.hidden;
      setLangMenuOpen(false);
      setThemeMenuOpen(false);
      setAccountMenuOpen(willOpen);
    });

    const logoutForm = accountMenu.querySelector('.site-account-logout-form');
    if (logoutForm) {
      logoutForm.addEventListener('submit', () => {
        setAccountMenuOpen(false);
      });
    }
  }

  document.addEventListener('click', event => {
    if (langMenu && !langMenu.hidden && !langWrap.contains(event.target)) {
      setLangMenuOpen(false);
    }
    if (themeMenu && !themeMenu.hidden && !themeWrap.contains(event.target)) {
      setThemeMenuOpen(false);
    }
    if (accountMenu && !accountMenu.hidden && !account.contains(event.target)) {
      setAccountMenuOpen(false);
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (langMenu && !langMenu.hidden) setLangMenuOpen(false, true);
    if (themeMenu && !themeMenu.hidden) setThemeMenuOpen(false, true);
    if (accountMenu && !accountMenu.hidden) setAccountMenuOpen(false, true);
  });

  // Thanh tiến trình & vòng xoay tải khi chuyển trang chậm / mạng yếu
  const progressBar = document.createElement('div');
  progressBar.className = 'site-progress-bar';
  progressBar.setAttribute('aria-hidden', 'true');

  const slowLoader = document.createElement('div');
  slowLoader.className = 'site-slow-loader';
  slowLoader.setAttribute('role', 'status');
  slowLoader.setAttribute('aria-live', 'polite');
  slowLoader.hidden = true;
  const spinner = document.createElement('span');
  spinner.className = 'site-spinner';
  spinner.setAttribute('aria-hidden', 'true');
  const slowLabel = document.createElement('span');
  slowLabel.textContent = 'Đang tải…';
  slowLoader.append(spinner, slowLabel);
  document.body.append(progressBar, slowLoader);

  let barDelayTimer;
  let slowDelayTimer;
  let safetyResetTimer;

  function stopPageLoader() {
    window.clearTimeout(barDelayTimer);
    window.clearTimeout(slowDelayTimer);
    window.clearTimeout(safetyResetTimer);
    progressBar.classList.remove('is-active');
    slowLoader.hidden = true;
  }

  function startPageLoader() {
    stopPageLoader();
    slowLabel.textContent = root.lang === 'en' ? 'Loading…' : 'Đang tải…';
    barDelayTimer = window.setTimeout(() => {
      progressBar.classList.add('is-active');
    }, 120);
    slowDelayTimer = window.setTimeout(() => {
      slowLoader.hidden = false;
    }, 700);
    safetyResetTimer = window.setTimeout(stopPageLoader, 15000);
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
    let url;
    try { url = new URL(link.href, location.href); } catch { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    startPageLoader();
  });

  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || event.defaultPrevented) return;
    if ((form.getAttribute('method') || '').toLowerCase() === 'dialog') return;
    if (form.id === 'provider-payment-form' || form.id === 'slot-booking-form') return;
    startPageLoader();
  });

  window.addEventListener('pageshow', stopPageLoader);
})();
