const SAFE_ERROR_CODES = new Set(['MIGRATION_REQUIRED', 'REPLICA_SET_REQUIRED', 'INVALID_PAYMENT_CONFIG']);

function stripPlatformHelpers(req, res) {
  for (const key of ['body', 'query', 'cookies']) {
    if (req && Object.hasOwn(req, key)) {
      try { delete req[key]; } catch { /* ignore non-configurable */ }
    }
  }
  for (const key of ['status', 'send', 'json', 'redirect']) {
    if (res && Object.hasOwn(res, key)) {
      try { delete res[key]; } catch { /* ignore non-configurable */ }
    }
  }
}

function invokeApp(app, req, res) {
  stripPlatformHelpers(req, res);
  if (!res || typeof res.once !== 'function') {
    return app(req, res);
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      res.removeListener?.('finish', onDone);
      res.removeListener?.('close', onDone);
      res.removeListener?.('error', onError);
    };
    const onDone = () => { cleanup(); resolve(); };
    const onError = error => { cleanup(); reject(error); };
    res.once('finish', onDone);
    res.once('close', onDone);
    res.once('error', onError);
    try {
      app(req, res, error => {
        if (error) onError(error);
      });
    } catch (error) {
      onError(error);
    }
  });
}

// A warm function shares startup and cleanup work between concurrent requests.
// No background interval: cleanup runs on the next request after the deadline.
export function createServerlessHandler({ initialize, expireHolds, now = Date.now, log = console.error }) {
  let application;
  let cleanup;
  let nextCleanup = 0;
  return async (req, res) => {
    try {
      if (!application) {
        application = Promise.resolve().then(initialize).catch(error => {
          application = undefined;
          throw error;
        });
      }
      const app = await application;
      if (now() >= nextCleanup) {
        if (!cleanup) {
          cleanup = Promise.resolve().then(expireHolds).then(() => {
            nextCleanup = now() + 30000;
          }).finally(() => { cleanup = undefined; });
        }
        await cleanup;
      }
      return await invokeApp(app, req, res);
    } catch (error) {
      const detail = SAFE_ERROR_CODES.has(error?.code)
        ? `${error.code}: ${error.message}`
        : [error?.name || 'Error', error?.code].filter(Boolean).join(' ');
      log('Không thể phục vụ yêu cầu serverless:', detail);
      if (!res.headersSent) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Retry-After', '5');
        res.statusCode = 503;
        res.end('Máy chủ chưa sẵn sàng. Vui lòng thử lại sau ít giây.');
      }
    }
  };
}
