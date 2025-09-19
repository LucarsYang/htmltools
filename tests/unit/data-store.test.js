import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultClasses,
  ensureClassesIntegrity,
  loadClasses,
  saveClasses,
  getClassNames,
  getInitialClassName,
  resolveImageLabel,
  reorderStudents,
  updateStudentScore,
  DEFAULT_SCORE_BUTTONS,
  DEFAULT_REWARDS,
  DEFAULT_DEDUCTION_ITEMS,
  DEFAULT_SCORE_EVENTS,
  GENDER_IMAGE_LABELS
} from '../../js/students/data-store.js';

function createMemoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

test('createDefaultClasses returns expected template', () => {
  const defaults = createDefaultClasses();
  assert.ok(Array.isArray(defaults['501']));
  assert.deepEqual(defaults.scoreButtons, DEFAULT_SCORE_BUTTONS);
  assert.deepEqual(defaults.rewards, DEFAULT_REWARDS);
  assert.deepEqual(defaults.deductionItems, DEFAULT_DEDUCTION_ITEMS);
  assert.deepEqual(defaults.scoreEvents, DEFAULT_SCORE_EVENTS);
});

test('ensureClassesIntegrity repairs missing keys', () => {
  const damaged = { 'A班': [], scoreButtons: [1, 2, 3, 4] };
  const repaired = ensureClassesIntegrity(damaged);
  assert.deepEqual(repaired.scoreButtons, [1, 2, 3, 4]);
  assert.deepEqual(repaired.rewards, DEFAULT_REWARDS);
  assert.ok(Array.isArray(repaired['A班']));
  assert.deepEqual(repaired.deductionItems, DEFAULT_DEDUCTION_ITEMS);
  assert.deepEqual(repaired.scoreEvents, DEFAULT_SCORE_EVENTS);
});

test('ensureClassesIntegrity normalizes score events and links deduction history', () => {
  const rawClasses = {
    '一班': [
      {
        name: '小明',
        score: 10,
        gender: '男',
        deductionHistory: [
          {
            id: 'hist1',
            itemId: 99,
            itemName: '遲到',
            points: -3,
            scoreAfter: 7,
            appliedAt: '2024-01-01T00:00:00.000Z'
          }
        ]
      }
    ],
    scoreButtons: [...DEFAULT_SCORE_BUTTONS],
    rewards: [...DEFAULT_REWARDS],
    deductionItems: [],
    scoreEvents: [
      {
        id: '',
        className: '一班',
        studentName: '小明',
        studentIndex: '0',
        previousScore: '10',
        delta: '2',
        newScore: '12',
        metadata: { source: 'custom' },
        performedAt: ''
      },
      {
        className: '',
        studentName: '',
        studentIndex: null,
        previousScore: null,
        delta: '-3',
        newScore: '7',
        type: 'deduction-item',
        metadata: { historyId: 'hist1' },
        performedAt: ''
      }
    ]
  };

  const normalized = ensureClassesIntegrity(rawClasses);
  const events = normalized.scoreEvents;
  assert.equal(events.length, 2);

  const ids = new Set(events.map(event => event.id));
  assert.equal(ids.size, events.length, 'event ids should be unique');

  const customEvent = events.find(event => event.metadata?.source === 'custom');
  assert.ok(customEvent, 'custom event should exist');
  assert.equal(customEvent.className, '一班');
  assert.equal(customEvent.studentName, '小明');
  assert.equal(customEvent.studentIndex, 0);
  assert.equal(customEvent.delta, 2);
  assert.equal(customEvent.previousScore, 10);
  assert.equal(customEvent.newScore, 12);
  assert.equal(typeof customEvent.performedAt, 'string');

  const historyEvent = events.find(event => event.metadata?.historyId === 'hist1');
  assert.ok(historyEvent, 'history-linked event should exist');
  assert.equal(historyEvent.className, '一班');
  assert.equal(historyEvent.studentName, '小明');
  assert.equal(historyEvent.studentIndex, 0);
  assert.equal(historyEvent.metadata.itemId, 99);
  assert.equal(historyEvent.metadata.itemName, '遲到');
  assert.equal(historyEvent.newScore, 7);
  assert.equal(typeof historyEvent.performedAt, 'string');

  const [student] = normalized['一班'];
  assert.ok(student, 'student should exist after normalization');
  const [historyEntry] = student.deductionHistory;
  assert.ok(historyEntry, 'deduction history should remain');
  assert.equal(historyEntry.eventId, historyEvent.id);
});

test('loadClasses fallback to default when storage empty', () => {
  const storage = createMemoryStorage();
  const data = loadClasses(storage);
  assert.deepEqual(data.scoreButtons, DEFAULT_SCORE_BUTTONS);
  assert.deepEqual(data.rewards, DEFAULT_REWARDS);
  const raw = storage.getItem('classes');
  assert.ok(raw, 'storage should persist defaults');
});

test('loadClasses parses stored value', () => {
  const storage = createMemoryStorage({
    classes: JSON.stringify({ Foo: [], scoreButtons: [9, 8, 7, 6], rewards: ['A', 'B'] })
  });
  const data = loadClasses(storage);
  assert.deepEqual(getClassNames(data), ['Foo']);
  assert.deepEqual(data.scoreButtons, [9, 8, 7, 6]);
  assert.deepEqual(data.rewards, ['A', 'B']);
});

test('saveClasses persists data to storage', () => {
  const storage = createMemoryStorage();
  const classes = createDefaultClasses();
  classes['501'].push({ name: '測試', score: 10 });
  saveClasses(storage, classes);
  const stored = JSON.parse(storage.getItem('classes'));
  assert.equal(stored['501'][0].name, '測試');
});

test('getInitialClassName prefers existing class names', () => {
  const classes = { Foo: [], Bar: [], scoreButtons: DEFAULT_SCORE_BUTTONS, rewards: DEFAULT_REWARDS };
  assert.equal(getInitialClassName(classes), 'Foo');
  delete classes.Foo;
  assert.equal(getInitialClassName(classes), 'Bar');
});

test('resolveImageLabel respects gender lists', () => {
  const result = resolveImageLabel({ gender: '男', selectedLabel: '男2' });
  assert.equal(result, '男2');
  const fallback = resolveImageLabel({ gender: '女', selectedLabel: '男2' });
  assert.equal(fallback, GENDER_IMAGE_LABELS['女'][0]);
});

test('reorderStudents repositions entries immutably', () => {
  const original = [1, 2, 3];
  const reordered = reorderStudents(original, 0, 2);
  assert.deepEqual(reordered, [2, 3, 1]);
  assert.deepEqual(original, [1, 2, 3], 'original should remain untouched');
});

test('updateStudentScore adjusts score of selected record', () => {
  const students = [{ name: 'A', score: 5 }];
  const updated = updateStudentScore(students, 0, 3);
  assert.equal(updated[0].score, 8);
  assert.notEqual(updated, students, 'returns new array');
});
