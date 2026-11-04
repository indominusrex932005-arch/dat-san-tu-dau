import { createHash } from 'node:crypto';
import { isIP, SocketAddress } from 'node:net';

const MAX_BUCKETS = 10000;

function positiveInteger(name, fallback, maximum) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!/^[1-9]\d*$/.test(raw) || value > maximum) {
    throw new Error(`${name} phải là số nguyên từ 1 đến ${maximum}.`);
  }
  return value;
}

function ipKey(req) {
  const forwardedIp = req.ip;
  const ip = isIP(forwardedIp) ? forwardedIp : req.socket.remoteAddress;
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6) return 'unknown';

  const address = new SocketAddress({ address: ip, family: 'ipv6' }).address;
  if (address.startsWith('::ffff:')) return address.slice(7);

  // Temporary IPv6 addresses on the same /64 share the IP limit.
  const [left, right] = address.split('::');
  const leading = left ? left.split(':') : [];
  const trailing = right ? right.split(':') : [];
  const groups = [...leading, ...Array(8 - leading.length - trailing.length).fill('0'), ...trailing];
  return groups.slice(0, 4).join(':') + '::/64';
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function accountAndIpKey(req, ip) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (email && email.length <= 254) return ip + ':' + hash(email);
}

function bookingActorKey(req) {
  if (req.currentUser) return 'user:' + req.currentUser._id;
  return 'session:' + hash(req.sessionID);
}

function createLimiter(name, windowSeconds, ipMaximum, backUrl, actor) {
  const prefix = 'RATE_LIMIT_' + name;
  const windowMs = positiveInteger(prefix + '_WINDOW_SECONDS', windowSeconds, 86400) * 1000;
  const policies = [
    { buckets: new Map(), max: positiveInteger(prefix + '_IP_MAX', ipMaximum, 100000), key: (req, ip) => ip }
  ];
  if (actor) {
    policies.push({ buckets: new Map(), max: positiveInteger(prefix + actor.suffix, actor.max, 100000), key: actor.key });
  }

  return (req, res, next) => {
    const now = performance.now();
    const ip = ipKey(req);
    const accepted = [];
    let blockedUntil = now;

    for (const { buckets, max, key } of policies) {
      // Each window has the same duration, so insertion order is also expiry order.
      for (const [id, bucket] of buckets) {
        if (bucket.resetAt > now) break;
        buckets.delete(id);
      }
      const id = key(req, ip);
      if (!id) continue;
      const bucket = buckets.get(id);
      if (bucket && bucket.count >= max) {
        blockedUntil = Math.max(blockedUntil, bucket.resetAt);
      } else if (!bucket && buckets.size >= MAX_BUCKETS) {
        blockedUntil = Math.max(blockedUntil, buckets.values().next().value.resetAt);
      } else {
        accepted.push({ buckets, id, bucket });
      }
    }

    if (blockedUntil > now) {
      const seconds = Math.ceil((blockedUntil - now) / 1000);
      return res.set('Retry-After', String(seconds)).status(429).render('error', {
        title: 'Quá nhiều yêu cầu',
        message: `Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ${seconds} giây.`,
        backUrl
      });
    }

    // A request rejected by either policy does not consume the other quota.
    for (const { buckets, id, bucket } of accepted) {
      if (bucket) bucket.count++;
      else buckets.set(id, { count: 1, resetAt: now + windowMs });
    }
    next();
  };
}

export function createPostRateLimits() {
  return {
    login: createLimiter('LOGIN', 900, 60, '/login', {
      suffix: '_ACCOUNT_IP_MAX', max: 8, key: accountAndIpKey
    }),
    register: createLimiter('REGISTER', 900, 12, '/register'),
    registerOwner: createLimiter('REGISTER_OWNER', 900, 12, '/register/owner'),
    bookings: createLimiter('BOOKINGS', 600, 60, '/courts', {
      suffix: '_ACTOR_MAX', max: 12, key: bookingActorKey
    })
  };
}
