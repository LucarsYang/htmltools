import { createGoogleAuth } from './google-auth.js';
import { createGoogleDrive } from './google-drive.js';
import {
    loadClasses,
    saveClasses,
    ensureClassesIntegrity,
    getInitialClassName,
    getClassNames,
    IMAGE_MAP,
    GENDER_IMAGE_LABELS,
    resolveImageLabel
} from './data-store.js';
import { init as initWheel } from '../wheel.js';
import { createDeductionManager } from '../deduction-management.js';

const storage = typeof window !== 'undefined' ? window.localStorage : null;
const googleAuth = createGoogleAuth(storage);
const googleDrive = createGoogleDrive(googleAuth);
let classes = ensureClassesIntegrity(loadClasses(storage));
let currentClass = getInitialClassName(classes);
let deductionManager = null;
let scoreHistoryOverlay = null;
let scoreHistoryElements = null;
let activeHistoryStudentIndex = -1;
let historyLastFocusedElement = null;

let updatingState = false;
let editIndex = -1;
let selectedImage = '';
let customImageData = null;
let customImageFileId = null;
let uploadedImages = new Set();

let autoSyncTimer = null;
const AUTO_SYNC_DELAY = 30;
let remainingSeconds = 0;
let syncState = 'synced';

let inactivityTimer = null;
const INACTIVITY_CHECK_DELAY = 60;
let lastActivityTime = Date.now();

function ensureScoreEventsStore() {
    if (!Array.isArray(classes.scoreEvents)) {
        classes.scoreEvents = [];
    }
    return classes.scoreEvents;
}

