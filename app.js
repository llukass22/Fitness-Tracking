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
const workouts = readStored('form-workouts');
const currentExerciseName = name => {
  if (name === 'Calf Press') return 'Seated Calf Raise';
  if (name === 'Rear Delt Fly') return 'Cable Rare Delt Fly';
  if (name === 'Low Cable Cross Over') return 'High Cable Fly';
  if (name === 'High Cable Cross Over') return 'Low Cable Fly';
  return name;
};

function migrateExerciseLog(log) {
  if (log.__chestOrder === 2) return log;
  const reorderedChestEntries = [
    log['Chest-0'],
    log['Chest-7'],
    log['Chest-1'],
    log['Chest-3'],
    log['Chest-5'],
    log['Chest-4'],
    log['Chest-6'],
  ];
  Object.keys(log).forEach(key => {
    if (key.startsWith('Chest-')) delete log[key];
  });
  reorderedChestEntries.forEach((entry, index) => {
    if (entry) log[`Chest-${index}`] = entry;
  });
  log.__chestOrder = 2;
  return log;
}
let displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const monthTitle = document.getElementById('month-title');
const daysContainer = document.getElementById('calendar-days');

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
      storageKey = `form-exercises-${dateKey(date)}`;
      exerciseLog = migrateExerciseLog(readStored(storageKey));
      if (selectedMuscle && selectedMuscle !== 'Cardio') weightUnit.value = exerciseLog[`${selectedMuscle}-0`]?.unit === 'lb' ? 'lb' : 'kg';
      renderExercises();
      renderCalendar();
      document.getElementById('exercise-save-status').textContent = 'Select exercises, enter your values, then submit your workout.';
    });
    daysContainer.append(cell);
  }
  renderWorkout();
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
      : `${currentExerciseName(entry.name)} — ${entry.weight} ${entry.unit}${entry.sets !== '' && entry.sets != null ? ` · ${entry.sets} ${Number(entry.sets) === 1 ? 'set' : 'sets'}` : entry.reps !== '' && entry.reps != null ? ` · ${entry.reps} ${Number(entry.reps) === 1 ? 'rep' : 'reps'}` : ''}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-entry';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${currentExerciseName(entry.name)} from ${dateLabel(selectedDate)}`);
    remove.addEventListener('click', () => removeWorkoutEntry(index));
    item.append(details, remove);
    list.append(item);
  });
}

function removeWorkoutEntry(index) {
  const key = dateKey(selectedDate);
  const entries = workouts[key];
  if (!Array.isArray(entries) || !entries[index]) return;
  const [removed] = entries.splice(index, 1);
  if (!entries.length) delete workouts[key];
  const exerciseName = removed.muscle === 'Core' && removed.name === 'Russian Trister' ? 'Russian Twists' : currentExerciseName(removed.name);
  const exerciseIndex = exercisesByMuscle[removed.muscle]?.indexOf(exerciseName) ?? -1;
  if (exerciseIndex !== -1) delete exerciseLog[`${removed.muscle}-${exerciseIndex}`];
  let persisted = true;
  try { localStorage.setItem('form-workouts', JSON.stringify(workouts)); } catch { persisted = false; }
  try { localStorage.setItem(storageKey, JSON.stringify(exerciseLog)); } catch { persisted = false; }
  renderExercises();
  renderCalendar();
  document.getElementById('workout-removal-status').textContent = `${currentExerciseName(removed.name)} removed from ${dateLabel(selectedDate)}.${persisted ? '' : ' Browser storage is unavailable; this removal will only last while the page is open.'}`;
  const items = document.getElementById('workout-entries').children;
  if (items.length) items[Math.min(index, items.length - 1)].lastElementChild.focus();
  else document.getElementById('workout-summary').focus();
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
};
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
let storageKey = `form-exercises-${dateKey(selectedDate)}`;
let exerciseLog = migrateExerciseLog(readStored(storageKey));
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
  try {
    localStorage.setItem(storageKey, JSON.stringify(exerciseLog));
    document.getElementById('exercise-save-status').textContent = 'Draft saved. Submit your workout to add it to the calendar.';
  } catch {
    document.getElementById('exercise-save-status').textContent = 'Browser storage is unavailable. Changes will only last while this page is open.';
  }
}

function renderExercises() {
  exerciseList.replaceChildren();
  exerciseModal.hidden = !modalOpen || !selectedMuscle || !exercisesByMuscle[selectedMuscle]?.length;
  document.body.classList.toggle('modal-open', !exerciseModal.hidden);
  if (exerciseModal.hidden) return;
  const isCardio = selectedMuscle === 'Cardio';
  exercisePanel.classList.toggle('cardio-panel', isCardio);
  weightUnitControl.hidden = isCardio;
  exerciseHelp.textContent = isCardio
    ? 'Select an activity and record the time and calories you burned.'
    : 'Select your exercises and enter the weight you used and sets. Use 0 for bodyweight.';
  document.getElementById('exercise-title').textContent = `${selectedMuscle} exercises`;
  exercisesByMuscle[selectedMuscle].forEach((name, index) => {
    if (!name) return;
    const key = `${selectedMuscle}-${index}`;
    const saved = exerciseLog[key];
    const entry = {
      selected: saved?.selected === true,
      weight: typeof saved?.weight === 'string' ? saved.weight : '',
      sets: typeof saved?.sets === 'string' ? saved.sets : '',
      minutes: typeof saved?.minutes === 'string' ? saved.minutes : '',
      kcal: typeof saved?.kcal === 'string' ? saved.kcal : '',
      unit: saved?.unit === 'lb' ? 'lb' : 'kg',
    };
    const row = document.createElement('div');
    row.className = 'exercise-row';
    row.classList.toggle('is-selected', entry.selected);
    const label = document.createElement('label');
    label.className = 'exercise-choice';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = entry.selected;
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
    label.append(title);
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
  exercisesByMuscle[selectedMuscle].forEach((name, index) => {
    if (!name) return;
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
    document.getElementById('selection-status').textContent = `${selectedMuscle} exercises opened.`;
  });
});
document.getElementById('workout-form').addEventListener('submit', event => {
  event.preventDefault();
  const entries = [];
  for (const [muscle, names] of Object.entries(exercisesByMuscle)) {
    for (const [index, name] of names.entries()) {
      if (!name) continue;
      const entry = exerciseLog[`${muscle}-${index}`];
      if (!entry?.selected) continue;
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
      entries.push({ ...entry, muscle, name });
    }
  }
  if (!entries.length) {
    document.getElementById('exercise-save-status').textContent = 'Select at least one exercise before submitting.';
    return;
  }
  workouts[dateKey(selectedDate)] = entries;
  let persisted = true;
  try { localStorage.setItem('form-workouts', JSON.stringify(workouts)); } catch { persisted = false; }
  renderCalendar();
  const submissionStatus = `Workout submitted for ${dateLabel(selectedDate)}.${persisted ? ' Saved on this device.' : ' Browser storage is unavailable; this workout will only last while the page is open.'}`;
  document.getElementById('exercise-save-status').textContent = submissionStatus;
  closeExerciseModal();
  document.getElementById('selection-status').textContent = submissionStatus;
  const confirmation = document.getElementById('submission-confirmation');
  confirmation.classList.toggle('storage-unavailable', !persisted);
  document.getElementById('submission-confirmation-details').textContent = `${entries.length} ${entries.length === 1 ? 'exercise' : 'exercises'} · ${dateLabel(selectedDate)}. ${persisted ? 'Saved on this device.' : 'Available while this page is open; browser storage is unavailable.'}`;
  confirmation.hidden = false;
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
