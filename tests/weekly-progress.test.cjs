const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

// Exercise the existing application and its submit/remove handlers without a browser dependency.
function loadApp(stored = {}, initialWorkouts = {}) {
  class Element {
    constructor() {
      this.children = [];
      this.attributes = {};
      this.listeners = {};
      this.style = {};
      this.dataset = {};
      this.classList = { add() {}, toggle() {} };
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name]; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    append(...children) { this.children.push(...children); }
    replaceChildren() { this.children = []; }
    get lastElementChild() { return this.children.at(-1); }
    focus() {}
    reportValidity() { return true; }
  }
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const storage = new Map(Object.entries(stored));
  const context = vm.createContext({
    document: {
      getElementById: element,
      createElement: () => new Element(),
      querySelector: element,
      querySelectorAll: () => [],
      addEventListener() {},
      body: new Element(),
    },
    fetch: async (url, options = {}) => {
      if (url === '/api/session') return { ok: true, json: async () => ({ user: null, registration: true }) };
      if (url.startsWith('/api/workouts/')) {
        const body = JSON.parse(options.body);
        return { ok: true, json: async () => ({ entries: body.entries, version: body.version + 1 }) };
      }
      throw new Error('Unexpected request: ' + url);
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
  });
  const run = code => vm.runInContext(code, context);
  run(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8').replace(/bootstrapAccount\(\);\s*$/, ''));
  run("currentUser = { id: 1, email: 'test@example.com' }; loadDraft(selectedDate);");
  run('Object.assign(workouts, ' + JSON.stringify(initialWorkouts) + ')');
  const progress = date => JSON.parse(run(`JSON.stringify(getWeeklyWorkoutProgress(new Date(${JSON.stringify(date)})))`));
  return { element, storage, run, progress };
}

test('counts unique submitted days with the required rounded and capped percentages', () => {
  const app = loadApp({ 'form-exercises-2026-9-28': JSON.stringify({ 'Back-0': { selected: true } }) });
  assert.equal(app.progress('2026-10-01T12:00:00').percent, 0, 'drafts do not count');
  const expected = [0, 33, 67, 100, 100, 100, 100, 100];
  for (let days = 0; days <= 7; days++) {
    const result = app.progress('2026-10-01T12:00:00');
    assert.equal(result.workoutDays, days);
    assert.equal(result.percent, expected[days]);
    if (days < 7) app.run(`workouts[dateKey(new Date(2026, 8, 28 + ${days}))] = [{ name: 'A' }, { name: 'B' }];`);
  }
});

test('uses Monday–Sunday across month and year boundaries, excluding adjacent weeks and empty logs', () => {
  const app = loadApp({}, {
    '2026-12-27': [{ name: 'Previous week' }],
    '2026-12-28': [{ name: 'Monday' }],
    '2026-12-29': [],
    '2026-12-30': null,
    '2026-12-31': {},
    '2027-1-3': [{ name: 'Sunday' }],
    '2027-1-4': [{ name: 'Next week' }],
  });
  for (const date of ['2026-12-28T00:00:00', '2027-01-01T12:00:00', '2027-01-03T23:59:59']) {
    const result = app.progress(date);
    assert.equal(result.workoutDays, 2);
    assert.equal(result.percent, 67);
  }
  assert.equal(app.progress('2027-01-04T00:00:00').workoutDays, 1);
  assert.equal(app.progress('2026-09-27T23:59:59').workoutDays, 0);
});

test('updates the same progress bar on submission, resubmission, removal and calendar selection', async () => {
  const app = loadApp();
  app.run(`
    selectedDate = new Date(2026, 8, 28);
    storageKey = 'form-exercises-' + dateKey(selectedDate);
    exerciseLog = {
      'Back-0': { selected: true, weight: '20', sets: '3', unit: 'kg' },
      'Back-1': { selected: true, weight: '30', sets: '3', unit: 'kg' },
    };
  `);
  const bar = app.element('weekly-workout-progress');
  const fill = app.element('weekly-workout-fill');
  const submit = () => app.element('workout-form').listeners.submit({ preventDefault() {} });
  await submit();
  assert.equal(bar.attributes['aria-valuenow'], '33');
  assert.equal(fill.style.transform, 'scaleX(0.33)');
  assert.equal(app.element('weekly-workout-count').textContent, '1 / 3 days');
  await submit();
  assert.equal(app.progress('2026-09-28T12:00:00').workoutDays, 1);
  assert.equal(app.run("workouts['2026-9-28'].length"), 2);
  assert.equal(app.storage.has('form-workouts'), false, 'submitted workouts are not saved in browser storage');
  await app.run('removeWorkoutEntry(0)');
  assert.equal(bar.attributes['aria-valuenow'], '33');
  await app.run('removeWorkoutEntry(0)');
  assert.equal(bar.attributes['aria-valuenow'], '0');
  assert.equal(fill.style.transform, 'scaleX(0)');
  assert.equal(app.progress('2026-09-28T12:00:00').workoutDays, 0);
  app.run(`workouts['2026-10-5'] = [{ muscle: 'Back', name: 'Lat Pulldown', weight: '20', unit: 'kg' }]; renderCalendar();`);
  assert.equal(bar.attributes['aria-valuenow'], '0');
  const day = app.element('calendar-days').children.find(cell => cell.attributes['aria-label'].startsWith('Monday, October 5, 2026'));
  day.listeners.click();
  assert.equal(bar.attributes['aria-valuenow'], '33');
  assert.match(app.element('weekly-workout-range').textContent, /Oct 5, 2026.*Oct 11, 2026/);
  assert.equal(app.element('weekly-workout-fill'), fill, 'preserves the fill element for CSS transitions');
});

test('custom exercises preserve names, convert weights, reload drafts and remove duplicate names independently', async () => {
  const app = loadApp();
  app.run(`selectedMuscle = 'Custom'; modalOpen = true; weightUnit.value = 'kg'; addCustomExercise(); addCustomExercise();`);
  const rows = app.element('exercise-list').children;
  rows.forEach((row, index) => {
    const name = row.children[0].children[1].children[1];
    name.value = 'Calf Press';
    name.listeners.input();
    const weight = row.children[1].children[0].children[1];
    weight.value = String(10 + index);
    weight.listeners.input();
    const sets = row.children[1].children[1].children[1];
    sets.value = '3';
    sets.listeners.input();
    const minutes = row.children[1].children[2].children[1];
    minutes.value = '15';
    minutes.listeners.input();
    const kcal = row.children[1].children[3].children[1];
    kcal.value = '100';
    kcal.listeners.input();
  });
  app.element('weight-unit').value = 'lb';
  app.element('weight-unit').listeners.change();
  assert.equal(app.run("exerciseLog['Custom-0'].weight"), '22.05');
  assert.equal(app.run("exerciseLog['Custom-1'].weight"), '24.25');
  const reloaded = loadApp(Object.fromEntries(app.storage));
  await reloaded.element('workout-form').listeners.submit({ preventDefault() {} });
  const key = reloaded.run('dateKey(selectedDate)');
  const entries = JSON.parse(reloaded.run('JSON.stringify(workouts)'))[key];
  assert.equal(entries.length, 2);
  assert.equal(entries[0].name, 'Calf Press');
  assert.equal(entries[0].muscle, 'Custom');
  assert.equal(entries[0].sets, '3');
  assert.equal(entries[0].unit, 'lb');
  assert.equal(entries[0].minutes, '15');
  assert.equal(entries[0].kcal, '100');
  assert.match(reloaded.element('workout-entries').children[0].children[0].textContent, /^Calf Press — 22.05 lb/);
  assert.match(reloaded.element('workout-entries').children[0].children[0].textContent, /15 min · 100 kcal$/);
  await reloaded.run('removeWorkoutEntry(1)');
  assert.equal(reloaded.run("exerciseLog['Custom-1']"), undefined);
  assert.equal(reloaded.run("exerciseLog['Custom-0'].name"), 'Calf Press');
  reloaded.run("selectedMuscle = 'Custom'; modalOpen = true; weightUnit.value = 'lb'; addCustomExercise();");
  assert.equal(reloaded.run("exerciseLog['Custom-1'].unit"), 'lb');
});

test('custom exercise submission rejects blank names and invalid weights or sets', async () => {
  const app = loadApp();
  const submit = () => app.element('workout-form').listeners.submit({ preventDefault() {} });
  app.run(`exerciseLog['Custom-0'] = { name: '   ', selected: true, weight: '10', sets: '3', unit: 'kg' };`);
  await submit();
  assert.match(app.element('exercise-save-status').textContent, /Enter a name/);
  assert.equal(app.storage.get('form-workouts'), undefined);
  app.element('workout-form').reportValidity = () => {};
  for (const values of [{ weight: '-1', sets: '3' }, { weight: '10', sets: '1.5' }, { weight: '10', sets: '3', minutes: '-1' }, { minutes: '1.5' }, { minutes: '0', kcal: '-1' }, { kcal: '2.5' }]) {
    app.run(`Object.assign(exerciseLog['Custom-0'], { name: ' My exercise ', ...${JSON.stringify(values)} });`);
    await submit();
    assert.equal(app.run('Object.keys(workouts).length'), 0);
  }
  app.run(`Object.assign(exerciseLog['Custom-0'], { weight: '0', sets: '', minutes: '', kcal: '' });`);
  await submit();
  const entries = JSON.parse(app.run('JSON.stringify(workouts)'))[app.run('dateKey(selectedDate)')];
  assert.equal(entries[0].name, 'My exercise');
  assert.equal(entries[0].weight, '0');
});

test('submits strength, cardio and custom exercises with any one filled metric', async () => {
  for (const [key, entry, expected] of [
    ['Back-0', { selected: true, weight: '', sets: '3', unit: 'kg' }, '3 sets'],
    ['Cardio-0', { selected: true, minutes: '', kcal: '120' }, '120 kcal'],
    ['Custom-0', { selected: true, name: 'Stretching', weight: '', sets: '', minutes: '15', kcal: '', unit: 'kg' }, '15 min'],
  ]) {
    const app = loadApp();
    const submit = () => app.element('workout-form').listeners.submit({ preventDefault() {} });
    app.run(`exerciseLog[${JSON.stringify(key)}] = ${JSON.stringify(entry)};`);
    await submit();
    const saved = JSON.parse(app.run('JSON.stringify(workouts)'))[app.run('dateKey(selectedDate)')];
    assert.equal(saved.length, 1);
    assert.match(app.element('workout-entries').children[0].children[0].textContent, new RegExp(expected));
    assert.equal(app.element('workout-entries').children[0].children[0].textContent.includes('undefined'), false);
  }
  const app = loadApp();
  app.run(`exerciseLog['Back-0'] = { selected: true, weight: '', sets: '', unit: 'kg' };`);
  await app.element('workout-form').listeners.submit({ preventDefault() {} });
  assert.equal(app.run('Object.keys(workouts).length'), 0);
  assert.match(app.element('exercise-save-status').textContent, /at least one value/);
});

test('failed saves preserve drafts and never create a submitted workout', async () => {
  const app = loadApp();
  app.run(`exerciseLog['Back-0'] = { selected: true, weight: '20', sets: '3', unit: 'kg' }; saveExercises(); requestApi = async () => { throw new Error('Database unavailable'); };`);
  await app.element('workout-form').listeners.submit({ preventDefault() {} });
  assert.equal(app.run('Object.keys(workouts).length'), 0);
  assert.equal(app.run('exerciseLog["Back-0"].weight'), '20');
  assert.match(app.element('exercise-save-status').textContent, /Database unavailable/);
  assert.equal(app.run('savingWorkout'), false);
});

test('failed removal keeps the submitted workout and its draft', async () => {
  const app = loadApp();
  app.run(`workouts[dateKey(selectedDate)] = [{ muscle: 'Back', name: 'Lat Pulldown', weight: '20', sets: '3', unit: 'kg' }]; exerciseLog['Back-0'] = { selected: true, weight: '20' }; requestApi = async () => { throw new Error('Conflict'); };`);
  await app.run('removeWorkoutEntry(0)');
  assert.equal(app.run('workouts[dateKey(selectedDate)].length'), 1);
  assert.equal(app.run('exerciseLog["Back-0"].weight'), '20');
  assert.match(app.element('workout-removal-status').textContent, /Conflict/);
});

test('legacy browser data is ignored and drafts are isolated between accounts', () => {
  const app = loadApp({ 'form-workouts': JSON.stringify({ '2026-9-28': [{ name: 'Old workout' }] }), 'form-exercises-2026-9-28': JSON.stringify({ 'Back-0': { selected: true, weight: '99' } }) });
  assert.equal(app.run('Object.keys(workouts).length'), 0);
  app.run(`selectedDate = new Date(2026, 8, 28); loadDraft(selectedDate);`);
  assert.equal(app.run('Object.keys(exerciseLog).length'), 0);
  app.run(`exerciseLog['Back-0'] = { selected: true, weight: '20' }; saveExercises(); showAccount({ id: 2, email: 'other@example.com' }); loadDraft(selectedDate);`);
  assert.equal(app.run('exerciseLog["Back-0"]'), undefined);
  app.run(`showAccount({ id: 1, email: 'test@example.com' }); loadDraft(selectedDate);`);
  assert.equal(app.run('exerciseLog["Back-0"].weight'), '20');
});