function generateScoreEventId() {
    const events = ensureScoreEventsStore();
    const existingIds = new Set(
        events
            .map(event => (event && typeof event.id === 'string' ? event.id : null))
            .filter(Boolean)
    );
    let candidate = '';
    do {
        candidate = `se-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    } while (existingIds.has(candidate));
    return candidate;
}

function recordScoreEvent({
    studentName = '',
    studentIndex = null,
    previousScore = null,
    delta = 0,
    newScore = null,
    type = 'unknown',
    metadata = {}
} = {}) {
    const numericDelta = Number(delta);
    if (!Number.isFinite(numericDelta) || numericDelta === 0) {
        return;
    }

    const previous = Number(previousScore);
    const next = Number(newScore);
    const indexValue = Number(studentIndex);
    const normalizedMetadata = metadata && typeof metadata === 'object' ? { ...metadata } : {};

    const event = {
        id: generateScoreEventId(),
        className: currentClass,
        studentName: typeof studentName === 'string' ? studentName : '',
        studentIndex: Number.isInteger(indexValue) ? indexValue : null,
        previousScore: Number.isFinite(previous) ? previous : null,
        delta: numericDelta,
        newScore: Number.isFinite(next) ? next : null,
        type: typeof type === 'string' ? type : 'unknown',
        metadata: normalizedMetadata,
        performedAt: new Date().toISOString()
    };

    ensureScoreEventsStore().push(event);
    return event;
}

window.toggleSidebar = function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const collapsed = sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    const toggleBtn = document.querySelector('.sidebar-toggle');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
    }
};

function saveClassesLocal() {
    saveClasses(storage, classes);
}

function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    lastActivityTime = Date.now();
    inactivityTimer = setTimeout(checkCloudFile, INACTIVITY_CHECK_DELAY * 1000);
}

async function checkCloudFile() {
    if (!googleAuth.getIsSignedIn()) return;

    try {
        const cloudData = await googleDrive.loadDriveFile('classes.json');
        if (!cloudData) return;

        const localData = JSON.stringify(classes);
        const cloudDataStr = JSON.stringify(cloudData);

        if (localData !== cloudDataStr) {
            if (confirm('發現雲端檔案有更新，是否要同步？\n注意：同步後本地資料將被雲端資料覆蓋。')) {
                markUpdating();
                classes = ensureClassesIntegrity(cloudData);
                saveClassesLocal();
                renderClassDropdown();
                renderStudents();
                deductionManager?.refresh();
                markSynced();
            }
        }
    } catch (err) {
        console.error('檢查雲端檔案失敗:', err);
        if (String(err.message).includes('401') || String(err.message).toLowerCase().includes('unauthorized')) {
            alert('登入已過期，請重新登入');
            handleLogout();
        }
    }
}

function setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
    });
}

function setSyncState(state) {
    syncState = state;
    const syncBar = document.getElementById('syncStatusBar');
    const syncCard = document.getElementById('syncStatusCard');
    if (syncBar) {
        syncBar.dataset.state = state;
    }
    if (syncCard) {
        syncCard.dataset.state = state;
    }
    refreshSyncLabels();
}

function refreshSyncLabels() {
    const syncBar = document.getElementById('syncStatusBar');
    if (!syncBar) return;

    const syncHint = document.getElementById('syncStatusText');
    const syncBadge = document.getElementById('syncStatusBadge');
    const isSignedIn = googleAuth.getIsSignedIn();

    let hint = isSignedIn ? '已同步，資料為最新狀態' : '請登入以啟用資料同步';
    let badgeText = isSignedIn ? '已同步' : '需登入';

    if (syncState === 'dirty') {
        if (!isSignedIn) {
            hint = '有異動，請登入後同步';
            badgeText = '需登入';
        } else if (remainingSeconds > 0) {
            hint = `有異動，${remainingSeconds}s 後自動同步`;
            badgeText = '待同步';
        } else {
            hint = '有異動，請點擊同步';
            badgeText = '待同步';
        }
    } else if (syncState === 'updating') {
        hint = '更新中，資料同步處理中';
        badgeText = '同步中';
    }

    syncBar.dataset.hint = hint;
    syncBar.setAttribute('aria-label', hint);
    syncBar.setAttribute('aria-describedby', 'syncStatusText');
    syncBar.title = hint;

    if (syncHint) {
        syncHint.textContent = hint;
    }

    if (syncBadge) {
        syncBadge.textContent = badgeText;
    }
}

function markDirty() {
    setSyncState('dirty');
    updatingState = false;
    hideSyncOverlay();
    enableSyncBar();
    startAutoSyncTimer();
    updateSyncStatus();
}

function markUpdating() {
    setSyncState('updating');
    updatingState = true;
    showSyncOverlay();
    disableSyncBar();
    stopAutoSyncTimer();
    updateSyncStatus();
}

function markSynced() {
    setSyncState('synced');
    updatingState = false;
    hideSyncOverlay();
    enableSyncBar();
    stopAutoSyncTimer();
    updateSyncStatus();
}

function startAutoSyncTimer() {
    if (!googleAuth.getIsSignedIn()) {
        remainingSeconds = 0;
        updateSyncStatus();
        return;
    }
    stopAutoSyncTimer();
    remainingSeconds = AUTO_SYNC_DELAY;
    updateSyncStatus();

    autoSyncTimer = setInterval(() => {
        remainingSeconds -= 1;
        if (remainingSeconds <= 0) {
            clearInterval(autoSyncTimer);
            autoSyncTimer = null;
            remainingSeconds = 0;
            updateSyncStatus();
            performSync();
        } else {
            updateSyncStatus();
        }
    }, 1000);
}

function stopAutoSyncTimer() {
    if (autoSyncTimer) {
        clearInterval(autoSyncTimer);
        autoSyncTimer = null;
    }
    remainingSeconds = 0;
    updateSyncStatus();
}

function updateSyncStatus() {
    const statusBar = document.getElementById('syncStatusBar');
    const statusCard = document.getElementById('syncStatusCard');
    if (!statusBar) return;
    statusBar.dataset.state = syncState;
    statusBar.setAttribute('aria-busy', syncState === 'updating' ? 'true' : 'false');
    if (statusCard) {
        statusCard.dataset.state = syncState;
        statusCard.setAttribute('aria-busy', syncState === 'updating' ? 'true' : 'false');
    }
    refreshSyncLabels();
}

function performSync() {
    if (!googleAuth.getIsSignedIn()) {
        alert('尚未登入 Google');
        return;
    }
    if (updatingState) {
        alert('同步處理中，請稍候...');
        return;
    }

    markUpdating();
    googleDrive.saveDriveFile('classes.json', classes)
        .then(() => {
            markSynced();
        })
        .catch(err => {
            console.error('儲存失敗:', err);
            markDirty();
            if (String(err.message).includes('401') || String(err.message).toLowerCase().includes('unauthorized')) {
                alert('登入已過期，請重新登入');
                storage?.removeItem('googleAccessToken');
                hideMainButtons();
                backToLoginChoice();
            } else {
                alert('同步失敗，請稍後再試');
            }
        });
}

function enableSyncBar() {
    const bar = document.getElementById('syncStatusBar');
    if (!bar) return;
    bar.classList.remove('disabled');
    bar.removeAttribute('aria-disabled');
}

function disableSyncBar() {
    const bar = document.getElementById('syncStatusBar');
    if (!bar) return;
    bar.classList.add('disabled');
    bar.setAttribute('aria-disabled', 'true');
}

function showSyncOverlay() {
    document.getElementById('syncOverlay')?.classList.add('show');
    document.getElementById('syncPopup')?.classList.add('show');
}

function hideSyncOverlay() {
    document.getElementById('syncOverlay')?.classList.remove('show');
    document.getElementById('syncPopup')?.classList.remove('show');
}

function checkIfUpdating() {
    if (updatingState) {
        alert('目前正在「更新中」，請稍後再操作。');
        return true;
    }
    return false;
}

function hideMainButtons() {
    document.getElementById('login-btn')?.style.setProperty('display', 'none');
    document.getElementById('logout-btn')?.style.setProperty('display', 'none');
    document.getElementById('classSelect')?.style.setProperty('display', 'none');
}


function showMainButtons() {
    const isSigned = googleAuth.getIsSignedIn();
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const classSelect = document.getElementById('classSelect');
    if (loginBtn) loginBtn.style.display = isSigned ? 'none' : 'inline-block';
    if (logoutBtn) logoutBtn.style.display = isSigned ? 'inline-block' : 'none';
    if (classSelect) classSelect.style.display = 'inline-block';
}


function showLoginChoice() {
    document.getElementById('loginOverlay')?.classList.add('show');
    document.getElementById('loginPopup')?.classList.add('show');
}

function closeLoginChoice() {
    document.getElementById('loginOverlay')?.classList.remove('show');
    document.getElementById('loginPopup')?.classList.remove('show');
}

function backToLoginChoice() {
    hideLoginProcessingOverlay();
    showLoginChoice();
}

function showLoginProcessingOverlay() {
    document.getElementById('loginProcessingOverlay')?.classList.add('show');
    document.getElementById('loginProcessingPopup')?.classList.add('show');
}

function hideLoginProcessingOverlay() {
    document.getElementById('loginProcessingOverlay')?.classList.remove('show');
    document.getElementById('loginProcessingPopup')?.classList.remove('show');
}

async function loadClassesFromDrive() {
    if (!googleAuth.getIsSignedIn()) return;
    try {
        const data = await googleDrive.loadDriveFile('classes.json');
        if (data) {
            classes = ensureClassesIntegrity(data);
            saveClassesLocal();
            if (!classes[currentClass]) {
                currentClass = getInitialClassName(classes);
            }
            closeScoreHistory();
            renderClassDropdown();
            renderStudents();
            deductionManager?.refresh();
            markSynced();
        } else {
            markDirty();
        }
    } catch (err) {
        console.error('loadClasses失敗:', err);
        markDirty();
    }
}

function getStudents() {
    if (!classes[currentClass]) classes[currentClass] = [];
    return classes[currentClass];
}

function getDeductionItems() {
    if (!Array.isArray(classes.deductionItems)) {
        classes.deductionItems = [];
    }
    return classes.deductionItems;
}

function setDeductionItems(items) {
    const normalized = Array.isArray(items)
        ? items
              .filter(item => item && typeof item.name === 'string' && Number.isFinite(Number(item.points)))
              .map(item => ({
                  id: item.id,
                  name: item.name,
                  points: Number(item.points)
              }))
        : [];
    classes.deductionItems = normalized;
    saveClassesLocal();
    renderStudents();
    markDirty();
    deductionManager?.refresh();
}

function findDeductionItemById(id) {
    return getDeductionItems().find(item => String(item.id) === String(id));
}

function generateHistoryId(history = []) {
    const used = new Set(
        history
            .map(record => {
                if (!record) return null;
                if (typeof record.id === 'string' || typeof record.id === 'number') {
                    return String(record.id);
                }
                return null;
            })
            .filter(Boolean)
    );

    let base = Date.now();
    let candidate = `h-${base}`;
    while (used.has(candidate)) {
        base += 1;
        candidate = `h-${base}`;
    }
    return candidate;
}

function ensureScoreHistoryOverlay() {
    if (scoreHistoryOverlay && scoreHistoryElements) {
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'scoreHistoryOverlay';
    overlay.className = 'score-history-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
        <div class="score-history-container" role="dialog" aria-modal="true" aria-labelledby="scoreHistoryTitle">
            <header class="score-history-header">
                <div class="score-history-header-text">
                    <h3 id="scoreHistoryTitle">分數異動紀錄</h3>
                    <p id="scoreHistoryCount" class="score-history-count" aria-live="polite"></p>
                </div>
                <button type="button" class="score-history-close" aria-label="關閉分數異動紀錄">×</button>
            </header>
            <div class="score-history-body">
                <form class="score-history-filters">
                    <label class="score-history-filter" for="historyTypeFilter">
                        <span>紀錄類型</span>
                        <select id="historyTypeFilter" name="historyTypeFilter">
                            <option value="all">全部紀錄</option>
                            <option value="deductions">僅扣分</option>
                        </select>
                    </label>
                    <label class="score-history-filter" for="historyItemFilter">
                        <span>扣分項目</span>
                        <select id="historyItemFilter" name="historyItemFilter" disabled></select>
                    </label>
                    <label class="score-history-filter" for="historyStartDate">
                        <span>起始日期</span>
                        <input type="date" id="historyStartDate" name="historyStartDate" />
                    </label>
                    <label class="score-history-filter" for="historyEndDate">
                        <span>結束日期</span>
                        <input type="date" id="historyEndDate" name="historyEndDate" />
                    </label>
                    <div class="score-history-filter-actions">
                        <button type="submit" class="btn-primary">套用篩選</button>
                        <button type="button" class="btn-secondary" data-action="reset-filters">清除篩選</button>
                    </div>
                </form>
                <div class="score-history-table-wrapper">
                    <div class="score-history-scroll">
                        <table class="score-history-table" aria-describedby="scoreHistoryTitle">
                            <thead>
                                <tr>
                                    <th scope="col">異動時間</th>
                                    <th scope="col">操作內容</th>
                                    <th scope="col">分數變化</th>
                                    <th scope="col">異動後分數</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                    <p class="score-history-empty" aria-live="polite"></p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    scoreHistoryOverlay = overlay;
    scoreHistoryElements = {
        container: overlay.querySelector('.score-history-container'),
        title: overlay.querySelector('#scoreHistoryTitle'),
        count: overlay.querySelector('#scoreHistoryCount'),
        closeBtn: overlay.querySelector('.score-history-close'),
        form: overlay.querySelector('.score-history-filters'),
        typeSelect: overlay.querySelector('#historyTypeFilter'),
        itemSelect: overlay.querySelector('#historyItemFilter'),
        startInput: overlay.querySelector('#historyStartDate'),
        endInput: overlay.querySelector('#historyEndDate'),
        resetBtn: overlay.querySelector('[data-action="reset-filters"]'),
        table: overlay.querySelector('.score-history-table'),
        tableBody: overlay.querySelector('.score-history-table tbody'),
        emptyMessage: overlay.querySelector('.score-history-empty')
    };

    scoreHistoryElements.closeBtn?.addEventListener('click', closeScoreHistory);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeScoreHistory();
        }
    });
    scoreHistoryElements.form?.addEventListener('submit', (event) => {
        event.preventDefault();
        renderScoreHistoryList();
    });
    scoreHistoryElements.form?.addEventListener('change', () => {
        updateScoreHistoryFilterState();
        renderScoreHistoryList();
    });
    scoreHistoryElements.resetBtn?.addEventListener('click', (event) => {
        event.preventDefault();
        if (scoreHistoryElements.typeSelect) scoreHistoryElements.typeSelect.value = 'all';
        if (scoreHistoryElements.itemSelect) scoreHistoryElements.itemSelect.value = '';
        if (scoreHistoryElements.startInput) scoreHistoryElements.startInput.value = '';
        if (scoreHistoryElements.endInput) scoreHistoryElements.endInput.value = '';
        updateScoreHistoryFilterState();
        renderScoreHistoryList();
    });

    if (scoreHistoryElements.itemSelect) {
        scoreHistoryElements.itemSelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '全部項目';
        scoreHistoryElements.itemSelect.appendChild(option);
    }

    updateScoreHistoryFilterState();
}

function getActiveHistoryStudent() {
    const arr = getStudents();
    if (activeHistoryStudentIndex < 0 || activeHistoryStudentIndex >= arr.length) {
        return null;
    }
    return arr[activeHistoryStudentIndex];
}

function updateScoreHistoryFilterState() {
    const typeValue = scoreHistoryElements?.typeSelect?.value || 'all';
    if (scoreHistoryElements?.itemSelect) {
        scoreHistoryElements.itemSelect.disabled = typeValue !== 'deductions';
    }
}

function populateScoreHistoryItemFilter(events) {
    if (!scoreHistoryElements?.itemSelect) return;
    const select = scoreHistoryElements.itemSelect;
    const previousValue = select.value;
    select.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '全部項目';
    select.appendChild(defaultOption);

    const uniqueItems = new Map();
    let hasOther = false;

    events.forEach(event => {
        if (!event) return;
        const delta = Number(event.delta) || 0;
        if (delta >= 0) return;
        const rawName = typeof event.metadata?.itemName === 'string' ? event.metadata.itemName.trim() : '';
        const itemId = event.metadata?.itemId;
        if (rawName) {
            const key = itemId !== null && itemId !== undefined ? `id:${itemId}` : `name:${rawName}`;
            if (!uniqueItems.has(key)) {
                uniqueItems.set(key, rawName);
            }
        } else {
            hasOther = true;
        }
    });

    uniqueItems.forEach((label, key) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = label;
        select.appendChild(opt);
    });

    if (hasOther) {
        const otherOpt = document.createElement('option');
        otherOpt.value = 'other';
        otherOpt.textContent = '其他扣分';
        select.appendChild(otherOpt);
    }

    if ([...uniqueItems.keys(), 'other', ''].includes(previousValue)) {
        select.value = previousValue;
    } else {
        select.value = '';
    }
}

function formatHistoryDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
        return '—';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function getStudentScoreEvents(studentIndex) {
    const events = ensureScoreEventsStore();
    const student = getStudents()[studentIndex];
    if (!student) return [];
    const studentName = student.name || '';
    const historyIds = new Set(
        Array.isArray(student.deductionHistory)
            ? student.deductionHistory.map(entry => entry?.id).filter(id => typeof id === 'string')
            : []
    );

    return events.filter(event => {
        if (!event || event.className !== currentClass) return false;
        const eventIndex = Number(event.studentIndex);
        const indexMatch = Number.isInteger(eventIndex) && eventIndex === studentIndex;
        const nameMatch = studentName && event.studentName === studentName;
        const historyId = typeof event.metadata?.historyId === 'string' ? event.metadata.historyId : null;
        const historyMatch = historyId && historyIds.has(historyId);
        return indexMatch || historyMatch || nameMatch;
    });
}

function matchesScoreHistoryItemFilter(event, filterValue) {
    if (!filterValue) return true;
    const metadata = event.metadata || {};
    const rawName = typeof metadata.itemName === 'string' ? metadata.itemName.trim() : '';
    const itemId = metadata.itemId;
    if (filterValue === 'other') {
        return !rawName;
    }
    const key = itemId !== null && itemId !== undefined ? `id:${itemId}` : rawName ? `name:${rawName}` : '';
    return key === filterValue;
}

function describeScoreEvent(event) {
    const delta = Number(event.delta) || 0;
    const metadata = event.metadata || {};
    const detailParts = [];

    switch (event.type) {
        case 'quick-adjust':
            return {
                title: delta >= 0 ? '快速加分' : '快速扣分',
                detail: metadata.source === 'score-button' ? '分數按鈕操作' : ''
            };
        case 'custom-adjust': {
            if (metadata.inputValue !== undefined && metadata.inputValue !== null) {
                const rawValue = Number(metadata.inputValue) || 0;
                const absValue = Math.abs(rawValue);
                const signText = metadata.sign === '-' ? '扣' : '加';
                detailParts.push(`自訂${signText}${absValue}分`);
            }
            return {
                title: '自訂調整',
                detail: detailParts.join(' • ')
            };
        }
        case 'manual-edit': {
            if (metadata.source === 'student-editor') {
                detailParts.push('手動編輯分數');
            }
            if (metadata.previousName && metadata.previousName !== event.studentName) {
                detailParts.push(`原姓名：${metadata.previousName}`);
            }
            return {
                title: '手動編輯',
                detail: detailParts.join(' • ')
            };
        }
        case 'deduction-item':
            return {
                title: '扣分項目',
                detail: metadata.itemName || '扣分'
            };
        default:
            if (metadata.source) {
                detailParts.push(String(metadata.source));
            }
            return {
                title: '分數異動',
                detail: detailParts.join(' • ')
            };
    }
}

function syncScoreEventsForStudent(studentIndex, previousName, nextName) {
    const events = ensureScoreEventsStore();
    events.forEach(event => {
        if (!event || event.className !== currentClass) return;
        const eventIndex = Number(event.studentIndex);
        const matchesIndex = Number.isInteger(eventIndex) && eventIndex === studentIndex;
        const matchesName = previousName && event.studentName === previousName;
        if (matchesIndex || matchesName) {
            event.studentIndex = studentIndex;
            if (typeof nextName === 'string') {
                event.studentName = nextName;
            }
        }
    });
}

function syncScoreEventIndexesForClass() {
    const events = ensureScoreEventsStore();
    const students = getStudents();
    const nameToIndexes = new Map();

    students.forEach((student, index) => {
        if (!student) return;
        const key = student.name || `__index_${index}`;
        if (!nameToIndexes.has(key)) {
            nameToIndexes.set(key, []);
        }
        nameToIndexes.get(key).push(index);
    });

    events.forEach(event => {
        if (!event || event.className !== currentClass) return;
        const eventIndex = Number(event.studentIndex);
        const hasValidIndex =
            Number.isInteger(eventIndex) &&
            eventIndex >= 0 &&
            eventIndex < students.length &&
            students[eventIndex]?.name === event.studentName;
        if (hasValidIndex) return;

        const historyId = typeof event.metadata?.historyId === 'string' ? event.metadata.historyId : null;
        if (historyId) {
            const historyMatchIndex = students.findIndex(student =>
                Array.isArray(student?.deductionHistory) &&
                student.deductionHistory.some(record => record?.id === historyId)
            );
            if (historyMatchIndex !== -1) {
                event.studentIndex = historyMatchIndex;
                event.studentName = students[historyMatchIndex].name;
                return;
            }
        }

        const candidateIndexes = nameToIndexes.get(event.studentName || '') || [];
        if (candidateIndexes.length > 0) {
            const targetIndex = candidateIndexes[0];
            event.studentIndex = targetIndex;
            event.studentName = students[targetIndex]?.name || event.studentName;
        }
    });
}

function renderScoreHistoryList() {
    if (!scoreHistoryElements) return;
    const student = getActiveHistoryStudent();
    if (!student) {
        closeScoreHistory();
        return;
    }

    updateScoreHistoryFilterState();

    const tbody = scoreHistoryElements.tableBody;
    const table = scoreHistoryElements.table;
    const emptyMessage = scoreHistoryElements.emptyMessage;
    const countEl = scoreHistoryElements.count;
    if (!tbody || !table || !emptyMessage) return;

    const events = getStudentScoreEvents(activeHistoryStudentIndex);
    populateScoreHistoryItemFilter(events);
    const total = events.length;

    const typeFilterValue = scoreHistoryElements.typeSelect?.value || 'all';
    const itemFilterValue = scoreHistoryElements.itemSelect?.value || '';
    const startDateValue = scoreHistoryElements.startInput?.value || '';
    const endDateValue = scoreHistoryElements.endInput?.value || '';

    let filtered = events.filter(event => Boolean(event));

    if (typeFilterValue === 'deductions') {
        filtered = filtered.filter(event => Number(event.delta) < 0);
        if (itemFilterValue && !(scoreHistoryElements.itemSelect?.disabled)) {
            filtered = filtered.filter(event => matchesScoreHistoryItemFilter(event, itemFilterValue));
        }
    }

    if (startDateValue) {
        const startDate = new Date(`${startDateValue}T00:00:00`);
        if (!Number.isNaN(startDate.getTime())) {
            filtered = filtered.filter(event => {
                const performedDate = new Date(event.performedAt);
                return !Number.isNaN(performedDate.getTime()) && performedDate >= startDate;
            });
        }
    }

    if (endDateValue) {
        const endDate = new Date(`${endDateValue}T23:59:59.999`);
        if (!Number.isNaN(endDate.getTime())) {
            filtered = filtered.filter(event => {
                const performedDate = new Date(event.performedAt);
                return !Number.isNaN(performedDate.getTime()) && performedDate <= endDate;
            });
        }
    }

    filtered.sort((a, b) => {
        const timeA = new Date(a.performedAt).getTime();
        const timeB = new Date(b.performedAt).getTime();
        return timeB - timeA;
    });

    tbody.innerHTML = '';

    if (countEl) {
        countEl.textContent = `顯示 ${filtered.length} 筆／共 ${total} 筆`;
    }

    if (!filtered.length) {
        table.style.display = 'none';
        emptyMessage.textContent = '目前沒有符合條件的分數異動紀錄';
        return;
    }

    table.style.display = 'table';
    emptyMessage.textContent = '';

    filtered.forEach(event => {
        const row = document.createElement('tr');

        const timeCell = document.createElement('td');
        timeCell.textContent = formatHistoryDate(event.performedAt);

        const infoCell = document.createElement('td');
        infoCell.className = 'event-description';
        const description = describeScoreEvent(event);
        const titleSpan = document.createElement('span');
        titleSpan.textContent = description.title;
        infoCell.appendChild(titleSpan);
        if (description.detail) {
            const detailSpan = document.createElement('span');
            detailSpan.className = 'event-meta';
            detailSpan.textContent = description.detail;
            infoCell.appendChild(detailSpan);
        }

        const deltaCell = document.createElement('td');
        const deltaValue = Number(event.delta) || 0;
        if (deltaValue > 0) {
            deltaCell.textContent = `+${deltaValue}`;
            deltaCell.classList.add('delta-positive');
        } else if (deltaValue < 0) {
            deltaCell.textContent = String(deltaValue);
            deltaCell.classList.add('delta-negative');
        } else {
            deltaCell.textContent = '0';
        }

        const scoreCell = document.createElement('td');
        const newScoreValue = Number(event.newScore);
        if (Number.isFinite(newScoreValue)) {
            scoreCell.textContent = String(newScoreValue);
        } else {
            scoreCell.textContent = '—';
        }

        row.append(timeCell, infoCell, deltaCell, scoreCell);
        tbody.appendChild(row);
    });
}

function openScoreHistory(idx) {
    if (checkIfUpdating()) return;
    ensureScoreHistoryOverlay();
    const student = getStudents()[idx];
    if (!student || !scoreHistoryOverlay || !scoreHistoryElements) return;

    activeHistoryStudentIndex = idx;
    historyLastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const titleEl = scoreHistoryElements.title;
    if (titleEl) {
        const name = student.name || '未命名學生';
        titleEl.textContent = `${name} 的分數異動紀錄`;
    }

    if (scoreHistoryElements.typeSelect) {
        scoreHistoryElements.typeSelect.value = 'all';
    }
    if (scoreHistoryElements.itemSelect) {
        scoreHistoryElements.itemSelect.value = '';
    }
    if (scoreHistoryElements.startInput) {
        scoreHistoryElements.startInput.value = '';
    }
    if (scoreHistoryElements.endInput) {
        scoreHistoryElements.endInput.value = '';
    }

    updateScoreHistoryFilterState();

    scoreHistoryOverlay.classList.add('show');
    scoreHistoryOverlay.setAttribute('aria-hidden', 'false');
    renderScoreHistoryList();

    window.setTimeout(() => {
        scoreHistoryElements?.typeSelect?.focus();
    }, 0);
}

function closeScoreHistory() {
    if (!scoreHistoryOverlay) return;
    scoreHistoryOverlay.classList.remove('show');
    scoreHistoryOverlay.setAttribute('aria-hidden', 'true');
    activeHistoryStudentIndex = -1;
    if (historyLastFocusedElement instanceof HTMLElement) {
        historyLastFocusedElement.focus();
    }
}

function renderClassDropdown() {
    const sel = document.getElementById('classSelect');
    if (!sel) return;
    sel.innerHTML = '';
    getClassNames(classes).forEach(cName => {
        const opt = document.createElement('option');
        opt.value = cName;
        opt.textContent = cName;
        if (cName === currentClass) opt.selected = true;
        sel.appendChild(opt);
    });
}

function renderStudents() {
    const arr = getStudents();
    const container = document.getElementById('studentContainer');
    if (!container) return;
    container.innerHTML = '';

    arr.forEach((st, idx) => {
        const card = document.createElement('div');
        card.classList.add('student-card');
        const imgSrc = st.customImage || IMAGE_MAP[st.imageLabel] || '';
        card.draggable = true;
        card.dataset.index = String(idx);
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.type = 'button';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', () => deleteStudent(idx));
        card.appendChild(deleteBtn);

        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = st.gender;
        img.addEventListener('click', () => editStudent(idx));
        card.appendChild(img);

        const name = document.createElement('p');
        name.textContent = st.name;
        card.appendChild(name);

        const score = document.createElement('p');
        score.id = `score-${idx}`;
        score.textContent = `${st.score} 分`;
        card.appendChild(score);

        const actionSection = document.createElement('div');
        actionSection.className = 'student-card-actions';

        const scoreButtonGroup = document.createElement('div');
        scoreButtonGroup.className = 'score-button-group';
        classes.scoreButtons.forEach(btnValue => {
            const button = document.createElement('button');
            button.className = `btn-score ${btnValue >= 0 ? 'positive' : 'negative'}`;
            button.type = 'button';
            button.textContent = `${btnValue >= 0 ? '+' : ''}${btnValue}`;
            button.addEventListener('click', () => updateScore(idx, btnValue));
            scoreButtonGroup.appendChild(button);
        });
        actionSection.appendChild(scoreButtonGroup);

        const quickAdjust = document.createElement('div');
        quickAdjust.className = 'quickAdjust';
        const select = document.createElement('select');
        select.id = `sign-${idx}`;
        const plus = document.createElement('option');
        plus.value = '+';
        plus.textContent = '+';
        const minus = document.createElement('option');
        minus.value = '-';
        minus.textContent = '-';
        select.append(plus, minus);

        const input = document.createElement('input');
        input.id = `custom-${idx}`;
        input.type = 'number';
        input.placeholder = '自訂分數';

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.textContent = '確定';
        confirmBtn.addEventListener('click', () => customAdjust(idx));

        quickAdjust.append(select, input, confirmBtn);
        actionSection.appendChild(quickAdjust);

        const deductionGroup = document.createElement('div');
        deductionGroup.className = 'deduction-select-group';
        const deductionSelect = document.createElement('select');
        deductionSelect.id = `deduction-${idx}`;
        deductionSelect.setAttribute('aria-label', '套用扣分項目');
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = '選擇扣分項目';
        deductionSelect.appendChild(placeholderOption);

        const deductionItems = getDeductionItems();
        if (deductionItems.length === 0) {
            deductionSelect.disabled = true;
            placeholderOption.textContent = '尚未建立扣分項目';
        } else {
            deductionItems.forEach(item => {
                const option = document.createElement('option');
                option.value = String(item.id);
                const pointValue = Number(item.points) || 0;
                const pointLabel = pointValue > 0 ? `+${pointValue}` : String(pointValue);
                option.textContent = `${item.name} (${pointLabel})`;
                deductionSelect.appendChild(option);
            });
        }

        const applyDeductionBtn = document.createElement('button');
        applyDeductionBtn.type = 'button';
        applyDeductionBtn.textContent = '確定';
        applyDeductionBtn.addEventListener('click', () => applyDeduction(idx));
        if (deductionItems.length === 0) {
            applyDeductionBtn.disabled = true;
        }

        deductionGroup.append(deductionSelect, applyDeductionBtn);
        actionSection.appendChild(deductionGroup);

        const historyBtn = document.createElement('button');
        historyBtn.type = 'button';
        historyBtn.className = 'score-history-btn';
        historyBtn.textContent = '查看分數異動紀錄';
        historyBtn.setAttribute('aria-label', `查看${st.name || '學生'}的分數異動紀錄`);
        historyBtn.addEventListener('click', () => openScoreHistory(idx));

        actionSection.appendChild(historyBtn);
        card.appendChild(actionSection);

        container.appendChild(card);
    });

}

function handleDragStart(e) {
    const target = e.currentTarget;
    target.classList.add('dragging');
    e.dataTransfer.setData('text/plain', target.dataset.index || '0');
}

function handleDragEnd(e) {
    const target = e.currentTarget;
    target.classList.remove('dragging');
    document.querySelectorAll('.student-card').forEach(card => card.classList.remove('drag-over'));
}

function handleDragOver(e) {
    e.preventDefault();
    const target = e.currentTarget;
    target.classList.add('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    const target = e.currentTarget;
    target.classList.remove('drag-over');

    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const toIndex = parseInt(target.dataset.index || '0', 10);
    if (Number.isNaN(fromIndex) || Number.isNaN(toIndex) || fromIndex === toIndex) return;

    const arr = getStudents();
    const [movedStudent] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, movedStudent);
    syncScoreEventIndexesForClass();
    saveClassesLocal();
    renderStudents();
    markDirty();
}

function editStudent(idx) {
    if (checkIfUpdating()) return;
    showPopup(idx);
}

function updateScore(idx, delta) {
    if (checkIfUpdating()) return;
    const arr = getStudents();
    const student = arr[idx];
    if (!student) return;
    const numericDelta = Number(delta);
    if (!Number.isFinite(numericDelta) || numericDelta === 0) return;
    const previousScore = Number(student.score) || 0;
    const newScore = previousScore + numericDelta;
    student.score = newScore;
    recordScoreEvent({
        studentName: student.name,
        studentIndex: idx,
        previousScore,
        delta: numericDelta,
        newScore,
        type: 'quick-adjust',
        metadata: { source: 'score-button' }
    });
    saveClassesLocal();
    const scoreEl = document.getElementById(`score-${idx}`);
    if (scoreEl) scoreEl.textContent = `${student.score} 分`;
    markDirty();
}

function customAdjust(idx) {
    if (checkIfUpdating()) return;
    const arr = getStudents();
    const student = arr[idx];
    if (!student) return;
    const signSel = document.getElementById(`sign-${idx}`);
    const customIn = document.getElementById(`custom-${idx}`);
    if (!signSel || !customIn) return;
    let rawInput = parseInt(customIn.value, 10);
    if (!Number.isFinite(rawInput)) rawInput = 0;
    let val = rawInput;
    if (signSel.value === '-') {
        val = -val;
    }
    const previousScore = Number(student.score) || 0;
    const newScore = previousScore + val;
    student.score = newScore;
    recordScoreEvent({
        studentName: student.name,
        studentIndex: idx,
        previousScore,
        delta: val,
        newScore,
        type: 'custom-adjust',
        metadata: {
            source: 'custom-input',
            inputValue: rawInput,
            sign: signSel.value
        }
    });
    saveClassesLocal();
    const scoreEl = document.getElementById(`score-${idx}`);
    if (scoreEl) scoreEl.textContent = `${student.score} 分`;
    customIn.value = '';
    markDirty();
}

function applyDeduction(idx) {
    if (checkIfUpdating()) return;
    const arr = getStudents();
    if (!arr[idx]) return;
    const student = arr[idx];
    const select = document.getElementById(`deduction-${idx}`);
    if (!select) return;
    const selectedId = select.value;
    if (!selectedId) {
        alert('請先選擇扣分項目');
        return;
    }
    const item = findDeductionItemById(selectedId);
    if (!item) {
        alert('找不到對應的扣分項目，請重新整理後再試');
        renderStudents();
        return;
    }
    const points = Number(item.points);
    if (!Number.isFinite(points)) {
        alert('扣分項目資料異常，請重新設定');
        return;
    }
    const appliedAt = new Date().toISOString();
    const previousScore = Number(student.score) || 0;
    const newScore = previousScore + points;
    student.score = newScore;
    if (!Array.isArray(student.deductionHistory)) {
        student.deductionHistory = [];
    }
    const historyEntry = {
        id: generateHistoryId(student.deductionHistory),
        itemId: typeof item.id === 'string' || typeof item.id === 'number' ? item.id : null,
        itemName: item.name || '未命名項目',
        points,
        scoreAfter: newScore,
        appliedAt
    };
    student.deductionHistory.push(historyEntry);
    student.deductionHistory.sort((a, b) => new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime());
    const scoreEvent = recordScoreEvent({
        studentName: student.name,
        studentIndex: idx,
        previousScore,
        delta: points,
        newScore,
        type: 'deduction-item',
        metadata: {
            itemId: historyEntry.itemId,
            itemName: historyEntry.itemName,
            historyId: historyEntry.id
        }
    });
    if (scoreEvent?.id) {
        historyEntry.eventId = scoreEvent.id;
    }
    saveClassesLocal();
    const scoreEl = document.getElementById(`score-${idx}`);
    if (scoreEl) scoreEl.textContent = `${student.score} 分`;
    select.value = '';
    markDirty();
    if (scoreHistoryOverlay?.classList.contains('show') && activeHistoryStudentIndex === idx) {
        renderScoreHistoryList();
    }
}

function deleteStudent(idx) {
    if (checkIfUpdating()) return;
    if (!confirm('確定要刪除這位學生嗎？')) return;
    const arr = getStudents();
    arr.splice(idx, 1);
    syncScoreEventIndexesForClass();
    saveClassesLocal();
    renderStudents();
    markDirty();
}

async function handleCustomImageUpload(evt) {
    const file = evt.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('請上傳圖片檔案');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert('圖片大小不能超過 5MB');
        return;
    }
    if (!googleAuth.getIsSignedIn()) {
        alert('請先登入 Google 帳號才能上傳圖片');
        return;
    }

    const preview = document.getElementById('customImagePreview');
    if (!preview) return;

    try {
        preview.innerHTML = '<p>圖片上傳中...</p>';
        const fileId = await googleDrive.uploadImageToDrive(file);
        customImageFileId = fileId;
        const imageUrl = await googleDrive.getImageUrlFromDrive(fileId);
        customImageData = imageUrl;
        preview.innerHTML = `
            <img src="${imageUrl}" alt="自訂圖片">
            <button type="button" class="btn-danger" data-action="clear-custom-image">移除自訂圖片</button>
        `;
        document.querySelectorAll('.image-preview img').forEach(x => x.classList.remove('selected'));
        selectedImage = '';
        uploadedImages.add(JSON.stringify({ url: imageUrl, id: fileId }));
        updateUploadedImagesSection();
    } catch (err) {
        console.error('圖片上傳失敗:', err);
        alert('圖片上傳失敗，請稍後再試');
        preview.innerHTML = '';
    }
}

function clearCustomImage() {
    customImageData = null;
    customImageFileId = null;
    const preview = document.getElementById('customImagePreview');
    const uploadInput = document.getElementById('customImageUpload');
    if (preview) preview.innerHTML = '';
    if (uploadInput) uploadInput.value = '';
    document.querySelectorAll('.uploaded-images-grid img').forEach(img => img.classList.remove('selected'));
    const gender = document.getElementById('studentGender')?.value || '男';
    const labels = GENDER_IMAGE_LABELS[gender];
    selectedImage = labels?.[0] || '';
    updateImagePreview();
}

async function showPopup(idx = -1) {
    editIndex = idx;
    document.getElementById('overlay')?.classList.add('show');
    document.getElementById('studentPopup')?.classList.add('show');

    const genderSelect = document.getElementById('studentGender');
    genderSelect?.addEventListener('change', updateImagePreview);

    customImageData = null;
    customImageFileId = null;
    const preview = document.getElementById('customImagePreview');
    const uploadInput = document.getElementById('customImageUpload');
    if (preview) preview.innerHTML = '';
    if (uploadInput) uploadInput.value = '';

    await collectUploadedImages();
    updateUploadedImagesSection();

    const popupTitle = document.getElementById('popupTitle');
    const nameInput = document.getElementById('studentName');
    const scoreInput = document.getElementById('studentScore');

    if (idx === -1) {
        if (popupTitle) popupTitle.textContent = '新增學生';
        if (nameInput) nameInput.value = '';
        if (scoreInput) scoreInput.value = 0;
        if (genderSelect) genderSelect.value = '男';
        selectedImage = '';
    } else {
        if (popupTitle) popupTitle.textContent = '編輯學生';
        const arr = getStudents();
        const st = arr[idx];
        if (nameInput) nameInput.value = st.name;
        if (scoreInput) scoreInput.value = st.score;
        if (genderSelect) genderSelect.value = st.gender;
        selectedImage = st.imageLabel;
        if (st.customImage) {
            customImageData = st.customImage;
            customImageFileId = st.customImageFileId;
            if (preview) {
                preview.innerHTML = `
                    <img src="${st.customImage}" alt="自訂圖片">
                    <button type="button" class="btn-danger" data-action="clear-custom-image">移除自訂圖片</button>
                `;
            }
        }
    }
    updateImagePreview();
}

function closePopup() {
    const genderSelect = document.getElementById('studentGender');
    genderSelect?.removeEventListener('change', updateImagePreview);
    document.getElementById('overlay')?.classList.remove('show');
    document.getElementById('studentPopup')?.classList.remove('show');
}

function updateImagePreview() {
    const gender = document.getElementById('studentGender')?.value || '男';
    const imageSelection = document.getElementById('imageSelection');
    if (!imageSelection) return;
    imageSelection.innerHTML = '';
    const labels = GENDER_IMAGE_LABELS[gender] || [];

    if (selectedImage && !labels.includes(selectedImage)) {
        selectedImage = '';
    }

    labels.forEach((lbl, idx) => {
        const img = document.createElement('img');
        img.src = IMAGE_MAP[lbl];
        img.alt = lbl;
        img.addEventListener('click', () => {
            document.querySelectorAll('.image-preview img').forEach(x => x.classList.remove('selected'));
            img.classList.add('selected');
            selectedImage = lbl;
            customImageData = null;
            customImageFileId = null;
            const preview = document.getElementById('customImagePreview');
            const uploadInput = document.getElementById('customImageUpload');
            if (preview) preview.innerHTML = '';
            if (uploadInput) uploadInput.value = '';
        });

        if (!customImageData && ((idx === 0 && !selectedImage) || selectedImage === lbl)) {
            img.classList.add('selected');
            selectedImage = lbl;
        }
        imageSelection.appendChild(img);
    });
}

function saveStudent() {
    if (checkIfUpdating()) return;
    const nameEl = document.getElementById('studentName');
    const scoreEl = document.getElementById('studentScore');
    const genderEl = document.getElementById('studentGender');
    if (!nameEl || !scoreEl || !genderEl) return;
    const name = nameEl.value.trim();
    const score = parseInt(scoreEl.value, 10) || 0;
    const gender = genderEl.value;

    let imageData = null;
    let imageFileId = null;
    let imageLabel = '';

    if (customImageData) {
        imageData = customImageData;
        imageFileId = customImageFileId;
    } else {
        imageLabel = resolveImageLabel({ gender, selectedLabel: selectedImage });
    }

    if (!name) {
        alert('請輸入學生姓名');
        return;
    }

    const arr = getStudents();
    const existingHistory = editIndex !== -1 && Array.isArray(arr[editIndex]?.deductionHistory)
        ? arr[editIndex].deductionHistory
        : [];
    const studentData = {
        name,
        score,
        gender,
        imageLabel,
        customImage: imageData,
        customImageFileId: imageFileId,
        deductionHistory: editIndex === -1 ? [] : existingHistory
    };

    if (editIndex === -1) {
        arr.push(studentData);
    } else {
        const existingStudent = arr[editIndex];
        if (existingStudent) {
            const previousScore = Number(existingStudent.score) || 0;
            if (previousScore !== score) {
                recordScoreEvent({
                    studentName: name,
                    studentIndex: editIndex,
                    previousScore,
                    delta: score - previousScore,
                    newScore: score,
                    type: 'manual-edit',
                    metadata: {
                        source: 'student-editor',
                        previousName: existingStudent.name
                    }
                });
            }
            if (existingStudent.name !== name) {
                syncScoreEventsForStudent(editIndex, existingStudent.name || '', name);
            }
        }
        arr[editIndex] = studentData;
    }

    saveClassesLocal();
    closePopup();
    renderStudents();
    markDirty();
}

function exportCSV() {
    if (checkIfUpdating()) return;
    const arr = getStudents();
    const csv = '姓名,分數,性別,預設圖片,自訂圖片ID\n' +
        arr.map(s => `${s.name},${s.score},${s.gender},${s.imageLabel || ''},${s.customImageFileId || ''}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentClass}-students.csv`;
    a.click();
}

async function importCSV(evt) {
    const file = evt.target.files?.[0];
    if (!file) return;
    if (!googleAuth.getIsSignedIn()) {
        alert('請先登入 Google 帳號才能匯入包含自訂圖片的資料');
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        const content = e.target?.result;
        if (typeof content !== 'string') return;
        const lines = content.split('\n').map(x => x.trim()).filter(Boolean);
        const headers = lines.shift().split(',');
        const hasCustomImage = headers.includes('自訂圖片ID');
        const newArr = [];

        for (const line of lines) {
            const [name, scoreText, gender, imageLabelRaw = '', customImageFileId = ''] = line.split(',');
            const score = parseInt(scoreText, 10) || 0;
            let imageLabel = imageLabelRaw;
            if (!imageLabel) {
                const labs = GENDER_IMAGE_LABELS[gender] || ['男1'];
                imageLabel = labs[0];
            }
            const student = { name, score, gender, imageLabel, deductionHistory: [] };
            if (hasCustomImage && customImageFileId) {
                try {
                    const imageUrl = await googleDrive.getImageUrlFromDrive(customImageFileId);
                    student.customImage = imageUrl;
                    student.customImageFileId = customImageFileId;
                } catch (err) {
                    console.warn(`無法取得圖片 ${customImageFileId} 的URL:`, err);
                    student.customImage = null;
                    student.customImageFileId = null;
                }
            }
            newArr.push(student);
        }

        classes[currentClass] = newArr;
        syncScoreEventIndexesForClass();
        saveClassesLocal();
        renderStudents();
        markDirty();
    };
    reader.readAsText(file);
}

function showClassPopup() {
    if (checkIfUpdating()) return;
    document.getElementById('classOverlay')?.classList.add('show');
    document.getElementById('classPopup')?.classList.add('show');
    renderClassList();
}

function closeClassPopup() {
    document.getElementById('classOverlay')?.classList.remove('show');
    document.getElementById('classPopup')?.classList.remove('show');
}

function renderClassList() {
    const listEl = document.getElementById('classList');
    if (!listEl) return;
    listEl.innerHTML = '';
    const cNames = getClassNames(classes);
    cNames.forEach(cName => {
        const div = document.createElement('div');
        div.classList.add('class-item');
        const disableDelete = cNames.length <= 1;
        div.innerHTML = `
            <span class="class-name">${cName}</span>
            <div>
                <button class="btn-rename" type="button">修改</button>
                <button class="btn-delete-class" type="button" ${disableDelete ? 'disabled' : ''}>刪除</button>
            </div>
        `;
        div.querySelector('.btn-rename')?.addEventListener('click', () => renameClassPrompt(cName));
        div.querySelector('.btn-delete-class')?.addEventListener('click', () => {
            if (disableDelete) {
                alert('只剩最後一個班級，無法刪除');
                return;
            }
            deleteClass(cName);
        });
        listEl.appendChild(div);
    });
}

function addClassPrompt() {
    if (checkIfUpdating()) return;
    let newName = prompt('請輸入新班級名稱：');
    if (!newName) return;
    newName = newName.trim();
    if (!newName) return;
    if (classes[newName]) {
        alert('此班級已存在');
        return;
    }
    classes[newName] = [];
    saveClassesLocal();
    currentClass = newName;
    closeScoreHistory();
    renderClassDropdown();
    renderStudents();
    renderClassList();
    markDirty();
}

function renameClassPrompt(oldName) {
    if (checkIfUpdating()) return;
    let newName = prompt('新的班級名稱', oldName);
    if (!newName) return;
    newName = newName.trim();
    if (!newName || newName === oldName) return;
    if (classes[newName]) {
        alert('此班級已存在');
        return;
    }
    classes[newName] = classes[oldName];
    delete classes[oldName];
    if (Array.isArray(classes.scoreEvents)) {
        classes.scoreEvents = classes.scoreEvents.map(event => (
            event && event.className === oldName
                ? { ...event, className: newName }
                : event
        ));
    }
    if (currentClass === oldName) currentClass = newName;
    saveClassesLocal();
    renderClassDropdown();
    renderStudents();
    renderClassList();
    markDirty();
}

function deleteClass(cName) {
    if (checkIfUpdating()) return;
    const cCount = getClassNames(classes).length;
    if (cCount <= 1) {
        alert('只剩最後一個班級，無法刪除');
        return;
    }
    if (!confirm(`確定刪除「${cName}」?`)) return;
    delete classes[cName];
    if (Array.isArray(classes.scoreEvents)) {
        classes.scoreEvents = classes.scoreEvents.filter(event => event?.className !== cName);
    }
    currentClass = getInitialClassName(classes);
    closeScoreHistory();
    saveClassesLocal();
    renderClassDropdown();
    renderStudents();
    renderClassList();
    markDirty();
}

async function collectUploadedImages() {
    uploadedImages.clear();
    Object.values(classes).forEach(students => {
        if (!Array.isArray(students)) return;
        students.forEach(student => {
            if (student.customImage && student.customImageFileId) {
                uploadedImages.add(JSON.stringify({
                    url: student.customImage,
                    id: student.customImageFileId,
                    name: '使用中的圖片'
                }));
            }
        });
    });

    try {
        const driveImages = await googleDrive.getAllImages();
        driveImages.forEach(img => {
            uploadedImages.add(JSON.stringify({
                url: img.url,
                id: img.id,
                name: img.name
            }));
        });
    } catch (err) {
        console.error('取得 Google Drive 圖片失敗:', err);
    }
}

function updateUploadedImagesSection() {
    const customImageUpload = document.querySelector('.custom-image-upload');
    if (!customImageUpload) return;
    const oldSection = document.querySelector('.uploaded-images-section');
    if (oldSection) oldSection.remove();
    if (uploadedImages.size === 0) return;

    const section = document.createElement('div');
    section.className = 'uploaded-images-section';
    section.innerHTML = `
        <h4>選擇已上傳的圖片</h4>
        <div class="uploaded-images-grid"></div>
    `;
    const grid = section.querySelector('.uploaded-images-grid');
    [...uploadedImages].forEach(imageInfo => {
        const { url, id, name } = JSON.parse(imageInfo);
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-container';
        imgContainer.innerHTML = `
            <img src="${url}" alt="${name}" title="${name}">
            <button class="image-delete-btn" title="刪除圖片" type="button">×</button>
            <div class="image-name">${name}</div>
        `;
        const img = imgContainer.querySelector('img');
        if (customImageData === url) {
            img?.classList.add('selected');
        }
        img?.addEventListener('click', () => {
            document.querySelectorAll('.uploaded-images-grid img').forEach(node => node.classList.remove('selected'));
            document.querySelectorAll('.image-preview img').forEach(node => node.classList.remove('selected'));
            img.classList.add('selected');
            customImageData = url;
            customImageFileId = id;
            selectedImage = '';
            const preview = document.getElementById('customImagePreview');
            if (preview) {
                preview.innerHTML = `
                    <img src="${url}" alt="${name}">
                    <button type="button" class="btn-danger" data-action="clear-custom-image">移除自訂圖片</button>
                `;
            }
        });

        imgContainer.querySelector('.image-delete-btn')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            let isInUse = false;
            Object.values(classes).forEach(students => {
                if (!Array.isArray(students)) return;
                students.forEach(student => {
                    if (student.customImageFileId === id) {
                        isInUse = true;
                    }
                });
            });
            if (isInUse) {
                alert('此圖片正在使用中，無法刪除');
                return;
            }
            if (!confirm('確定要刪除這張圖片嗎？')) return;
            try {
                await googleDrive.deleteFile(id);
                if (customImageFileId === id) {
                    clearCustomImage();
                }
                uploadedImages.delete(imageInfo);
                updateUploadedImagesSection();
            } catch (err) {
                alert('刪除失敗，請稍後再試');
            }
        });

        grid?.appendChild(imgContainer);
    });
    customImageUpload.appendChild(section);
}

function addSettingsPopup() {
    const overlay = document.createElement('div');
    overlay.id = 'settingsOverlay';
    overlay.className = 'overlay';

    const popup = document.createElement('div');
    popup.id = 'settingsPopup';
    popup.className = 'popup dialog';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-labelledby', 'scoreSettingsTitle');
    popup.innerHTML = `
        <div class="dialog-header">
            <h2 id="scoreSettingsTitle" class="dialog-title">分數按鈕設定</h2>
            <button type="button" class="dialog-close" data-dialog-close="settings" aria-label="關閉分數按鈕設定">×</button>
        </div>
        <div class="dialog-body">
            <p>請設定四個按鈕的分數值：</p>
            <div class="score-settings-grid">
                ${classes.scoreButtons.map((value, index) => `
                    <label>
                        <span>第 ${index + 1} 個按鈕：</span>
                        <input type="number" id="btn${index + 1}" value="${value}">
                    </label>
                `).join('')}
            </div>
        </div>
        <div class="dialog-footer">
            <button type="button" class="btn-primary" data-action="save-score-settings">儲存</button>
            <button type="button" class="btn-secondary" data-action="close-score-settings">取消</button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(popup);
}

