import mongoose from 'mongoose';

let pendingProbe;

async function databaseReady() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
  // Share an in-flight ping and bound the driver operation, including selection.
  pendingProbe ??= mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 2000 })
    .then(() => true, () => false)
    .finally(() => { pendingProbe = undefined; });
  return pendingProbe;
}

export async function health(req, res) {
  const ready = await databaseReady().catch(() => false);
  res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable' });
}
