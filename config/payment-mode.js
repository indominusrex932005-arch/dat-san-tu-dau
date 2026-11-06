function invalid(message) {
  throw Object.assign(new Error(message), { code: 'INVALID_PAYMENT_CONFIG' });
}

// The only source of payment mode is server configuration, never request data.
export function getPaymentConfig(env = process.env) {
  if (Object.hasOwn(env, 'DEMO_MODE')) {
    invalid('Bỏ biến DEMO_MODE cũ; chỉ cấu hình PAYMENT_MODE=off hoặc demo.');
  }
  const mode = env.PAYMENT_MODE ?? 'off';
  if (!['off', 'demo', 'live'].includes(mode)) {
    invalid('PAYMENT_MODE phải là off, demo hoặc live.');
  }
  if (mode === 'live') {
    invalid('PAYMENT_MODE=live chưa được triển khai; không mở thanh toán thật.');
  }
  if (env.DEMO_DATA_ONLY !== undefined && !['true', 'false'].includes(env.DEMO_DATA_ONLY)) {
    invalid('DEMO_DATA_ONLY chỉ nhận true hoặc false.');
  }
  const publicDemo = env.NODE_ENV === 'production' && mode === 'demo';
  if (publicDemo && (env.DEMO_DATA_ONLY !== 'true' || typeof env.DB_NAME !== 'string' || !env.DB_NAME.trim())) {
    invalid('Demo production cần DEMO_DATA_ONLY=true và DB_NAME riêng chứa dữ liệu thử.');
  }
  return Object.freeze({ mode, demoMode: mode === 'demo', publicDemo });
}
