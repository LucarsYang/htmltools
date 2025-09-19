export function createDeductionManager({ getItems, setItems, checkIfUpdating }) {
    const overlay = document.createElement('div');
    overlay.id = 'deductionManagerOverlay';
    overlay.className = 'deduction-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = `
        <div class="deduction-container" role="dialog" aria-modal="true" aria-labelledby="deductionTitle">
            <header class="deduction-header">
                <div class="deduction-header-content">
                    <h2 id="deductionTitle" class="deduction-title">管理扣分項目</h2>
                    <p class="deduction-description">預先建立常用的扣分項目，於學生卡片快速套用</p>
                </div>
                <button type="button" class="deduction-close" aria-label="關閉扣分項目管理">×</button>
            </header>
            <div class="deduction-body">
                <div class="deduction-actions">
                    <button type="button" class="deduction-add-btn">+ 新增扣分項目</button>
                </div>
                <div class="deduction-table-wrapper">
                    <div class="deduction-table-scroll">
                        <table class="deduction-table" aria-describedby="deductionTitle">
                            <thead>
                                <tr>
                                    <th scope="col">項目名稱</th>
                                    <th scope="col">扣除分數</th>
                                    <th scope="col">操作</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        </table>
                    </div>
                    <p class="deduction-empty" role="status" aria-live="polite"></p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const editorOverlay = document.createElement('div');
    editorOverlay.className = 'deduction-editor-overlay';
    editorOverlay.setAttribute('aria-hidden', 'true');
    editorOverlay.innerHTML = `
        <div class="deduction-editor" role="dialog" aria-modal="true" aria-labelledby="deductionEditorTitle">
            <header class="deduction-editor-header">
                <h3 id="deductionEditorTitle">新增扣分項目</h3>
                <button type="button" class="deduction-editor-close" aria-label="關閉扣分項目編輯">×</button>
            </header>
            <div class="deduction-editor-body">
                <form class="deduction-editor-form">
                    <label class="deduction-field" for="deductionName">
                        <span>項目名稱</span>
                        <input type="text" id="deductionName" name="deductionName" placeholder="例如：未交作業" required maxlength="30">
                    </label>
                    <label class="deduction-field" for="deductionPoints">
                        <span>扣除分數</span>
                        <input type="number" id="deductionPoints" name="deductionPoints" placeholder="例如：-5" required max="0">
                        <small>請輸入 0 或負數，例如 -5</small>
                    </label>
                    <p class="deduction-error" role="alert" aria-live="assertive"></p>
                    <div class="deduction-editor-footer">
                        <button type="submit" class="btn-primary" data-action="save">儲存</button>
                        <button type="button" class="btn-secondary" data-action="cancel">取消</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.appendChild(editorOverlay);

    const table = overlay.querySelector('.deduction-table');
    const tbody = overlay.querySelector('tbody');
    const closeBtn = overlay.querySelector('.deduction-close');
    const addBtn = overlay.querySelector('.deduction-add-btn');
    const emptyMessage = overlay.querySelector('.deduction-empty');

    const editorTitle = editorOverlay.querySelector('#deductionEditorTitle');
    const editorClose = editorOverlay.querySelector('.deduction-editor-close');
    const editorForm = editorOverlay.querySelector('.deduction-editor-form');
    const nameInput = editorOverlay.querySelector('#deductionName');
    const pointsInput = editorOverlay.querySelector('#deductionPoints');
    const errorEl = editorOverlay.querySelector('.deduction-error');
    const cancelBtn = editorOverlay.querySelector('[data-action="cancel"]');

    let editingId = null;
    let lastFocusedElement = null;

    function ensureArray(items) {
        if (!Array.isArray(items)) return [];
        return items.filter(item => item && typeof item.name === 'string' && Number.isFinite(Number(item.points)));
    }

    function generateId(items) {
        const used = new Set(items.map(item => item.id));
        let base = Date.now();
        while (used.has(base)) {
            base += 1;
        }
        return base;
    }

    function renderList() {
        if (!tbody || !table || !emptyMessage) return;
        const items = ensureArray(typeof getItems === 'function' ? getItems() : []);

        tbody.innerHTML = '';

        if (!items.length) {
            table.style.display = 'none';
            emptyMessage.textContent = '尚未建立扣分項目';
            emptyMessage.style.display = 'block';
            return;
        }

        table.style.display = 'table';
        emptyMessage.textContent = '';
        emptyMessage.style.display = 'none';

        items.forEach(item => {
            const row = document.createElement('tr');
            row.dataset.id = String(item.id);

            const nameCell = document.createElement('td');
            nameCell.textContent = item.name;

            const pointsCell = document.createElement('td');
            const pointValue = Number(item.points) || 0;
            pointsCell.textContent = pointValue > 0 ? `+${pointValue}` : String(pointValue);

            const actionCell = document.createElement('td');
            actionCell.className = 'deduction-table-actions';

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'deduction-action-btn deduction-action-btn--edit';
            editBtn.textContent = '編輯';
            editBtn.dataset.action = 'edit';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'deduction-action-btn deduction-action-btn--delete';
            deleteBtn.textContent = '刪除';
            deleteBtn.dataset.action = 'delete';

            actionCell.append(editBtn, deleteBtn);
            row.append(nameCell, pointsCell, actionCell);
            tbody.appendChild(row);
        });
    }

    function openOverlay() {
        renderList();
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
        lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        window.setTimeout(() => {
            addBtn?.focus();
        }, 0);
    }

    function closeOverlay() {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
        closeEditor();
        if (lastFocusedElement instanceof HTMLElement) {
            lastFocusedElement.focus();
        }
    }

    function openEditor(itemId = null) {
        const items = ensureArray(typeof getItems === 'function' ? getItems() : []);
        editingId = itemId;
        errorEl.textContent = '';

        if (itemId !== null) {
            const targetItem = items.find(item => String(item.id) === String(itemId));
            if (!targetItem) {
                editingId = null;
            } else {
                editorTitle.textContent = '編輯扣分項目';
                nameInput.value = targetItem.name;
                pointsInput.value = String(targetItem.points);
            }
        }

        if (editingId === null) {
            editorTitle.textContent = '新增扣分項目';
            nameInput.value = '';
            pointsInput.value = '';
        }

        editorOverlay.classList.add('show');
        editorOverlay.setAttribute('aria-hidden', 'false');
        window.setTimeout(() => {
            nameInput?.focus();
        }, 0);
    }

    function closeEditor() {
        editorOverlay.classList.remove('show');
        editorOverlay.setAttribute('aria-hidden', 'true');
        editingId = null;
    }

    function handleDelete(id) {
        if (typeof checkIfUpdating === 'function' && checkIfUpdating()) {
            return;
        }
        const items = ensureArray(typeof getItems === 'function' ? getItems() : []);
        if (!items.some(item => String(item.id) === String(id))) {
            return;
        }
        if (!window.confirm('確定要刪除此項目嗎？')) {
            return;
        }
        const updated = items.filter(item => String(item.id) !== String(id));
        if (typeof setItems === 'function') {
            setItems(updated);
        }
        renderList();
    }

    function handleSave(evt) {
        if (evt) {
            evt.preventDefault();
        }
        if (typeof checkIfUpdating === 'function' && checkIfUpdating()) {
            return;
        }

        const name = nameInput.value.trim();
        const rawPoints = pointsInput.value.trim();

        if (!name) {
            errorEl.textContent = '請輸入項目名稱';
            nameInput.focus();
            return;
        }
        if (!rawPoints) {
            errorEl.textContent = '請輸入扣除分數';
            pointsInput.focus();
            return;
        }

        const points = Number(rawPoints);
        if (!Number.isFinite(points)) {
            errorEl.textContent = '扣除分數必須為數字';
            pointsInput.focus();
            return;
        }
        if (points > 0) {
            errorEl.textContent = '扣除分數需為 0 或負數';
            pointsInput.focus();
            return;
        }

        const items = ensureArray(typeof getItems === 'function' ? getItems() : []);
        let updatedItems = items;

        if (editingId !== null) {
            let changed = false;
            updatedItems = items.map(item => {
                if (String(item.id) !== String(editingId)) {
                    return item;
                }
                if (item.name !== name || Number(item.points) !== points) {
                    changed = true;
                    return { ...item, name, points };
                }
                return item;
            });
            if (!changed) {
                closeEditor();
                return;
            }
        } else {
            const newId = generateId(items);
            updatedItems = [...items, { id: newId, name, points }];
        }

        if (typeof setItems === 'function') {
            setItems(updatedItems);
        }
        renderList();
        closeEditor();
    }

    function handleTableClick(event) {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const action = target.dataset.action;
        if (!action) return;
        const row = target.closest('tr');
        if (!row) return;
        const id = row.dataset.id;
        if (!id) return;
        if (action === 'edit') {
            openEditor(id);
        } else if (action === 'delete') {
            handleDelete(id);
        }
    }

    function handleEscape() {
        if (editorOverlay.classList.contains('show')) {
            closeEditor();
        } else if (overlay.classList.contains('show')) {
            closeOverlay();
        }
    }

    addBtn?.addEventListener('click', () => openEditor(null));
    closeBtn?.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeOverlay();
        }
    });
    tbody?.addEventListener('click', handleTableClick);

    editorForm?.addEventListener('submit', handleSave);
    editorClose?.addEventListener('click', closeEditor);
    cancelBtn?.addEventListener('click', () => {
        closeEditor();
    });
    editorOverlay.addEventListener('click', (event) => {
        if (event.target === editorOverlay) {
            closeEditor();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (!overlay.classList.contains('show')) return;
        event.preventDefault();
        handleEscape();
    });

    renderList();

    return {
        open: openOverlay,
        close: closeOverlay,
        refresh: renderList,
        handleEscape
    };
}
