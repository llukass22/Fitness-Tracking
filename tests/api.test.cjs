const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApi, hashPassword, verifyPassword, normalizeDate, validateEntries } = require('../api.cjs');

function memoryDatabase() {
  const users = [], sessions = new Map(), workouts = new Map();
  const duplicate = () => { throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' }); };
  return { async execute(sql, args) {
    if (sql.startsWith('INSERT INTO users')) {
      if (users.some(user => user.email === args[0])) duplicate();
      users.push({ id: users.length + 1, email: args[0], password_hash: args[1] });
      return [{ insertId: users.length }];
    }
    if (sql.startsWith('SELECT id, email')) return [users.filter(user => user.email === args[0])];
    if (sql.startsWith('INSERT INTO sessions')) { sessions.set(args[0], args[1]); return [{}]; }
    if (sql.startsWith('SELECT u.id')) {
      const user = users.find(user => user.id === sessions.get(args[0]));
      return [user ? [{ id: user.id, email: user.email }] : []];
    }
    if (sql.startsWith('DELETE FROM sessions')) { sessions.delete(args[0]); return [{}]; }
    if (sql.startsWith('INSERT INTO workouts')) {
      const key = args[0] + ':' + args[1];
      if (workouts.has(key)) duplicate();
      workouts.set(key, { user_id: args[0], date: args[1], entries_json: args[2], version: 1 });
      return [{}];
    }
    if (sql.startsWith('UPDATE workouts')) {
      const row = workouts.get(args[1] + ':' + args[2]);
      if (!row || row.version !== args[3]) return [{ affectedRows: 0 }];
      row.entries_json = args[0]; row.version++;
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('SELECT DATE_FORMAT')) return [[...workouts.values()].filter(row => row.user_id === args[0]).map(row => ({ ...row, date_key: row.date.split('-').map(Number).join('-') }))];
    throw new Error('Unexpected SQL: ' + sql);
  } };
}
const exercise = { muscle: 'Custom', name: 'Squat', weight: '20', sets: '3', unit: 'kg', minutes: '15', kcal: '100', draftKey: 'Custom-0' };

test('custom time and calories survive validation while blank legacy values remain optional', () => {
  const clean = validateEntries([exercise])[0];
  assert.equal(clean.minutes, '15');
  assert.equal(clean.kcal, '100');
  const legacy = { ...exercise };
  delete legacy.minutes;
  delete legacy.kcal;
  assert.equal(validateEntries([legacy])[0].minutes, '');
  assert.equal(validateEntries([legacy])[0].kcal, '');
  for (const field of ['minutes', 'kcal']) {
    for (const value of [-1, 1.5, 'invalid']) assert.throws(() => validateEntries([{ ...exercise, [field]: value }]));
    assert.equal(validateEntries([{ ...exercise, [field]: '0' }])[0][field], '0');
  }
});

test('password hashing and validation reject malformed input', async () => {
  const hash = await hashPassword('a long password');
  assert.notEqual(hash, 'a long password');
  assert.equal(await verifyPassword('a long password', hash), true);
  assert.equal(await verifyPassword('wrong password', hash), false);
  assert.equal(normalizeDate('2026-9-28'), '2026-09-28');
  assert.throws(() => normalizeDate('2026-2-30'));
  assert.throws(() => normalizeDate('2026-9-28 OR 1=1'));
  assert.throws(() => validateEntries([{ ...exercise, weight: -1 }]));
  assert.throws(() => validateEntries([{ ...exercise, sets: 1.5 }]));
  assert.throws(() => validateEntries([{ ...exercise, muscle: 'Unknown' }]));
  assert.throws(() => validateEntries([{ ...exercise, name: ' ' }]));
  assert.throws(() => validateEntries([{ ...exercise, weight: true }]));
  assert.equal(validateEntries([exercise])[0].weight, '20');
});

test('HTTP accounts isolate workouts, enforce origin and sessions, and reject stale saves', async () => {
  const api = createApi(memoryDatabase(), { origin: 'https://tracker.example', secure: true });
  const server = http.createServer(api);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const call = (path, method = 'GET', body, cookie, origin = 'https://tracker.example') => new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port: server.address().port, path, method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) } }, response => {
      let content = '';
      response.on('data', chunk => content += chunk);
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(content), cookie: response.headers['set-cookie']?.[0] }));
    });
    request.on('error', reject);
    request.end(body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
  });
  try {
    assert.equal((await call('/api/workouts')).status, 401);
    assert.equal((await call('/api/register', 'POST', {}, null, 'https://evil.example')).status, 403);
    assert.equal((await call('/api/register', 'POST', '{')).status, 400);
    const account = await call('/api/register', 'POST', { email: 'USER@example.com', password: 'correct horse battery' });
    assert.equal(account.status, 200);
    assert.match(account.cookie, /HttpOnly; SameSite=Lax/);
    assert.match(account.cookie, /; Secure/);
    const cookie = account.cookie.split(';')[0];
    assert.equal((await call('/api/session', 'GET', undefined, cookie)).body.user.email, 'user@example.com');
    assert.equal((await call('/api/login', 'POST', { email: 'user@example.com', password: 'incorrect password' })).status, 401);
    assert.equal((await call('/api/login', 'POST', { email: 'user@example.com', password: 'correct horse battery' })).status, 200);
    const saved = await call('/api/workouts/2026-9-28', 'PUT', { entries: [exercise], version: 0 }, cookie);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.version, 1);
    assert.equal((await call('/api/workouts/2026-9-28', 'PUT', { entries: [exercise], version: 0 }, cookie)).status, 409);
    assert.equal((await call('/api/workouts', 'GET', undefined, cookie)).body.workouts['2026-9-28'][0].name, 'Squat');
    const other = await call('/api/register', 'POST', { email: 'other@example.com', password: 'another long password' });
    const otherCookie = other.cookie.split(';')[0];
    assert.deepEqual((await call('/api/workouts', 'GET', undefined, otherCookie)).body.workouts, {});
    assert.equal((await call('/api/workouts/2026-9-28', 'PUT', { entries: [], version: 1 }, otherCookie)).status, 409);
    assert.equal((await call('/api/workouts/2026-9-28', 'PUT', { entries: [], version: 1 }, cookie)).status, 200);
    const cleared = await call('/api/workouts', 'GET', undefined, cookie);
    assert.deepEqual(cleared.body.workouts, {});
    assert.equal(cleared.body.versions['2026-9-28'], 2);
    assert.equal((await call('/api/workouts/2026-9-28', 'PUT', { entries: [exercise], version: 1 }, cookie)).status, 409);
    assert.equal((await call('/api/logout', 'POST', {}, cookie)).status, 200);
    assert.equal((await call('/api/workouts', 'GET', undefined, cookie)).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('registration can be disabled and database errors stay private', async () => {
  const { Readable } = require('node:stream');
  const invoke = async (api, url) => {
    const request = Readable.from([Buffer.from(JSON.stringify({ email: 'a@example.com', password: 'a long enough password' }))]);
    Object.assign(request, { url, method: 'POST', headers: { origin: 'https://tracker.example', 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' } });
    let status, body;
    await api(request, { setHeader() {}, writeHead(value) { status = value; }, end(value) { body = JSON.parse(value); } });
    return { status, body };
  };
  const db = { execute: async () => { throw new Error('secret database detail'); } };
  assert.equal((await invoke(createApi(db, { origin: 'https://tracker.example', registration: false }), '/api/register')).status, 403);
  const result = await invoke(createApi(db, { origin: 'https://tracker.example' }), '/api/login');
  assert.equal(result.status, 503);
  assert.equal(result.body.error.includes('secret'), false);
});
