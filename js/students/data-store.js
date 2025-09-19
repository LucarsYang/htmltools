const DEFAULT_CLASS_NAME = '一班';
export const SPECIAL_CLASS_KEYS = ['scoreButtons', 'rewards', 'deductionItems'];
export const DEFAULT_SCORE_BUTTONS = [-5, -1, 1, 5];
export const DEFAULT_REWARDS = ['獎勵', '懲罰'];
export const DEFAULT_DEDUCTION_ITEMS = [];

export const IMAGE_MAP = {
    '男1': 'https://img.icons8.com/?size=100&id=oqlkrpDy3clZ&format=png&color=000000',
    '男2': 'https://img.icons8.com/?size=100&id=C3wj6TWvegSk&format=png&color=000000',
    '男3': 'https://img.icons8.com/?size=100&id=2lwL3N2H9Tbm&format=png&color=000000',
    '女1': 'https://img.icons8.com/?size=100&id=eNAHQgRxtqVv&format=png&color=000000',
    '女2': 'https://img.icons8.com/?size=100&id=DH9FJ32siusV&format=png&color=000000',
    '女3': 'https://img.icons8.com/?size=100&id=gvFfuFtdrY7s&format=png&color=000000'
};

export const GENDER_IMAGE_LABELS = {
    '男': ['男1', '男2', '男3'],
    '女': ['女1', '女2', '女3']
};

export function createDefaultClasses() {
    return {
        '501': [],
        scoreButtons: [...DEFAULT_SCORE_BUTTONS],
        rewards: [...DEFAULT_REWARDS],
        deductionItems: [...DEFAULT_DEDUCTION_ITEMS]
    };
}

function getStorage(storage) {
    if (storage) {
        return storage;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
    }
    return null;
}

export function ensureClassesIntegrity(classes) {
    if (!classes || typeof classes !== 'object') {
        return createDefaultClasses();
    }

    if (!Array.isArray(classes.scoreButtons) || classes.scoreButtons.length !== 4) {
        classes.scoreButtons = [...DEFAULT_SCORE_BUTTONS];
    }

    if (!Array.isArray(classes.rewards)) {
        classes.rewards = [...DEFAULT_REWARDS];
    }

    if (!Array.isArray(classes.deductionItems)) {
        classes.deductionItems = [...DEFAULT_DEDUCTION_ITEMS];
    } else {
        const normalizedItems = [];
        const usedIds = new Set();
        let fallbackId = Date.now();
        classes.deductionItems.forEach((item) => {
            if (!item || typeof item.name !== 'string') return;
            const trimmedName = item.name.trim();
            if (!trimmedName) return;
            const points = Number(item.points);
            if (!Number.isFinite(points)) return;
            let id = typeof item.id === 'number' ? item.id : null;
            while (id === null || usedIds.has(id)) {
                id = fallbackId;
                fallbackId += 1;
            }
            usedIds.add(id);
            normalizedItems.push({ id, name: trimmedName, points });
        });
        classes.deductionItems = normalizedItems;
    }

    let classKeys = Object.keys(classes).filter(key => !SPECIAL_CLASS_KEYS.includes(key));
    if (classKeys.length === 0) {
        classes[DEFAULT_CLASS_NAME] = [];
        classKeys = [DEFAULT_CLASS_NAME];
    }

    classKeys.forEach(className => {
        const students = Array.isArray(classes[className]) ? classes[className] : [];
        const usedHistoryIds = new Set();
        let fallbackId = Date.now();

        classes[className] = students.map(student => {
            const normalized = normalizeStudentRecord(student);
            const history = Array.isArray(student?.deductionHistory) ? student.deductionHistory : [];
            const normalizedHistory = [];

            history.forEach(record => {
                if (!record || typeof record !== 'object') return;
                const rawName = typeof record.itemName === 'string' ? record.itemName.trim() : '';
                const itemName = rawName || '未命名項目';
                const points = Number(record.points);
                if (!Number.isFinite(points)) return;

                let appliedAtValue = typeof record.appliedAt === 'string' ? record.appliedAt : '';
                let appliedDate = appliedAtValue ? new Date(appliedAtValue) : null;
                if (!appliedDate || Number.isNaN(appliedDate.getTime())) {
                    if (typeof record.timestamp === 'string') {
                        const fallbackDate = new Date(record.timestamp);
                        if (!Number.isNaN(fallbackDate.getTime())) {
                            appliedDate = fallbackDate;
                            appliedAtValue = fallbackDate.toISOString();
                        }
                    }
                }
                if (!appliedDate || Number.isNaN(appliedDate.getTime())) {
                    appliedDate = new Date();
                    appliedAtValue = appliedDate.toISOString();
                }

                let recordId = record.id;
                if (typeof recordId !== 'string' && typeof recordId !== 'number') {
                    recordId = null;
                }
                let normalizedId = recordId !== null ? String(recordId) : '';
                while (!normalizedId || usedHistoryIds.has(normalizedId)) {
                    normalizedId = `h-${fallbackId}`;
                    fallbackId += 1;
                }
                usedHistoryIds.add(normalizedId);

                const scoreAfterValue = Number(record.scoreAfter);

                normalizedHistory.push({
                    id: normalizedId,
                    itemId: typeof record.itemId === 'string' || typeof record.itemId === 'number' ? record.itemId : null,
                    itemName,
                    points,
                    scoreAfter: Number.isFinite(scoreAfterValue) ? scoreAfterValue : null,
                    appliedAt: appliedAtValue
                });
            });

            normalizedHistory.sort((a, b) => {
                const timeA = new Date(a.appliedAt).getTime();
                const timeB = new Date(b.appliedAt).getTime();
                return timeA - timeB;
            });

            normalized.deductionHistory = normalizedHistory;
            return normalized;
        });
    });

    return classes;
}

