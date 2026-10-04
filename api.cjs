const { randomBytes, createHash, scrypt: scryptCallback, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(scryptCallback);
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });

async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
async function verifyPassword(password, hash) {
  const [salt, expected] = hash.split(':');
  const actual = await hashPassword(password, salt);
  return timingSafeEqual(Buffer.from(actual.split(':')[1], 'hex'), Buffer.from(expected, 'hex'));
}
function normalizeDate(value) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) throw fail(400, 'Invalid workout date.');
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (y < 1900 || y > 2200 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw fail(400, 'Invalid workout date.');
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function validateEntries(entries) {
  if (!Array.isArray(entries) || entries.length > 200) throw fail(400, 'Invalid workout entries.');
  const groups = ['Shoulders', 'Chest', 'Back', 'Legs', 'Core', 'Arms', 'Cardio', 'Custom'];
  const metric = (value, integer = false, optional = false) => {
    if (optional && (value === '' || value == null)) return '';
    if (!['string', 'number'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1000000 || (integer && !Number.isInteger(Number(value)))) throw fail(400, 'Invalid exercise values.');
    return String(Number(value));
  };
  return entries.map(entry => {
    if (!entry || !groups.includes(entry.muscle) || typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 160) throw fail(400, 'Invalid exercise name or category.');
    const clean = { muscle: entry.muscle, name: entry.name.trim() };
    if (entry.muscle === 'Cardio') Object.assign(clean, { minutes: metric(entry.minutes, true), kcal: metric(entry.kcal, true) });
    else {
      if (!['kg', 'lb'].includes(entry.unit)) throw fail(400, 'Invalid weight unit.');
      Object.assign(clean, { weight: metric(entry.weight), sets: metric(entry.sets, true, true), unit: entry.unit });
    }
    if (entry.muscle === 'Custom') {
      Object.assign(clean, { minutes: metric(entry.minutes, true, true), kcal: metric(entry.kcal, true, true) });
      if (typeof entry.draftKey === 'string' && /^Custom-\d{1,4}$/.test(entry.draftKey)) clean.draftKey = entry.draftKey;
    }
    return clean;
  });
}
async function readBody(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw fail(415, 'Send JSON data.');
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 128 * 1024) throw fail(413, 'Request too large.');
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw fail(400, 'Invalid JSON.'); }
}

function createApi(db, { origin, secure = false, registration = true } = {}) {
  const attempts = new Map();
  const cleanup = setInterval(() => {
    for (const [key, value] of attempts) if (value.until < Date.now()) attempts.delete(key);
  }, 60000);
  cleanup.unref();
  const cookie = (token, age) => `tracked_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
  return async (request, response) => {
    const send = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (!['GET', 'HEAD'].includes(request.method) && (!origin || request.headers.origin !== origin)) throw fail(403, 'Request origin is not allowed.');
      if (request.method === 'POST' && ['/api/register', '/api/login'].includes(pathname)) {
        // Use the socket address rather than trusting a client-controlled forwarded header.
        const key = request.socket.remoteAddress;
        const bucket = attempts.get(key);
        if (bucket && bucket.until > Date.now() && bucket.count >= 20) throw fail(429, 'Too many attempts. Try again in 15 minutes.');
        attempts.set(key, bucket && bucket.until > Date.now() ? { ...bucket, count: bucket.count + 1 } : { count: 1, until: Date.now() + 900000 });
        const body = await readBody(request);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const password = body.password;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof password !== 'string' || password.length < 12 || password.length > 128) throw fail(400, 'Use a valid email and a password of 12–128 characters.');
        let user;
        if (pathname === '/api/register') {
          if (!registration) throw fail(403, 'Account creation is disabled.');
          try {
            const [result] = await db.execute('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, await hashPassword(password)]);
            user = { id: result.insertId, email };
          } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') throw fail(409, 'An account with this email already exists.');
            throw error;
          }
        } else {
          const [rows] = await db.execute('SELECT id, email, password_hash FROM users WHERE email = ?', [email]);
          const dummy = '00000000000000000000000000000000:' + '00'.repeat(64);
          const valid = await verifyPassword(password, rows[0]?.password_hash || dummy);
          if (!rows[0] || !valid) throw fail(401, 'Email or password is incorrect.');
          user = rows[0];
        }
        const token = randomBytes(32).toString('hex');
        await db.execute('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))', [digest(token), user.id]);
        response.setHeader('Set-Cookie', cookie(token, 2592000));
        return send(200, { user: { id: user.id, email: user.email } });
      }
      const token = /(?:^|;\s*)tracked_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.cookie || '')?.[1];
      const [users] = token ? await db.execute('SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()', [digest(token)]) : [[]];
      const user = users[0];
      if (pathname === '/api/session' && request.method === 'GET') return send(200, { user: user || null, registration });
      if (!user) throw fail(401, 'Please sign in again.');
      if (pathname === '/api/logout' && request.method === 'POST') {
        await db.execute('DELETE FROM sessions WHERE token_hash = ?', [digest(token)]);
        response.setHeader('Set-Cookie', cookie('', 0));
        return send(200, { ok: true });
      }
      if (pathname === '/api/workouts' && request.method === 'GET') {
        const [rows] = await db.execute("SELECT DATE_FORMAT(workout_date, '%Y-%c-%e') AS date_key, entries_json, version FROM workouts WHERE user_id = ?", [user.id]);
        const workouts = {}, versions = {};
        for (const row of rows) {
          const entries = JSON.parse(row.entries_json);
          if (entries.length) workouts[row.date_key] = entries;
          versions[row.date_key] = row.version;
        }
        return send(200, { workouts, versions });
      }
      const match = /^\/api\/workouts\/([^/]+)$/.exec(pathname);
      if (match && request.method === 'PUT') {
        const date = normalizeDate(match[1]);
        const body = await readBody(request);
        const entries = validateEntries(body.entries);
        if (!Number.isSafeInteger(body.version) || body.version < 0) throw fail(400, 'Invalid workout version.');
        if (body.version === 0) {
          try { await db.execute('INSERT INTO workouts (user_id, workout_date, entries_json) VALUES (?, ?, ?)', [user.id, date, JSON.stringify(entries)]); }
          catch (error) { if (error.code === 'ER_DUP_ENTRY') throw fail(409, 'This workout changed on another device. Reload and try again.'); throw error; }
        } else {
          const [result] = await db.execute('UPDATE workouts SET entries_json = ?, version = version + 1 WHERE user_id = ? AND workout_date = ? AND version = ?', [JSON.stringify(entries), user.id, date, body.version]);
          if (!result.affectedRows) throw fail(409, 'This workout changed on another device. Reload and try again.');
        }
        return send(200, { entries, version: body.version + 1 });
      }
      throw fail(404, 'Not found.');
    } catch (error) {
      if (!error.status) console.error('API error:', error.code || error.message);
      send(error.status || 503, { error: error.status ? error.message : 'Database unavailable. Please try again.' });
    }
  };
}
module.exports = { createApi, hashPassword, verifyPassword, normalizeDate, validateEntries };
