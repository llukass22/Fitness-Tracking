const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLocalDatabase } = require('../local-db.cjs');

test('local database persists accounts and workouts across restarts and keeps accounts separate', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'tracked-local-db-'));
  const file = path.join(folder, 'db.json');
  try {
    let db = createLocalDatabase(file);
    const [created] = await db.execute('INSERT INTO users (email, password_hash) VALUES (?, ?)', ['one@example.com', 'hash']);
    const [other] = await db.execute('INSERT INTO users (email, password_hash) VALUES (?, ?)', ['two@example.com', 'hash']);
    assert.equal(created.insertId, 1);
    assert.equal(other.insertId, 2);
    await db.execute('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))', ['token', 1]);
    await db.execute('INSERT INTO workouts (user_id, workout_date, entries_json) VALUES (?, ?, ?)', [1, '2026-10-04', '[{"name":"Squat"}]']);
    db = createLocalDatabase(file);
    assert.equal((await db.execute('SELECT id, email, password_hash FROM users WHERE email = ?', ['one@example.com']))[0][0].id, 1);
    assert.equal((await db.execute('SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()', ['token']))[0][0].email, 'one@example.com');
    assert.equal((await db.execute("SELECT DATE_FORMAT(workout_date, '%Y-%c-%e') AS date_key, entries_json, version FROM workouts WHERE user_id = ?", [1]))[0][0].date_key, '2026-10-4');
    assert.equal((await db.execute("SELECT DATE_FORMAT(workout_date, '%Y-%c-%e') AS date_key, entries_json, version FROM workouts WHERE user_id = ?", [2]))[0].length, 0);
    assert.deepEqual(await db.execute('UPDATE workouts SET entries_json = ?, version = version + 1 WHERE user_id = ? AND workout_date = ? AND version = ?', ['[]', 1, '2026-10-04', 0]), [{ affectedRows: 0 }]);
    assert.deepEqual(await db.execute('UPDATE workouts SET entries_json = ?, version = version + 1 WHERE user_id = ? AND workout_date = ? AND version = ?', ['[]', 1, '2026-10-04', 1]), [{ affectedRows: 1 }]);
    db = createLocalDatabase(file);
    assert.equal((await db.execute("SELECT DATE_FORMAT(workout_date, '%Y-%c-%e') AS date_key, entries_json, version FROM workouts WHERE user_id = ?", [1]))[0][0].version, 2);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
