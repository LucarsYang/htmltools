const OVERLAY_ID = 'randomPickerOverlay';
const MODAL_ID = 'randomPickerModal';
const RANGE_START_ID = 'randomPickerRangeStart';
const RANGE_END_ID = 'randomPickerRangeEnd';
const PICK_COUNT_ID = 'randomPickerPickCount';
const EXCLUSION_ID = 'randomPickerExclusions';
const MESSAGE_ID = 'randomPickerMessage';
const RESULT_LIST_ID = 'randomPickerResultList';
const ACTION_ID = 'randomPickerAction';
const SUMMARY_ID = 'randomPickerSummary';
const RESULT_OVERLAY_ID = 'randomPickerResultOverlay';
const RESULT_GRID_ID = 'randomPickerResultGrid';

const DEFAULT_RANGE_MAX = 30;
const RANGE_EXPAND_STEP = 10;

const state = {
    rangeStart: 1,
    rangeEnd: 0,
    pickCount: 1,
    excluded: new Set(),
    maxOption: DEFAULT_RANGE_MAX
};

let getStudentsRef = () => [];
let getCurrentClassRef = () => '';
let overlayEl = null;
let modalEl = null;
let rangeStartEl = null;
let rangeEndEl = null;
let pickCountEl = null;
let exclusionsEl = null;
let messageEl = null;
let resultListEl = null;
let actionEl = null;
let summaryEl = null;
let emptyStateEl = null;
let settingsWrapperEl = null;
let expandEl = null;
let expandIconEl = null;
let resultOverlayEl = null;
let resultGridEl = null;
let resultInnerEl = null;
let resultCloseEl = null;
let lastTrigger = null;
let isInitialized = false;
let escHandler = null;
let isModalExpanded = false;
let resultEscHandler = null;

function createOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.className = 'random-picker-overlay';
    overlayEl.innerHTML = `
        <div class="random-picker-modal" id="${MODAL_ID}" role="dialog" aria-modal="true" aria-labelledby="randomPickerTitle">
            <div class="random-picker-header">
                <div class="random-picker-header-main">
                    <h2 class="random-picker-title" id="randomPickerTitle">🎲 隨機選人</h2>
                    <p class="random-picker-subtitle" id="${SUMMARY_ID}"></p>
                </div>
                <div class="random-picker-header-actions">
                    <button type="button" class="random-picker-expand" data-random-expand aria-pressed="false" aria-label="放大顯示隨機選人視窗"><span aria-hidden="true">⤢</span></button>
                    <button type="button" class="random-picker-close" data-random-close aria-label="關閉隨機選人面板"><span aria-hidden="true">×</span></button>
                </div>
            </div>
            <div class="random-picker-body">
                <div class="random-picker-empty-state" data-random-empty hidden>目前班級沒有學生，請先建立學生資料。</div>
                <div class="random-picker-settings" data-random-settings>
                    <section class="random-picker-section" aria-label="號碼範圍設定">
                        <h3 class="random-picker-section-title">號碼範圍</h3>
                        <div class="random-picker-fieldset">
                            <label class="random-picker-label" for="${RANGE_START_ID}">
                                <span>起始號碼</span>
                                <select id="${RANGE_START_ID}" class="random-picker-select"></select>
                            </label>
                            <label class="random-picker-label" for="${RANGE_END_ID}">
                                <span>結束號碼</span>
                                <select id="${RANGE_END_ID}" class="random-picker-select"></select>
                            </label>
                        </div>
                    </section>

                    <section class="random-picker-section" aria-label="選取人數設定">
                        <h3 class="random-picker-section-title">選取人數</h3>
                        <div class="random-picker-fieldset">
                            <label class="random-picker-label" for="${PICK_COUNT_ID}">
                                <span>抽選人數</span>
                                <input type="number" id="${PICK_COUNT_ID}" class="random-picker-input" min="1" value="1">
                            </label>
                        </div>
                    </section>

                    <section class="random-picker-section" aria-label="排除號碼設定">
                        <h3 class="random-picker-section-title">排除號碼</h3>
                        <p class="random-picker-hint">勾選不參與抽選的號碼。</p>
                        <div class="random-picker-exclusions" id="${EXCLUSION_ID}"></div>
                    </section>

                    <section class="random-picker-section random-picker-result" aria-live="polite" aria-label="抽選結果">
                        <h3 class="random-picker-section-title">抽選結果</h3>
                        <div class="random-picker-message" id="${MESSAGE_ID}"></div>
                        <div class="random-picker-result-list" id="${RESULT_LIST_ID}"></div>
                    </section>
                </div>
            </div>
            <div class="random-picker-footer">
                <button type="button" class="random-picker-action" id="${ACTION_ID}">隨機抽選</button>
            </div>
        </div>
    `;

    const host = document.getElementById('random-picker-root');
    (host || document.body).appendChild(overlayEl);

    modalEl = overlayEl.querySelector(`#${MODAL_ID}`);
    rangeStartEl = overlayEl.querySelector(`#${RANGE_START_ID}`);
    rangeEndEl = overlayEl.querySelector(`#${RANGE_END_ID}`);
    pickCountEl = overlayEl.querySelector(`#${PICK_COUNT_ID}`);
    exclusionsEl = overlayEl.querySelector(`#${EXCLUSION_ID}`);
    messageEl = overlayEl.querySelector(`#${MESSAGE_ID}`);
    resultListEl = overlayEl.querySelector(`#${RESULT_LIST_ID}`);
    actionEl = overlayEl.querySelector(`#${ACTION_ID}`);
    summaryEl = overlayEl.querySelector(`#${SUMMARY_ID}`);
    emptyStateEl = overlayEl.querySelector('[data-random-empty]');
    settingsWrapperEl = overlayEl.querySelector('[data-random-settings]');
    expandEl = overlayEl.querySelector('[data-random-expand]');
    expandIconEl = expandEl?.querySelector('span') || null;

    overlayEl.addEventListener('click', (event) => {
        if (event.target === overlayEl) {
            closeOverlay();
        }
    });

    overlayEl.querySelector('[data-random-close]')?.addEventListener('click', closeOverlay);
    expandEl?.addEventListener('click', handleExpandToggle);
    rangeStartEl?.addEventListener('change', handleRangeChange);
    rangeEndEl?.addEventListener('change', handleRangeChange);
    pickCountEl?.addEventListener('input', handlePickCountInput);
    exclusionsEl?.addEventListener('change', handleExclusionChange);
    actionEl?.addEventListener('click', handleRandomPick);

    applyExpandedState();

    createResultOverlay();
}

function handleExpandToggle() {
    isModalExpanded = !isModalExpanded;
    applyExpandedState();
    modalEl?.focus({ preventScroll: true });
}

function applyExpandedState() {
    if (!modalEl || !expandEl) return;
    modalEl.classList.toggle('is-expanded', isModalExpanded);
    const expanded = isModalExpanded ? 'true' : 'false';
    expandEl.setAttribute('aria-pressed', expanded);
    const label = isModalExpanded ? '縮小顯示隨機選人視窗' : '放大顯示隨機選人視窗';
    expandEl.setAttribute('aria-label', label);
    expandEl.title = label;
    if (expandIconEl) {
        expandIconEl.textContent = isModalExpanded ? '⤡' : '⤢';
    }
}

function openOverlay(trigger) {
    if (!overlayEl) {
        createOverlay();
    }

    lastTrigger = trigger instanceof HTMLElement ? trigger : document.getElementById('btnRandomPicker');

    syncWithClassSize({ resetRange: true, resetExclusions: true, resetPickCount: true });
    clearResults();

    document.body.classList.add('random-picker-open');
    overlayEl.classList.add('show');
    applyExpandedState();
    modalEl?.setAttribute('tabindex', '-1');
    modalEl?.focus({ preventScroll: true });

    if (!escHandler) {
        escHandler = (event) => {
            if (event.key === 'Escape') {
                closeOverlay();
            }
        };
        document.addEventListener('keydown', escHandler);
    }
}

function closeOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.remove('show');
    document.body.classList.remove('random-picker-open');
    closeResultLightbox();
    if (escHandler) {
        document.removeEventListener('keydown', escHandler);
        escHandler = null;
    }
    if (modalEl) {
        modalEl.removeAttribute('tabindex');
    }
    if (lastTrigger && document.body.contains(lastTrigger)) {
        lastTrigger.focus({ preventScroll: true });
    }
}

function createResultOverlay() {
    if (resultOverlayEl) return;

    resultOverlayEl = document.createElement('div');
    resultOverlayEl.id = RESULT_OVERLAY_ID;
    resultOverlayEl.className = 'random-picker-result-overlay';
    resultOverlayEl.setAttribute('aria-hidden', 'true');
    resultOverlayEl.innerHTML = `
        <div class="random-picker-result-inner" role="dialog" aria-modal="true" aria-labelledby="randomPickerResultHeading">
            <button type="button" class="random-picker-result-close" data-result-close aria-label="關閉抽選結果"><span aria-hidden="true">×</span></button>
            <h3 class="random-picker-result-heading" id="randomPickerResultHeading">抽選結果</h3>
            <div class="random-picker-result-grid" id="${RESULT_GRID_ID}" data-result-grid></div>
        </div>
    `;

    document.body.appendChild(resultOverlayEl);
    resultGridEl = resultOverlayEl.querySelector(`#${RESULT_GRID_ID}`);
    resultCloseEl = resultOverlayEl.querySelector('[data-result-close]');
    resultInnerEl = resultOverlayEl.querySelector('.random-picker-result-inner');

    resultOverlayEl.addEventListener('click', (event) => {
        if (event.target === resultOverlayEl) {
            closeResultLightbox();
        }
    });

    resultCloseEl?.addEventListener('click', closeResultLightbox);
}

function openResultLightbox(numbers, students) {
    if (!resultOverlayEl || !resultGridEl) {
        createResultOverlay();
    }

    if (!resultOverlayEl || !resultGridEl) return;

    resultGridEl.innerHTML = '';

    const {
        fontSize,
        minWidth,
        cardPadding,
        cardGap,
        gridGap,
        gridPadding,
        innerPadding,
        innerGap
    } = calculateResultLayout(numbers.length);

    resultGridEl.style.setProperty('--result-font-size', fontSize);
    resultGridEl.style.setProperty('--result-card-min-width', minWidth);
    resultGridEl.style.setProperty('--result-card-padding', cardPadding);
    resultGridEl.style.setProperty('--result-card-gap', cardGap);
    resultGridEl.style.setProperty('--result-grid-gap', gridGap);
    resultGridEl.style.setProperty('--result-grid-padding', gridPadding);

    if (resultInnerEl) {
        resultInnerEl.style.setProperty('--result-inner-padding', innerPadding);
        resultInnerEl.style.setProperty('--result-inner-gap', innerGap);
    }

    const fragment = document.createDocumentFragment();
    numbers.forEach((num) => {
        const card = document.createElement('div');
        card.className = 'random-picker-result-card';

        const numberEl = document.createElement('span');
        numberEl.className = 'random-picker-result-number';
        numberEl.textContent = String(num);
        card.appendChild(numberEl);

        const student = students[num - 1];
        if (student && typeof student.name === 'string' && student.name.trim()) {
            const nameEl = document.createElement('span');
            nameEl.className = 'random-picker-result-name';
            nameEl.textContent = student.name.trim();
            card.appendChild(nameEl);
        }

        fragment.appendChild(card);
    });

    resultGridEl.appendChild(fragment);

    document.body.classList.add('random-picker-result-open');
    resultOverlayEl.classList.add('show');
    resultOverlayEl.removeAttribute('aria-hidden');
    resultCloseEl?.focus({ preventScroll: true });

    if (!resultEscHandler) {
        resultEscHandler = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopImmediatePropagation();
                closeResultLightbox();
            }
        };
        document.addEventListener('keydown', resultEscHandler);
    }
}

