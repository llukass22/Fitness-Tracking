const today = new Date();
let selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const dateKey = date => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const dateLabel = date => date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
function readStored(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
const workouts = {};
const versions = {};
let currentUser = null;
let savingWorkout = false;
let refreshingWorkouts = false;
const draftKey = date => currentUser ? `tracked-draft-${currentUser.id}-${dateKey(date)}` : '';
function loadDraft(date) {
  storageKey = draftKey(date);
  exerciseLog = storageKey ? readStored(storageKey) : {};
  if (!Object.keys(exerciseLog).length) {
    for (const entry of workouts[dateKey(date)] || []) {
      const index = entry.muscle === 'Custom' ? getExerciseNames('Custom').length : (exercisesByMuscle[entry.muscle] || []).indexOf(entry.name);
      if (index >= 0) exerciseLog[entry.muscle + '-' + index] = { ...entry, selected: true };
    }
  }
}
async function requestApi(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && currentUser) showAccount(null);
    const error = new Error(data.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return data;
}
function showAccount(user) {
  currentUser = user;
  for (const key of Object.keys(workouts)) delete workouts[key];
  for (const key of Object.keys(versions)) delete versions[key];
  exerciseLog = {};
  storageKey = draftKey(selectedDate);
  modalOpen = false;
  selectedMuscle = null;
  renderExercises();
  renderCalendar();
  document.getElementById('tracker').hidden = !user;
  document.getElementById('account-card').hidden = !!user;
  document.getElementById('account-email').textContent = user?.email || '';
  document.getElementById('sign-out').hidden = !user;
  document.getElementById('refresh-workouts').hidden = !user;
}
async function refreshWorkouts() {
  if (refreshingWorkouts || savingWorkout || !currentUser) return;
  const userId = currentUser.id;
  refreshingWorkouts = true;
  document.getElementById('tracker').inert = true;
  try {
    const data = await requestApi('/api/workouts');
    if (currentUser?.id !== userId) return;
    for (const key of Object.keys(workouts)) delete workouts[key];
    for (const key of Object.keys(versions)) delete versions[key];
    Object.assign(workouts, data.workouts);
    Object.assign(versions, data.versions);
    loadDraft(selectedDate);
    renderCalendar();
    renderExercises();
    document.getElementById('sync-status').textContent = 'Workouts synced. Drafts stay on this device.';
  } finally {
    refreshingWorkouts = false;
    document.getElementById('tracker').inert = false;
  }
}
async function saveWorkout(key, entries) {
  if (!currentUser) throw new Error('Sign in to save your workout.');
  const saved = await requestApi('/api/workouts/' + key, { method: 'PUT', body: JSON.stringify({ entries, version: versions[key] || 0 }) });
  versions[key] = saved.version;
  if (saved.entries.length) workouts[key] = saved.entries;
  else delete workouts[key];
}
async function bootstrapAccount() {
  try {
    const data = await requestApi('/api/session');
    document.getElementById('account-toggle').hidden = !data.registration;
    showAccount(data.user);
    if (data.user) await refreshWorkouts();
    else document.getElementById('sync-status').textContent = 'Sign in or create an account to start.';
  } catch (error) { document.getElementById('sync-status').textContent = error.message + ' Refresh the page to retry.'; }
}
const currentExerciseName = name => {
  if (name === 'Calf Press') return 'Seated Calf Raise';
  if (name === 'Rear Delt Fly') return 'Cable Rare Delt Fly';
  if (name === 'Low Cable Cross Over') return 'High Cable Fly';
  if (name === 'High Cable Cross Over') return 'Low Cable Fly';
  return name;
};
const displayExerciseName = entry => entry.muscle === 'Custom' ? entry.name : currentExerciseName(entry.name);

let displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const monthTitle = document.getElementById('month-title');
const daysContainer = document.getElementById('calendar-days');
const weeklyWorkoutGoal = 3;

function getWeeklyWorkoutProgress(referenceDate = selectedDate) {
  const weekStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  let workoutDays = 0;
  const day = new Date(weekStart);
  for (let index = 0; index < 7; index++) {
    const entries = workouts[dateKey(day)];
    if (Array.isArray(entries) && entries.length > 0) workoutDays++;
    if (index < 6) day.setDate(day.getDate() + 1);
  }
  return {
    weekStart,
    weekEnd: day,
    workoutDays,
    percent: Math.min(100, Math.round(workoutDays / weeklyWorkoutGoal * 100)),
  };
}

function renderWeeklyWorkoutProgress() {
  const { weekStart, weekEnd, workoutDays, percent } = getWeeklyWorkoutProgress();
  const rangeOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  document.getElementById('weekly-workout-range').textContent = `${weekStart.toLocaleDateString('en-US', rangeOptions)} – ${weekEnd.toLocaleDateString('en-US', rangeOptions)}`;
  document.getElementById('weekly-workout-count').textContent = `${workoutDays} / ${weeklyWorkoutGoal} days`;
  document.getElementById('weekly-workout-percent').textContent = `${percent}%`;
  const progress = document.getElementById('weekly-workout-progress');
  progress.setAttribute('aria-valuenow', String(percent));
  progress.setAttribute('aria-valuetext', `${workoutDays} workout ${workoutDays === 1 ? 'day' : 'days'} logged; goal ${weeklyWorkoutGoal} days; ${percent}% complete`);
  document.getElementById('weekly-workout-fill').style.transform = `scaleX(${percent / 100})`;
}

function renderCalendar() {
  monthTitle.textContent = displayedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  daysContainer.replaceChildren();
  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const offset = (displayedMonth.getDay() + 6) % 7;
  const numberOfDays = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((offset + numberOfDays) / 7) * 7;
  for (let index = 0; index < cells; index++) {
    const date = new Date(year, month, index - offset + 1);
    const isToday = date.toDateString() === today.toDateString();
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `day${date.getMonth() !== month ? ' outside' : ''}${isToday ? ' today' : ''}`;
    const entries = workouts[dateKey(date)];
    if (Array.isArray(entries) && entries.length) cell.classList.add('logged');
    cell.classList.toggle('selected', dateKey(date) === dateKey(selectedDate));
    cell.setAttribute('aria-pressed', String(dateKey(date) === dateKey(selectedDate)));
    cell.setAttribute('aria-label', date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    if (isToday) cell.setAttribute('aria-current', 'date');
    const label = document.createElement('span');
    label.textContent = date.getDate();
    cell.append(label);
    if (Array.isArray(entries) && entries.length) {
      cell.setAttribute('aria-label', `${cell.getAttribute('aria-label')}, ${entries.length} exercises logged`);
    }
    cell.addEventListener('click', () => {
      selectedDate = date;
      displayedMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      loadDraft(date);
      if (selectedMuscle && selectedMuscle !== 'Cardio') weightUnit.value = exerciseLog[`${selectedMuscle}-0`]?.unit === 'lb' ? 'lb' : 'kg';
      renderExercises();
      renderCalendar();
      document.getElementById('exercise-save-status').textContent = 'Select exercises, enter your values, then submit your workout.';
    });
    daysContainer.append(cell);
  }
  renderWorkout();
  renderWeeklyWorkoutProgress();
}

function renderWorkout() {
  document.getElementById('submission-confirmation').hidden = true;
  document.getElementById('workout-removal-status').textContent = '';
  document.getElementById('workout-date').textContent = dateLabel(selectedDate);
  document.getElementById('training-date').textContent = `Training for ${dateLabel(selectedDate)}`;
  const entries = workouts[dateKey(selectedDate)];
  const hasEntries = Array.isArray(entries) && entries.length > 0;
  document.querySelector('.workout-details').classList.toggle('has-entries', hasEntries);
  const list = document.getElementById('workout-entries');
  list.replaceChildren();
  const summary = document.getElementById('workout-summary');
  summary.hidden = hasEntries;
  summary.textContent = summary.hidden ? '' : 'No workout submitted. Choose your exercises and submit them for this day.';
  if (!Array.isArray(entries)) return;
  entries.forEach((entry, index) => {
    const item = document.createElement('li');
    const details = document.createElement('span');
    details.textContent = entry.muscle === 'Cardio'
      ? `${entry.name} — ${entry.minutes} min · ${entry.kcal} kcal`
      : `${displayExerciseName(entry)} — ${entry.weight} ${entry.unit}${entry.sets !== '' && entry.sets != null ? ` · ${entry.sets} ${Number(entry.sets) === 1 ? 'set' : 'sets'}` : entry.reps !== '' && entry.reps != null ? ` · ${entry.reps} ${Number(entry.reps) === 1 ? 'rep' : 'reps'}` : ''}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-entry';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${displayExerciseName(entry)} from ${dateLabel(selectedDate)}`);
    remove.addEventListener('click', () => removeWorkoutEntry(index));
    item.append(details, remove);
    list.append(item);
  });
}

async function removeWorkoutEntry(index) {
  if (savingWorkout || refreshingWorkouts) return;
  const key = dateKey(selectedDate);
  const entries = workouts[key];
  if (!Array.isArray(entries) || !entries[index]) return;
  const removed = entries[index];
  savingWorkout = true;
  document.getElementById('tracker').inert = true;
  try {
    await saveWorkout(key, entries.filter((_, position) => position !== index));
    const exerciseIndex = removed.muscle === 'Custom' && removed.draftKey ? Number(removed.draftKey.slice(7)) : getExerciseNames(removed.muscle).indexOf(removed.name);
    if (exerciseIndex !== -1) delete exerciseLog[removed.muscle + '-' + exerciseIndex];
    saveExercises();
    renderExercises();
    renderCalendar();
    document.getElementById('workout-removal-status').textContent = displayExerciseName(removed) + ' removed and synced.';
  } catch (error) { document.getElementById('workout-removal-status').textContent = error.message; }
  finally { savingWorkout = false; document.getElementById('tracker').inert = false; }
}

document.getElementById('previous-month').addEventListener('click', () => {
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById('next-month').addEventListener('click', () => {
  displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
  renderCalendar();
});

const exercisesByMuscle = {
  Cardio: ['Incline Treadmill Walk', 'Treadmill Run'],
  Shoulders: ['Dumbbell Press', 'Dumbbell Lateral Raise', 'Cable Lateral Raise', 'Cable Rare Delt Fly', 'Face Pull', 'Dumbbell Upright Row', 'Hammer Grip Shoulder Press'],
  Chest: ['Dumbbell Bench Press', 'Machine Chest Press', 'Dumbbell Fly', 'Pec Deck Fly', 'Low Cable Fly', 'High Cable Fly', 'Push Ups'],
  Back: ['Lat Pulldown', 'Cable Row', 'Dumbbell Shrug', 'Pull Ups'],
  Legs: ['Leg Extension', 'Leg Press', 'Hack Squat', 'Leg Curl', 'Dumbbell Lunge', 'Seated Calf Raise'],
  // Keep the retired slot so saved values for later Arms exercises stay aligned.
  Arms: ['Dumbbell Curl', 'Cable Curl', 'Barbell Curl', 'Dumbbell Hammer Curl', null, 'Cable Pushdown', 'Cable Overhead Extension', 'Dumbbell Triceps Kickback'],
  Core: ['Plank', 'Ab Rollouts', 'Russian Twists', 'Leg Raises', 'Crunches', 'Mountain Climbers', 'Bicycle Crunches'],
  Custom: [],
};

function getExerciseNames(muscle) {
  if (muscle !== 'Custom') return exercisesByMuscle[muscle] || [];
  const names = [];
  Object.keys(exerciseLog).forEach(key => {
    if (/^Custom-\d+$/.test(key)) names[Number(key.slice(7))] = exerciseLog[key]?.name || '';
  });
  return names;
}
const exerciseImagesByMuscle = {
  Cardio: {
    'Incline Treadmill Walk': 'assets/muscles/incline-treadmill-walk.png',
    'Treadmill Run': 'assets/muscles/treadmill-run.png',
  },
  Shoulders: {
    'Dumbbell Press': 'assets/muscles/dumbbell-press.png',
    'Dumbbell Lateral Raise': 'assets/muscles/dumbbell-lateral-raise.png',
    'Cable Lateral Raise': 'assets/muscles/cable-lateral-raise.png',
    'Cable Rare Delt Fly': 'assets/muscles/rear-delt-cable-fly.png',
    'Face Pull': 'assets/muscles/face-pull.png',
    'Dumbbell Upright Row': 'assets/muscles/dumbbell-upright-row.png',
    'Hammer Grip Shoulder Press': 'assets/muscles/hammer-grip-shoulder-press.png',
  },
  Chest: {
    'Dumbbell Bench Press': 'assets/muscles/dumbbell-bench-press.png',
    'Machine Chest Press': 'assets/muscles/machine-chest-press.png',
    'Dumbbell Fly': 'assets/muscles/dumbbell-fly.png',
    'Pec Deck Fly': 'assets/muscles/pec-deck-fly.png',
    'Low Cable Fly': 'assets/muscles/low-cable-fly.png',
    'High Cable Fly': 'assets/muscles/high-cable-fly.png',
    'Push Ups': 'assets/muscles/push-ups.png',
  },
  Back: {
    'Lat Pulldown': 'assets/muscles/lat-pulldown.png',
    'Cable Row': 'assets/muscles/seated-cable-row.png',
    'Dumbbell Shrug': 'assets/muscles/dumbbell-shrug.png',
    'Pull Ups': 'assets/muscles/pull-up.png',
  },
  Core: {
    'Plank': 'assets/muscles/plank.png',
    'Ab Rollouts': 'assets/muscles/ab-rollout.png',
    'Russian Twists': 'assets/muscles/russian-twists.png',
    'Leg Raises': 'assets/muscles/leg-raises.png',
    'Crunches': 'assets/muscles/crunches.png',
    'Mountain Climbers': 'assets/muscles/mountain-climber.png',
    'Bicycle Crunches': 'assets/muscles/bicycle-crunches.png',
  },
  Legs: {
    'Leg Extension': 'assets/muscles/leg-extension.png',
    'Leg Press': 'assets/muscles/leg-press.png',
    'Hack Squat': 'assets/muscles/hack-squat.png',
    'Leg Curl': 'assets/muscles/leg-curl.png',
    'Dumbbell Lunge': 'assets/muscles/dumbbell-lunge.png',
    'Seated Calf Raise': 'assets/muscles/seated-calf-raise.png',
  },
  Arms: {
    'Dumbbell Curl': 'assets/muscles/dumbbell-curl.png',
    'Cable Curl': 'assets/muscles/cable-curl.png',
    'Barbell Curl': 'assets/muscles/barbell-curl.png',
    'Dumbbell Hammer Curl': 'assets/muscles/dumbbell-hammer-curl.png',
    'Cable Pushdown': 'assets/muscles/cable-pushdown.png',
    'Cable Overhead Extension': 'assets/muscles/cable-overhead-extension.png',
    'Dumbbell Triceps Kickback': 'assets/muscles/dumbbell-triceps-kickback.png',
  },
};
let storageKey = '';
let exerciseLog = {};
const exercisePanel = document.getElementById('exercise-panel');
const exerciseModal = document.getElementById('exercise-modal');
const exerciseList = document.getElementById('exercise-list');
const weightUnit = document.getElementById('weight-unit');
const weightUnitControl = document.getElementById('weight-unit-control');
const exerciseHelp = document.getElementById('exercise-help');
let selectedMuscle = null;
let modalOpen = false;

function closeExerciseModal() {
  const cardToFocus = document.querySelector(`.muscle-card[data-muscle="${selectedMuscle}"]`);
  modalOpen = false;
  selectedMuscle = null;
  renderExercises();
  document.getElementById('selection-status').textContent = 'Choose a training category to set your focus.';
  cardToFocus?.focus();
}

function saveExercises() {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(exerciseLog));
    document.getElementById('exercise-save-status').textContent = 'Draft saved. Submit your workout to add it to the calendar.';
  } catch {
    document.getElementById('exercise-save-status').textContent = 'Browser storage is unavailable. Changes will only last while this page is open.';
  }
}

function addCustomExercise() {
  const index = getExerciseNames('Custom').length;
  exerciseLog[`Custom-${index}`] = { name: '', selected: true, weight: '', sets: '', unit: weightUnit.value === 'lb' ? 'lb' : 'kg' };
  saveExercises();
  renderExercises();
  document.getElementById(`custom-name-${index}`).focus();
}

document.getElementById('add-custom-exercise').addEventListener('click', addCustomExercise);

function renderExercises() {
  exerciseList.replaceChildren();
  exerciseModal.hidden = !modalOpen || !selectedMuscle || (selectedMuscle !== 'Custom' && !exercisesByMuscle[selectedMuscle]?.length);
  document.body.classList.toggle('modal-open', !exerciseModal.hidden);
  if (exerciseModal.hidden) return;
  const isCardio = selectedMuscle === 'Cardio';
  const isCustom = selectedMuscle === 'Custom';
  document.getElementById('add-custom-exercise').hidden = !isCustom;
  exercisePanel.classList.toggle('cardio-panel', isCardio);
  weightUnitControl.hidden = isCardio;
  exerciseHelp.textContent = isCardio
    ? 'Select an activity and record the time and calories you burned.'
    : isCustom ? 'Add any exercise, enter its name, weight and sets. Use 0 for bodyweight.'
    : 'Select your exercises and enter the weight you used and sets. Use 0 for bodyweight.';
  document.getElementById('exercise-title').textContent = `${selectedMuscle} exercises`;
  getExerciseNames(selectedMuscle).forEach((name, index) => {
    if (!name && !isCustom) return;
    const key = `${selectedMuscle}-${index}`;
    const saved = exerciseLog[key];
    const entry = {
      selected: saved?.selected === true,
      weight: typeof saved?.weight === 'string' ? saved.weight : '',
      sets: typeof saved?.sets === 'string' ? saved.sets : '',
      minutes: typeof saved?.minutes === 'string' ? saved.minutes : '',
      kcal: typeof saved?.kcal === 'string' ? saved.kcal : '',
      unit: saved?.unit === 'lb' ? 'lb' : 'kg',
      ...(isCustom ? { name } : {}),
    };
    const row = document.createElement('div');
    row.className = 'exercise-row';
    row.classList.toggle('is-selected', entry.selected);
    const label = document.createElement(isCustom ? 'div' : 'label');
    label.className = 'exercise-choice';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = entry.selected;
    if (isCustom) checkbox.setAttribute('aria-label', 'Include custom exercise in workout');
    const title = document.createElement('span');
    title.textContent = name;
    label.append(checkbox);
    const imagePath = exerciseImagesByMuscle[selectedMuscle]?.[name];
    if (imagePath) {
      const thumbnail = document.createElement('img');
      thumbnail.className = 'exercise-thumbnail';
      thumbnail.src = imagePath;
      thumbnail.alt = '';
      thumbnail.width = 1254;
      thumbnail.height = 1254;
      label.append(thumbnail);
    }
    if (isCustom) {
      const nameLabel = document.createElement('label');
      nameLabel.className = 'custom-exercise-name';
      const nameTitle = document.createElement('span');
      nameTitle.textContent = 'Exercise name';
      const nameInput = document.createElement('input');
      nameInput.id = `custom-name-${index}`;
      nameInput.type = 'text';
      nameInput.maxLength = 160;
      nameInput.placeholder = 'e.g. Bulgarian Split Squat';
      nameInput.value = name;
      nameInput.required = entry.selected;
      nameInput.addEventListener('input', () => {
        entry.name = nameInput.value;
        exerciseLog[key] = entry;
        saveExercises();
      });
      checkbox.addEventListener('change', () => { nameInput.required = checkbox.checked; });
      nameLabel.append(nameTitle, nameInput);
      label.append(nameLabel);
    } else label.append(title);
    const metrics = document.createElement('div');
    metrics.className = isCardio ? 'exercise-metrics cardio-metrics' : 'exercise-metrics';
    const createMetric = (labelText, value, property, step = 'any') => {
      const metric = document.createElement('label');
      metric.className = 'exercise-weight';
      const metricName = document.createElement('span');
      metricName.textContent = labelText;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = step;
      input.placeholder = '0';
      input.value = value;
      input.disabled = !entry.selected;
      input.required = property !== 'sets';
      input.setAttribute('aria-label', `${name} ${labelText}`);
      input.addEventListener('input', () => {
        entry[property] = input.value;
        exerciseLog[key] = entry;
        saveExercises();
      });
      metric.append(metricName, input);
      metrics.append(metric);
      return input;
    };
    const inputs = isCardio
      ? [createMetric('Minutes', entry.minutes, 'minutes', '1'), createMetric('Burned kcal', entry.kcal, 'kcal', '1')]
      : [createMetric(`Weight (${entry.unit})`, entry.weight, 'weight'), createMetric('Sets', entry.sets, 'sets', '1')];
    checkbox.addEventListener('change', () => {
      entry.selected = checkbox.checked;
      row.classList.toggle('is-selected', entry.selected);
      inputs.forEach(input => { input.disabled = !entry.selected; });
      exerciseLog[key] = entry;
      saveExercises();
      if (entry.selected) inputs[0].focus();
    });
    row.addEventListener('click', event => {
      // Let the checkbox and its label handle their native toggle once.
      if (label.contains(event.target)) return;
      // Keep enabled fields and their labels available for editing.
      if (entry.selected && metrics.contains(event.target)) return;
      checkbox.checked = !entry.selected;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    });
    row.append(label, metrics);
    exerciseList.append(row);
  });
}

weightUnit.addEventListener('change', () => {
  if (!selectedMuscle || selectedMuscle === 'Cardio') return;
  getExerciseNames(selectedMuscle).forEach((name, index) => {
    if (!name && selectedMuscle !== 'Custom') return;
    const key = `${selectedMuscle}-${index}`;
    const entry = exerciseLog[key] || { selected: false, weight: '', unit: 'kg' };
    const unit = weightUnit.value;
    if (entry.weight !== '' && entry.unit !== unit) {
      const converted = Number(entry.weight) * (unit === 'lb' ? 2.2046226218 : 1 / 2.2046226218);
      entry.weight = String(Math.round(converted * 100) / 100);
    }
    entry.unit = unit;
    exerciseLog[key] = entry;
  });
  saveExercises();
  renderExercises();
});

document.querySelectorAll('.muscle-card').forEach(card => {
  card.addEventListener('click', () => {
    selectedMuscle = card.dataset.muscle;
    if (selectedMuscle !== 'Cardio') weightUnit.value = exerciseLog[`${selectedMuscle}-0`]?.unit === 'lb' ? 'lb' : 'kg';
    modalOpen = true;
    renderExercises();
    if (selectedMuscle === 'Custom' && !getExerciseNames('Custom').length) addCustomExercise();
    document.getElementById('selection-status').textContent = `${selectedMuscle} exercises opened.`;
  });
});
document.getElementById('workout-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (savingWorkout || refreshingWorkouts) return;
  const entries = [];
  for (const muscle of Object.keys(exercisesByMuscle)) {
    for (const [index, storedName] of getExerciseNames(muscle).entries()) {
      if (!storedName && muscle !== 'Custom') continue;
      const entry = exerciseLog[`${muscle}-${index}`];
      if (!entry?.selected) continue;
      const name = muscle === 'Custom' ? (entry.name || '').trim() : storedName;
      if (!name) {
        selectedMuscle = muscle;
        modalOpen = true;
        renderExercises();
        document.getElementById('exercise-save-status').textContent = 'Enter a name for each selected custom exercise before submitting.';
        document.getElementById(`custom-name-${index}`).focus();
        return;
      }
      const properties = muscle === 'Cardio' ? ['minutes', 'kcal'] : ['weight', 'sets'];
      if (properties.some(property => {
        const value = entry[property];
        if (property === 'sets' && (value === '' || value == null)) return false;
        return value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0
          || ((muscle === 'Cardio' || property === 'sets') && !Number.isInteger(Number(value)));
      })) {
        selectedMuscle = muscle;
        modalOpen = true;
        weightUnit.value = exerciseLog[`${muscle}-0`]?.unit === 'lb' ? 'lb' : 'kg';
        renderExercises();
        document.getElementById('exercise-save-status').textContent = muscle === 'Cardio'
          ? `Enter valid minutes and calories for ${name} before submitting.`
          : `Enter a valid weight for ${name}. Sets must be a non-negative whole number when entered.`;
        document.getElementById('workout-form').reportValidity();
        return;
      }
      entries.push({ ...entry, muscle, name, ...(muscle === 'Custom' ? { draftKey: `Custom-${index}` } : {}) });
    }
  }
  if (!entries.length) {
    document.getElementById('exercise-save-status').textContent = 'Select at least one exercise before submitting.';
    return;
  }
  const key = dateKey(selectedDate);
  savingWorkout = true;
  document.getElementById('tracker').inert = true;
  document.getElementById('exercise-save-status').textContent = 'Saving workout…';
  try {
    await saveWorkout(key, entries);
    renderCalendar();
    closeExerciseModal();
    document.getElementById('selection-status').textContent = 'Workout saved to your account.';
    document.getElementById('submission-confirmation-details').textContent = entries.length + ' exercises · ' + dateLabel(selectedDate) + '. Saved to your account.';
    document.getElementById('submission-confirmation').hidden = false;
  } catch (error) { document.getElementById('exercise-save-status').textContent = error.message + ' Your draft is kept on this device.'; }
  finally { savingWorkout = false; document.getElementById('tracker').inert = false; }
});
document.getElementById('dismiss-submission-confirmation').addEventListener('click', () => {
  document.getElementById('submission-confirmation').hidden = true;
});
document.getElementById('close-exercise-modal').addEventListener('click', closeExerciseModal);
exerciseModal.addEventListener('click', event => {
  if (event.target.dataset.closeModal === 'true') closeExerciseModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && modalOpen) closeExerciseModal();
});
renderCalendar();

