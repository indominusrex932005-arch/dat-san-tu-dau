import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ejs from 'ejs';

async function check(directory) {
  let count = 0;
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, item.name);
    if (item.isDirectory()) count += await check(filename);
    else if (item.name.endsWith('.ejs')) {
      ejs.compile(await readFile(filename, 'utf8'), { filename });
      count++;
    }
  }
  return count;
}
console.log(`Đã kiểm tra cú pháp ${await check('views')} template EJS.`);