function showScoreButtonsSettings() {
    if (checkIfUpdating()) return;
    if (!document.getElementById('settingsOverlay')) {
        addSettingsPopup();
    }
    document.getElementById('settingsOverlay')?.classList.add('show');
    document.getElementById('settingsPopup')?.classList.add('show');
}

function closeScoreButtonsSettings() {
    document.getElementById('settingsOverlay')?.classList.remove('show');
    document.getElementById('settingsPopup')?.classList.remove('show');
}

function saveScoreButtonsSettings() {
    if (checkIfUpdating()) return;
    const values = [];
    for (let i = 1; i <= 4; i += 1) {
        const input = document.getElementById(`btn${i}`);
        values.push(parseInt(input?.value ?? '0', 10) || 0);
    }
    classes.scoreButtons = values;
    saveClassesLocal();
    renderStudents();
    closeScoreButtonsSettings();
    markDirty();
}

function initUI() {
    document.getElementById('login-btn')?.addEventListener('click', () => {
        showLoginProcessingOverlay();
        googleAuth.signIn();
    });
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

    document.getElementById('classSelect')?.addEventListener('change', (evt) => {
        if (checkIfUpdating()) {
            evt.target.value = currentClass;
            return;
        }
        currentClass = evt.target.value;
        closeScoreHistory();
        renderStudents();
    });

    document.getElementById('importCSV')?.addEventListener('change', (evt) => {
        if (checkIfUpdating()) {
            evt.target.value = '';
            return;
        }
        importCSV(evt);
    });

    document.getElementById('syncStatusBar')?.addEventListener('click', () => {
        if (syncState === 'updating') {
            alert('同步處理中，請稍候...');
            return;
        }
        if (syncState !== 'dirty') {
            alert('資料已是最新狀態');
            return;
        }
        performSync();
    });

    document.getElementById('btnSaveStudent')?.addEventListener('click', saveStudent);
    document.getElementById('btnClosePopup')?.addEventListener('click', closePopup);
    document.getElementById('btnUploadImage')?.addEventListener('click', () => {
        document.getElementById('customImageUpload')?.click();
    });
    document.getElementById('customImageUpload')?.addEventListener('change', handleCustomImageUpload);

    document.getElementById('studentPopup')?.addEventListener('click', (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.dataset.action === 'clear-custom-image') {
            clearCustomImage();
        }
    });

    document.getElementById('btnLoginNow')?.addEventListener('click', () => {
        closeLoginChoice();
        showLoginProcessingOverlay();
        googleAuth.signIn();
    });

    document.getElementById('btnAddClass')?.addEventListener('click', addClassPrompt);
    document.getElementById('btnCloseClassPopup')?.addEventListener('click', closeClassPopup);

    document.getElementById('btnScoreSettings')?.addEventListener('click', showScoreButtonsSettings);
    document.getElementById('btnClassManage')?.addEventListener('click', showClassPopup);
    document.getElementById('btnAddStudent')?.addEventListener('click', () => showPopup(-1));

    document.getElementById('btnExportCSV')?.addEventListener('click', exportCSV);
    document.getElementById('btnImportCSV')?.addEventListener('click', () => {
        document.getElementById('importCSV')?.click();
    });

    document.getElementById('btnExamTimer')?.addEventListener('click', () => {
        if (checkIfUpdating()) return;
        if (typeof initExamTimer === 'function') {
            initExamTimer();
        }
    });

    document.getElementById('btnDeductionManage')?.addEventListener('click', () => {
        if (checkIfUpdating()) return;
        deductionManager?.open();
    });

    document.body.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.dataset.action === 'close-score-settings') {
            closeScoreButtonsSettings();
        }
        if (target.dataset.action === 'save-score-settings') {
            saveScoreButtonsSettings();
        }
    });

    document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const closeType = target.dataset.dialogClose;
        if (!closeType) return;
        event.preventDefault();
        switch (closeType) {
            case 'student':
                closePopup();
                break;
            case 'class':
                closeClassPopup();
                break;
            case 'login-processing':
                backToLoginChoice();
                break;
            case 'sync':
                hideSyncOverlay();
                break;
            case 'settings':
                closeScoreButtonsSettings();
                break;
            default:
                break;
        }
    });

    window.addEventListener('keydown', (evt) => {
        if (evt.key !== 'Escape') return;
        if (scoreHistoryOverlay?.classList.contains('show')) {
            closeScoreHistory();
        } else if (document.getElementById('settingsOverlay')?.classList.contains('show')) {
            closeScoreButtonsSettings();
        } else if (document.getElementById('overlay')?.classList.contains('show')) {
            closePopup();
        } else if (document.getElementById('classOverlay')?.classList.contains('show')) {
            closeClassPopup();
        } else if (document.getElementById('loginProcessingOverlay')?.classList.contains('show')) {
            backToLoginChoice();
        } else if (document.getElementById('syncOverlay')?.classList.contains('show')) {
            hideSyncOverlay();
        }
    });
}