let creatingAccount = false;
document.getElementById('account-toggle').addEventListener('click', () => {
  creatingAccount = !creatingAccount;
  document.getElementById('account-submit').textContent = creatingAccount ? 'Create account' : 'Sign in';
  document.getElementById('account-toggle').textContent = creatingAccount ? 'Already have an account? Sign in' : 'Create an account';
  document.getElementById('account-password').autocomplete = creatingAccount ? 'new-password' : 'current-password';
});
document.getElementById('account-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.getElementById('account-submit');
  button.disabled = true;
  try {
    const data = await requestApi(creatingAccount ? '/api/register' : '/api/login', { method: 'POST', body: JSON.stringify({ email: document.getElementById('account-email-input').value, password: document.getElementById('account-password').value }) });
    document.getElementById('account-password').value = '';
    showAccount(data.user);
    await refreshWorkouts();
  } catch (error) { document.getElementById('sync-status').textContent = error.message; }
  finally { button.disabled = false; }
});
document.getElementById('sign-out').addEventListener('click', async () => {
  if (savingWorkout) return;
  try {
    await requestApi('/api/logout', { method: 'POST', body: '{}' });
    showAccount(null);
    document.getElementById('sync-status').textContent = 'Signed out.';
  } catch (error) { document.getElementById('sync-status').textContent = error.message; }
});
document.getElementById('refresh-workouts').addEventListener('click', async () => {
  if (savingWorkout) return;
  try { await refreshWorkouts(); }
  catch (error) { document.getElementById('sync-status').textContent = error.message; }
});
bootstrapAccount();
