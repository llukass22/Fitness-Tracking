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
  Shoulders: ['Seated dumbbell press', 'Lateral raise', 'Front raises', 'Upright row'],
  Chest: ['Dumbbell bench press', 'Push ups', 'Pec deck fly', 'Cable crossover'],
  Back: ['Pull ups', 'Cable row', 'Lat pulldown'],
  Legs: ['Leg extensions', 'Calf raises', 'Leg curl', 'Leg press'],
  Core: ['Plank', 'Ab rollouts', 'Russian twist', 'Leg raises', 'Crunches'],
  Arms: ['Incline dumbbell curl', 'Dumbbell hammer curl', 'Rope pushdowns', 'Barbell curl', 'Dips'],
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
  exercisePanel.hidden = !selectedMuscle;
  if (!selectedMuscle) return;
  document.getElementById('exercise-title').textContent = `${selectedMuscle} exercises`;
  exercisesByMuscle[selectedMuscle].forEach((name, index) => {
    const key = `${selectedMuscle}-${index}`;
    const saved = exerciseLog[key];
    const entry = {
      selected: saved?.selected === true,
      weight: typeof saved?.weight === 'string' ? saved.weight : '',
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
    const weightLabel = document.createElement('label');
    weightLabel.className = 'exercise-weight';
    const weightText = document.createElement('span');
    weightText.textContent = `Weight (${entry.unit})`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = 'any';
    input.placeholder = '0';
    input.value = entry.weight;
    input.disabled = !entry.selected;
    input.setAttribute('aria-label', `${name} weight in ${entry.unit}`);
    weightLabel.append(weightText, input);
    checkbox.addEventListener('change', () => {
      entry.selected = checkbox.checked;
      input.disabled = !entry.selected;
      exerciseLog[key] = entry;
      saveExercises();
      if (entry.selected) input.focus();
    });
    input.addEventListener('input', () => {
      if (!input.validity.valid) return;
      entry.weight = input.value;
      exerciseLog[key] = entry;
      saveExercises();
    });
    row.append(label, weightLabel);
    exerciseList.append(row);
  });
}

weightUnit.addEventListener('change', () => {
  if (!selectedMuscle) return;
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
    weightUnit.value = exerciseLog[`${selectedMuscle}-0`]?.unit === 'lb' ? 'lb' : 'kg';
    renderExercises();
    document.getElementById('selection-status').textContent = wasSelected
      ? 'Choose a muscle group to set your focus.'
      : `${card.dataset.muscle} selected. Choose your exercises below.`;
  });
});
renderCalendar();
