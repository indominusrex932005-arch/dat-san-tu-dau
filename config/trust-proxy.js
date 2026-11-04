import { isIP } from 'node:net';

export function trustedProxyAddresses(value) {
  if (!value?.trim()) return false;

  return value.split(',').map(entry => {
    const address = entry.trim();
    const [ip, prefix, extra] = address.split('/');
    const version = isIP(ip);
    const maxPrefix = version === 4 ? 32 : 128;
    if (!version || extra !== undefined || (prefix !== undefined && (!/^[1-9]\d*$/.test(prefix) || Number(prefix) > maxPrefix))) {
      throw new Error('TRUST_PROXY_IPS phải là danh sách IP hoặc CIDR của proxy, phân cách bằng dấu phẩy.');
    }
    return address;
  });
}