function handleLogout() {
    if (!googleAuth.getAccessToken()) {
        alert('尚未登入');
        return;
    }
    stopAutoSyncTimer();
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    googleAuth.signOut(() => {
        hideMainButtons();
        backToLoginChoice();
    });
}

function initializeApp() {
    hideMainButtons();
    if (googleAuth.getIsSignedIn()) {
        showMainButtons();
        markSynced();
        loadClassesFromDrive();
        setupActivityListeners();
        resetInactivityTimer();
    } else {
        showLoginChoice();
    }

    googleAuth.initGoogleAuth(
        () => {
            hideLoginProcessingOverlay();
            showMainButtons();
            closeLoginChoice();
            markSynced();
            loadClassesFromDrive();
            setupActivityListeners();
            resetInactivityTimer();
        },
        () => {
            hideLoginProcessingOverlay();
            storage?.removeItem('googleAccessToken');
            backToLoginChoice();
        }
    );

    if (!deductionManager) {
        deductionManager = createDeductionManager({
            getItems: () => [...getDeductionItems()],
            setItems: setDeductionItems,
            checkIfUpdating
        });
    }

    initUI();
    setSyncState(syncState);
    updateSyncStatus();
    renderClassDropdown();
    renderStudents();
    deductionManager?.refresh();
    initWheel(() => getStudents(), () => classes);

    window.clearCustomImage = clearCustomImage;
}

window.addEventListener('DOMContentLoaded', initializeApp);

export function getClassesReference() {
    return classes;
}

export { getStudents };
