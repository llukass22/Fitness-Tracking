const fs = require('node:fs');
const path = require('node:path');

function createLocalDatabase(file = path.join(__dirname, '.local-data', 'db.json')) {
  let state = { users: [], sessions: [], workouts: [] };
  if (fs.existsSync(file)) {
    state = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(state.users) || !Array.isArray(state.sessions) || !Array.isArray(state.workouts)) {
      throw new Error('Local data file is invalid.');
    }
  }

  const duplicate = () => { throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' }); };
  const update = change => {
    const next = structuredClone(state);
    const result = change(next);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(next), { mode: 0o600 });
      fs.renameSync(temporary, file);
    } catch (error) {
      try { fs.unlinkSync(temporary); } catch {}
      throw error;
    }
    state = next;
    return [result];
  };

  return {
    async execute(sql, args = []) {
      if (sql.startsWith('INSERT INTO users')) return update(next => {
        if (next.users.some(user => user.email === args[0])) duplicate();
        const id = Math.max(0, ...next.users.map(user => user.id)) + 1;
        next.users.push({ id, email: args[0], password_hash: args[1] });
        return { insertId: id };
      });
      if (sql.startsWith('SELECT id, email')) return [state.users.filter(user => user.email === args[0])];
      if (sql.startsWith('INSERT INTO sessions')) return update(next => {
        next.sessions.push({ token_hash: args[0], user_id: args[1], expires_at: Date.now() + 30 * 86400000 });
        return {};
      });
      if (sql.startsWith('SELECT u.id')) {
        const session = state.sessions.find(item => item.token_hash === args[0] && item.expires_at > Date.now());
        const user = session && state.users.find(item => item.id === session.user_id);
        return [user ? [{ id: user.id, email: user.email }] : []];
      }
      if (sql.startsWith('DELETE FROM sessions')) return update(next => {
        next.sessions = next.sessions.filter(item => item.token_hash !== args[0]);
        return {};
      });
      if (sql.startsWith('INSERT INTO workouts')) return update(next => {
        if (next.workouts.some(row => row.user_id === args[0] && row.date === args[1])) duplicate();
        next.workouts.push({ user_id: args[0], date: args[1], entries_json: args[2], version: 1 });
        return {};
      });
      if (sql.startsWith('UPDATE workouts')) {
        const row = state.workouts.find(item => item.user_id === args[1] && item.date === args[2] && item.version === args[3]);
        if (!row) return [{ affectedRows: 0 }];
        return update(next => {
          const current = next.workouts.find(item => item.user_id === args[1] && item.date === args[2]);
          current.entries_json = args[0];
          current.version++;
          return { affectedRows: 1 };
        });
      }
      if (sql.startsWith('SELECT DATE_FORMAT')) return [state.workouts
        .filter(row => row.user_id === args[0])
        .map(row => ({ ...row, date_key: row.date.split('-').map(Number).join('-') }))];
      throw new Error('Unsupported local database operation.');
    },
  };
}

module.exports = { createLocalDatabase };
