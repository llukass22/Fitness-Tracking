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
      exerciseLog = readStored(storageKey);
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
  const list = document.getElementById('workout-entries');
  list.replaceChildren();
  document.getElementById('workout-summary').textContent = Array.isArray(entries) && entries.length
    ? `${entries.length} ${entries.length === 1 ? 'exercise' : 'exercises'} submitted. Select this day to review or update your workout.`
    : 'No workout submitted. Choose your exercises and submit them for this day.';
  if (!Array.isArray(entries)) return;
  entries.forEach((entry, index) => {
    const item = document.createElement('li');
    const details = document.createElement('span');
    details.textContent = entry.muscle === 'Cardio'
      ? `${entry.name} — ${entry.minutes} min · ${entry.kcal} kcal`
      : `${entry.name} — ${entry.weight} ${entry.unit}${entry.sets !== '' && entry.sets != null ? ` · ${entry.sets} ${Number(entry.sets) === 1 ? 'set' : 'sets'}` : entry.reps !== '' && entry.reps != null ? ` · ${entry.reps} ${Number(entry.reps) === 1 ? 'rep' : 'reps'}` : ''}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-entry';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${entry.name} from ${dateLabel(selectedDate)}`);
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
  const exerciseIndex = exercisesByMuscle[removed.muscle]?.indexOf(removed.name) ?? -1;
  if (exerciseIndex !== -1) delete exerciseLog[`${removed.muscle}-${exerciseIndex}`];
  let persisted = true;
  try { localStorage.setItem('form-workouts', JSON.stringify(workouts)); } catch { persisted = false; }
  try { localStorage.setItem(storageKey, JSON.stringify(exerciseLog)); } catch { persisted = false; }
  renderExercises();
  renderCalendar();
  document.getElementById('workout-removal-status').textContent = `${removed.name} removed from ${dateLabel(selectedDate)}.${persisted ? '' : ' Browser storage is unavailable; this removal will only last while the page is open.'}`;
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
  Shoulders: ['Dumbbell Press', 'Dumbbell Lateral Raise', 'Cable Lateral Raise', 'Rear Delt Fly', 'Face Pull', 'Dumbbell Upright Row'],
  Chest: ['Dumbbell Bench Press', 'Dumbbell Fly', 'Cable Chest Fly', 'Pec Deck Fly', 'Low Cable Cross Over', 'High Cable Cross Over', 'Push Ups'],
  Back: ['Lat Pulldown', 'Cable Row', 'Dumbbell Shrug', 'Pull Ups'],
  Legs: ['Leg Extension', 'Leg Press', 'Hack Squat', 'Leg Curl', 'Dumbbell Lunge', 'Calf Press'],
  Arms: ['Dumbbell Curl', 'Cable Curl', 'Barbell Curl', 'Dumbbell Hammer Curl', 'Cable Hammer Curl', 'Cable Pushdown', 'Cable Overhead Extension', 'Dumbbell Triceps Kickback'],
  Core: ['Plank', 'Ab Rollouts', 'Russian Trister', 'Leg Raises', 'Crunches', 'Mountain Climbers', 'Bicycle Crunches'],
};
let storageKey = `form-exercises-${dateKey(selectedDate)}`;
let exerciseLog = readStored(storageKey);
const exercisePanel = document.getElementById('exercise-panel');
const exerciseModal = document.getElementById('exercise-modal');
const exerciseList = document.getElementById('exercise-list');
const weightUnit = document.getElementById('weight-unit');
const weightUnitControl = document.getElementById('weight-unit-control');
const exerciseHelp = document.getElementById('exercise-help');
let selectedMuscle = null;
let modalOpen = false;

function closeExerciseModal() {
  modalOpen = false;
  renderExercises();
  document.querySelector(`.muscle-card[data-muscle="${selectedMuscle}"]`)?.focus();
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
    label.append(checkbox, title);
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
    const wasSelected = card.getAttribute('aria-pressed') === 'true';
    document.querySelectorAll('.muscle-card').forEach(item => item.setAttribute('aria-pressed', 'false'));
    card.setAttribute('aria-pressed', String(!wasSelected));
    selectedMuscle = wasSelected ? null : card.dataset.muscle;
    if (selectedMuscle !== 'Cardio') weightUnit.value = exerciseLog[`${selectedMuscle}-0`]?.unit === 'lb' ? 'lb' : 'kg';
    modalOpen = Boolean(selectedMuscle);
    renderExercises();
    document.getElementById('selection-status').textContent = wasSelected
      ? 'Choose a training category to set your focus.'
      : selectedMuscle === 'Cardio'
        ? 'Cardio selected. Choose your activities below.'
        : `${card.dataset.muscle} selected. Choose your exercises below.`;
  });
});
document.getElementById('workout-form').addEventListener('submit', event => {
  event.preventDefault();
  const entries = [];
  for (const [muscle, names] of Object.entries(exercisesByMuscle)) {
    for (const [index, name] of names.entries()) {
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
        document.querySelectorAll('.muscle-card').forEach(card => card.setAttribute('aria-pressed', String(card.dataset.muscle === muscle)));
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
