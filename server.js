import 'dotenv/config';
import app from './app.js';
import connectDatabase from './config/database.js';

const PORT = 3000;

try {
  await connectDatabase();
  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
} catch (error) {
  console.error({
    name: error.name,
    code: error.code ?? error.cause?.code,
    syscall: error.syscall ?? error.cause?.syscall,
    address: error.address ?? error.cause?.address,
    port: error.port ?? error.cause?.port
  });

  process.exitCode = 1;
}