function closeResultLightbox() {
    if (!resultOverlayEl) return;
    resultOverlayEl.classList.remove('show');
    resultOverlayEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('random-picker-result-open');
    if (resultEscHandler) {
        document.removeEventListener('keydown', resultEscHandler);
        resultEscHandler = null;
    }
    if (overlayEl?.classList.contains('show')) {
        modalEl?.focus({ preventScroll: true });
    }
}

function calculateResultLayout(count) {
    const base = {
        fontSize: 'clamp(64px, 12vw, 220px)',
        minWidth: '240px',
        cardPadding: 'clamp(24px, 5vh, 48px)',
        gridGap: 'clamp(20px, 4vw, 48px)',
        gridPadding: 'clamp(12px, 3vh, 32px)',
        innerPadding: 'clamp(24px, 6vh, 48px)',
        innerGap: 'clamp(16px, 3vh, 32px)',
        cardGap: 'clamp(8px, 2vh, 16px)'
    };

    if (!Number.isFinite(count) || count <= 0) {
        return base;
    }

    if (count === 1) {
        return {
            ...base,
            fontSize: 'clamp(140px, 22vw, 320px)',
            minWidth: '420px',
            cardPadding: 'clamp(36px, 6vh, 64px)',
            gridGap: 'clamp(24px, 5vw, 60px)',
            gridPadding: 'clamp(16px, 4vh, 36px)',
            cardGap: 'clamp(10px, 2.4vh, 18px)'
        };
    }

    if (count === 2) {
        return {
            ...base,
            fontSize: 'clamp(120px, 18vw, 280px)',
            minWidth: '360px',
            cardPadding: 'clamp(32px, 5.5vh, 56px)',
            gridGap: 'clamp(24px, 4.5vw, 56px)',
            cardGap: 'clamp(10px, 2.2vh, 18px)'
        };
    }

    if (count <= 4) {
        return {
            ...base,
            fontSize: 'clamp(96px, 14vw, 220px)',
            minWidth: '280px'
        };
    }

    if (count <= 6) {
        return {
            ...base,
            fontSize: 'clamp(80px, 12vw, 180px)',
            minWidth: '240px',
            gridGap: 'clamp(18px, 3.6vw, 40px)',
            gridPadding: 'clamp(12px, 2.8vh, 28px)',
            cardGap: 'clamp(8px, 2vh, 16px)'
        };
    }

    if (count <= 9) {
        return {
            ...base,
            fontSize: 'clamp(64px, 10vw, 150px)',
            minWidth: '200px',
            cardPadding: 'clamp(20px, 4vh, 36px)',
            cardGap: 'clamp(8px, 1.8vh, 14px)',
            gridGap: 'clamp(16px, 3vw, 32px)',
            gridPadding: 'clamp(10px, 2.4vh, 24px)',
            innerPadding: 'clamp(20px, 5vh, 40px)',
            innerGap: 'clamp(14px, 2.6vh, 28px)'
        };
    }

    if (count <= 12) {
        return {
            ...base,
            fontSize: 'clamp(52px, 8vw, 120px)',
            minWidth: '180px',
            cardPadding: 'clamp(18px, 3.2vh, 30px)',
            cardGap: 'clamp(8px, 1.6vh, 14px)',
            gridGap: 'clamp(14px, 2.6vw, 26px)',
            gridPadding: 'clamp(10px, 2vh, 22px)',
            innerPadding: 'clamp(18px, 4vh, 34px)',
            innerGap: 'clamp(12px, 2.2vh, 24px)'
        };
    }

    return {
        ...base,
        fontSize: 'clamp(42px, 6vw, 96px)',
        minWidth: '160px',
        cardPadding: 'clamp(16px, 2.4vh, 26px)',
        cardGap: 'clamp(6px, 1.6vh, 12px)',
        gridGap: 'clamp(12px, 2.2vw, 22px)',
        gridPadding: 'clamp(8px, 1.8vh, 20px)',
        innerPadding: 'clamp(16px, 3.2vh, 28px)',
        innerGap: 'clamp(12px, 2vh, 20px)'
    };
}