export function loadClasses(storage) {
    const store = getStorage(storage);
    if (!store) {
        return createDefaultClasses();
    }

    const raw = store.getItem('classes');
    if (!raw) {
        const defaults = createDefaultClasses();
        store.setItem('classes', JSON.stringify(defaults));
        return defaults;
    }

    try {
        const parsed = JSON.parse(raw);
        return ensureClassesIntegrity(parsed);
    } catch (error) {
        console.warn('classes 資料格式錯誤，使用預設值', error);
        const defaults = createDefaultClasses();
        store.setItem('classes', JSON.stringify(defaults));
        return defaults;
    }
}

export function saveClasses(storage, classes) {
    const store = getStorage(storage);
    if (!store) return;
    store.setItem('classes', JSON.stringify(classes));
}

export function getClassNames(classes) {
    return Object.keys(classes).filter(key => !SPECIAL_CLASS_KEYS.includes(key));
}

export function getInitialClassName(classes) {
    const classNames = getClassNames(classes);
    return classNames[0] || DEFAULT_CLASS_NAME;
}

export function normalizeStudentRecord(student) {
    const base = {
        name: '',
        score: 0,
        gender: '男',
        imageLabel: '',
        customImage: null,
        customImageFileId: null,
        deductionHistory: []
    };
    return { ...base, ...student };
}

export function reorderStudents(students, fromIndex, toIndex) {
    if (fromIndex === toIndex) {
        return students;
    }
    const cloned = [...students];
    const [item] = cloned.splice(fromIndex, 1);
    cloned.splice(toIndex, 0, item);
    return cloned;
}

export function updateStudentScore(students, index, delta) {
    const updated = students.map((student, idx) => {
        if (idx !== index) return student;
        const normalized = normalizeStudentRecord(student);
        return { ...normalized, score: normalized.score + delta };
    });
    return updated;
}

export function resolveImageLabel({ gender, selectedLabel }) {
    const labels = GENDER_IMAGE_LABELS[gender] || GENDER_IMAGE_LABELS['男'];
    return selectedLabel && labels.includes(selectedLabel) ? selectedLabel : labels[0];
}
