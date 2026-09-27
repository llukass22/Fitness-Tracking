const today = new Date();
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
    const cell = document.createElement('div');
    cell.className = `day${date.getMonth() !== month ? ' outside' : ''}${isToday ? ' today' : ''}`;
    cell.setAttribute('aria-label', date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    if (isToday) cell.setAttribute('aria-current', 'date');
    const label = document.createElement('span');
    label.textContent = date.getDate();
    cell.append(label);
    daysContainer.append(cell);
  }
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
const storageKey = `form-exercises-${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
let exerciseLog = {};
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) exerciseLog = stored;
} catch {
  // Keep the exercise picker usable when browser storage is unavailable.
}
const exercisePanel = document.getElementById('exercise-panel');
const exerciseList = document.getElementById('exercise-list');
const weightUnit = document.getElementById('weight-unit');
const weightUnitControl = document.getElementById('weight-unit-control');
const exerciseHelp = document.getElementById('exercise-help');
let selectedMuscle = null;

function saveExercises() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(exerciseLog));
    document.getElementById('exercise-save-status').textContent = 'Changes saved on this device for today.';
  } catch {
    document.getElementById('exercise-save-status').textContent = 'Browser storage is unavailable. Changes will only last while this page is open.';
  }
}

function renderExercises() {
  exerciseList.replaceChildren();
  exercisePanel.hidden = !selectedMuscle || !exercisesByMuscle[selectedMuscle]?.length;
  if (exercisePanel.hidden) return;
  const isCardio = selectedMuscle === 'Cardio';
  exercisePanel.classList.toggle('cardio-panel', isCardio);
  weightUnitControl.hidden = isCardio;
  exerciseHelp.textContent = isCardio
    ? 'Select an activity and record the time and calories you burned.'
    : 'Select your exercises and enter the weight you used. Use 0 for bodyweight.';
  document.getElementById('exercise-title').textContent = `${selectedMuscle} exercises`;
  exercisesByMuscle[selectedMuscle].forEach((name, index) => {
    const key = `${selectedMuscle}-${index}`;
    const saved = exerciseLog[key];
    const entry = {
      selected: saved?.selected === true,
      weight: typeof saved?.weight === 'string' ? saved.weight : '',
      minutes: typeof saved?.minutes === 'string' ? saved.minutes : '',
      kcal: typeof saved?.kcal === 'string' ? saved.kcal : '',
      unit: saved?.unit === 'lb' ? 'lb' : 'kg',
    };
    const row = document.createElement('div');
    row.className = 'exercise-row';
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
      input.setAttribute('aria-label', `${name} ${labelText}`);
      input.addEventListener('input', () => {
        if (!input.validity.valid) return;
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
      : [createMetric(`Weight (${entry.unit})`, entry.weight, 'weight')];
    checkbox.addEventListener('change', () => {
      entry.selected = checkbox.checked;
      inputs.forEach(input => { input.disabled = !entry.selected; });
      exerciseLog[key] = entry;
      saveExercises();
      if (entry.selected) inputs[0].focus();
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
    renderExercises();
    document.getElementById('selection-status').textContent = wasSelected
      ? 'Choose a training category to set your focus.'
      : selectedMuscle === 'Cardio'
        ? 'Cardio selected. Your focus for today.'
        : `${card.dataset.muscle} selected. Choose your exercises below.`;
  });
});
renderCalendar();