function handleRangeChange() {
    const start = parseInt(rangeStartEl?.value || '1', 10);
    const end = parseInt(rangeEndEl?.value || '1', 10);
    if (!Number.isNaN(start)) state.rangeStart = start;
    if (!Number.isNaN(end)) state.rangeEnd = end;

    if (state.rangeStart < 1) {
        state.rangeStart = 1;
    }

    if (state.rangeEnd < state.rangeStart) {
        state.rangeEnd = state.rangeStart;
    }

    maybeExpandRangeOptions(Math.max(state.rangeStart, state.rangeEnd));
    syncWithClassSize();
    clearResults();
}

function handlePickCountInput() {
    const value = parseInt(pickCountEl?.value || '1', 10);
    const available = getAvailableNumbers().length;
    if (Number.isNaN(value) || value < 1) {
        state.pickCount = available > 0 ? 1 : 0;
    } else {
        state.pickCount = Math.min(value, available);
    }
    pickCountEl.value = state.pickCount > 0 ? String(state.pickCount) : '';
    updateActionState();
}

function handleExclusionChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') {
        return;
    }
    const value = parseInt(target.value, 10);
    if (Number.isNaN(value)) return;

    if (target.checked) {
        state.excluded.add(value);
    } else {
        state.excluded.delete(value);
    }

    syncWithClassSize();
    clearResults();
}

function handleRandomPick() {
    const availableNumbers = getAvailableNumbers();
    if (availableNumbers.length === 0) {
        showMessage('目前沒有可抽選的號碼，請調整範圍或排除設定。', 'error');
        return;
    }

    const pickCount = Math.max(1, Math.min(state.pickCount, availableNumbers.length));
    state.pickCount = pickCount;
    pickCountEl.value = String(pickCount);

    const selected = getRandomSubset(availableNumbers, pickCount);
    renderResults(selected);
}

function syncWithClassSize({ resetRange = false, resetExclusions = false, resetPickCount = false } = {}) {
    const students = getStudentsRef?.() || [];
    const classSize = Array.isArray(students) ? students.length : 0;

    const hasStudents = classSize > 0;
    updateSummaryLabel(classSize, hasStudents);

    if (emptyStateEl) {
        if (hasStudents) {
            emptyStateEl.setAttribute('hidden', '');
        } else {
            emptyStateEl.removeAttribute('hidden');
        }
    }

    if (settingsWrapperEl) {
        settingsWrapperEl.style.display = hasStudents ? 'block' : 'none';
    }

    if (!hasStudents) {
        state.rangeStart = 1;
        state.rangeEnd = 0;
        state.pickCount = 0;
        state.maxOption = DEFAULT_RANGE_MAX;
        state.excluded.clear();
        updateSelectOptions({ disable: true });
        if (rangeStartEl) {
            rangeStartEl.value = '1';
        }
        if (rangeEndEl) {
            rangeEndEl.value = '';
        }
        renderExclusions();
        enforcePickCountBounds();
        updateActionState();
        return;
    }

    const defaultUpperBound = Math.max(DEFAULT_RANGE_MAX, classSize);

    if (resetRange) {
        state.rangeStart = 1;
        state.rangeEnd = classSize;
        state.maxOption = defaultUpperBound;
    } else {
        state.rangeStart = Math.max(1, state.rangeStart);
        state.rangeEnd = Math.max(state.rangeEnd, state.rangeStart);
        const highest = Math.max(state.rangeEnd, state.rangeStart, defaultUpperBound);
        if (highest > state.maxOption) {
            const diff = highest - state.maxOption;
            const steps = Math.max(1, Math.ceil(diff / RANGE_EXPAND_STEP));
            state.maxOption += steps * RANGE_EXPAND_STEP;
        }
    }

    if (resetExclusions) {
        state.excluded.clear();
    } else {
        [...state.excluded].forEach((value) => {
            if (value < state.rangeStart || value > state.rangeEnd) {
                state.excluded.delete(value);
            }
        });
    }

    extendMaxOptionTo(state.rangeEnd);

    if (resetPickCount || state.pickCount < 1) {
        const available = getAvailableNumbers().length;
        state.pickCount = available > 0 ? 1 : 0;
    }

    updateSelectOptions({ disable: false });
    if (rangeStartEl) {
        rangeStartEl.value = String(state.rangeStart);
    }
    if (rangeEndEl) {
        rangeEndEl.value = state.rangeEnd >= 1 ? String(state.rangeEnd) : '';
    }
    renderExclusions();
    enforcePickCountBounds();
    updateActionState();
}

