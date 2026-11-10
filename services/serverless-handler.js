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
      return app(req, res);
    } catch (error) {
      log('Không thể phục vụ yêu cầu serverless:', error.name);
      if (!res.headersSent) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Retry-After', '5');
        res.statusCode = 503;
        res.end('Máy chủ chưa sẵn sàng. Vui lòng thử lại sau ít giây.');
      }
    }
  };
}