function extendMaxOptionTo(targetValue, { includeNextStep = false } = {}) {
    if (!Number.isFinite(targetValue)) return;
    const students = getStudentsRef?.() || [];
    const classSize = Array.isArray(students) ? students.length : 0;
    const baseline = Math.max(DEFAULT_RANGE_MAX, classSize, targetValue);
    let desiredMax = baseline;
    if (includeNextStep) {
        desiredMax = Math.max(desiredMax, targetValue + RANGE_EXPAND_STEP);
    }
    if (desiredMax <= state.maxOption) {
        if (includeNextStep && targetValue >= state.maxOption) {
            state.maxOption += RANGE_EXPAND_STEP;
        }
        return;
    }
    const diff = desiredMax - state.maxOption;
    const steps = Math.max(1, Math.ceil(diff / RANGE_EXPAND_STEP));
    state.maxOption += steps * RANGE_EXPAND_STEP;
}

function maybeExpandRangeOptions(targetValue) {
    extendMaxOptionTo(targetValue, { includeNextStep: true });
}

function updateSelectOptions({ disable = false } = {}) {
    if (!rangeStartEl || !rangeEndEl) return;
    const maxOption = Math.max(1, state.maxOption);
    const fragmentStart = document.createDocumentFragment();
    const fragmentEnd = document.createDocumentFragment();
    for (let i = 1; i <= maxOption; i += 1) {
        const optStart = document.createElement('option');
        optStart.value = String(i);
        optStart.textContent = String(i);
        fragmentStart.appendChild(optStart);

        const optEnd = document.createElement('option');
        optEnd.value = String(i);
        optEnd.textContent = String(i);
        fragmentEnd.appendChild(optEnd);
    }
    rangeStartEl.innerHTML = '';
    rangeEndEl.innerHTML = '';
    rangeStartEl.appendChild(fragmentStart);
    rangeEndEl.appendChild(fragmentEnd);

    rangeStartEl.disabled = disable;
    rangeEndEl.disabled = disable;
}

function renderExclusions() {
    if (!exclusionsEl) return;
    exclusionsEl.innerHTML = '';

    if (state.rangeEnd < state.rangeStart) return;

    const fragment = document.createDocumentFragment();
    for (let num = state.rangeStart; num <= state.rangeEnd; num += 1) {
        const label = document.createElement('label');
        label.className = 'random-picker-exclude-item';
        label.setAttribute('data-number', String(num));

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = String(num);
        checkbox.checked = state.excluded.has(num);

        const span = document.createElement('span');
        span.textContent = `${num} 號`;

        label.appendChild(checkbox);
        label.appendChild(span);
        fragment.appendChild(label);
    }

    exclusionsEl.appendChild(fragment);
}

function enforcePickCountBounds() {
    if (!pickCountEl) return;
    const available = getAvailableNumbers().length;
    if (available <= 0) {
        state.pickCount = 0;
        pickCountEl.value = '';
        pickCountEl.disabled = true;
    } else {
        pickCountEl.disabled = false;
        state.pickCount = Math.min(Math.max(state.pickCount, 1), available);
        pickCountEl.min = '1';
        pickCountEl.max = String(available);
        pickCountEl.value = String(state.pickCount);
    }
}

function getAvailableNumbers() {
    if (state.rangeEnd < state.rangeStart) return [];
    const available = [];
    for (let num = state.rangeStart; num <= state.rangeEnd; num += 1) {
        if (!state.excluded.has(num)) {
            available.push(num);
        }
    }
    return available;
}

function updateActionState() {
    if (!actionEl) return;
    const available = getAvailableNumbers().length;
    const disabled = available === 0;
    actionEl.disabled = disabled;
    if (disabled) {
        showMessage('目前沒有可抽選的號碼，請調整範圍或排除設定。', 'error');
    } else {
        showMessage('設定完成後點選「隨機抽選」即可抽出學生。');
    }
}

function clearResults() {
    if (messageEl) {
        messageEl.classList.remove('is-success');
    }
    if (resultListEl) {
        resultListEl.innerHTML = '';
    }
}

function showMessage(text, type = 'info') {
    if (!messageEl) return;
    messageEl.textContent = text || '';
    messageEl.classList.remove('is-success', 'is-error');
    if (type === 'error') {
        messageEl.classList.add('is-error');
    } else if (type === 'success') {
        messageEl.classList.add('is-success');
    }
}

function renderResults(numbers) {
    if (!resultListEl) return;
    resultListEl.innerHTML = '';

    const students = getStudentsRef?.() || [];

    if (!Array.isArray(numbers) || numbers.length === 0) {
        showMessage('目前沒有抽選結果，請重新抽選。');
        return;
    }

    const fragment = document.createDocumentFragment();
    numbers.forEach((num) => {
        const badge = document.createElement('div');
        badge.className = 'random-picker-badge';

        const mainText = document.createElement('strong');
        mainText.textContent = `${num} 號`;
        badge.appendChild(mainText);

        const student = students[num - 1];
        if (student && typeof student.name === 'string' && student.name.trim()) {
            const subText = document.createElement('small');
            subText.textContent = student.name.trim();
            badge.appendChild(subText);
        }

        fragment.appendChild(badge);
    });

    resultListEl.appendChild(fragment);
    showMessage(`已隨機選出 ${numbers.length} 位同學。`, 'success');
    openResultLightbox(numbers, students);
    notifyCompletion(numbers.length);
}

function notifyCompletion(count) {
    if (typeof window === 'undefined') return;
    const total = Number(count);
    if (!Number.isFinite(total) || total <= 0) return;
    window.setTimeout(() => {
        window.alert(`已完成抽選，共選出 ${total} 位同學。`);
    }, 60);
}

function updateSummaryLabel(classSize, hasStudents) {
    if (!summaryEl) return;
    const className = typeof getCurrentClassRef === 'function' ? getCurrentClassRef() : '';
    if (!hasStudents) {
        summaryEl.textContent = className ? `${className} 暫無學生` : '尚未建立學生資料';
    } else {
        summaryEl.textContent = className ? `${className}・共 ${classSize} 人` : `共 ${classSize} 人`;
    }
}

function getRandomSubset(source, count) {
    const pool = [...source];
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}

function handleStudentsRendered() {
    if (!overlayEl) return;
    const wasVisible = overlayEl.classList.contains('show');
    if (wasVisible) {
        syncWithClassSize();
    }
}

export function init(getStudents, getCurrentClass) {
    if (isInitialized) return;
    if (typeof getStudents === 'function') {
        getStudentsRef = getStudents;
    }
    if (typeof getCurrentClass === 'function') {
        getCurrentClassRef = getCurrentClass;
    }

    createOverlay();

    const trigger = document.getElementById('btnRandomPicker');
    trigger?.addEventListener('click', () => openOverlay(trigger));

    document.addEventListener('students:rendered', handleStudentsRendered);

    isInitialized = true;
}
