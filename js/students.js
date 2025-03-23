import { getIsSignedIn } from './googleAuth.js';
import { loadDriveFile, saveDriveFile, uploadImageToDrive, getImageUrlFromDrive, getAllImages, deleteFile } from './googleDrive.js';
import { imageMap, genderImageLabels, getSelectedImage, setSelectedImage,
    checkIfUpdating, markDirty, markUpdating, markSynced,
    showSyncOverlay, hideSyncOverlay,
    showToast } from './utils.js';

// 全域狀態
let classes = JSON.parse(localStorage.getItem("classes")) || { 
    "501": [],
    "scoreButtons": [-5, -1, 1, 5],
    "rewards": ["獎勵", "懲罰"]
};
let currentClass = Object.keys(classes).find(key => !['scoreButtons', 'rewards'].includes(key)) || "一班";

let updatingState = false; // true表示「更新中(黃)」階段 => 阻擋操作
let editIndex = -1;
let customImageData = null; // 儲存自訂圖片的 base64 資料
let customImageFileId = null; // 儲存 Google Drive 上的圖片 ID
let uploadedImages = new Set(); // 儲存所有已上傳的圖片資訊

// 自動同步相關變數
let autoSyncTimer = null;
const AUTO_SYNC_DELAY = 30; // 30秒
let remainingSeconds = 0;

// 自動檢查相關變數
let inactivityTimer = null;
const INACTIVITY_CHECK_DELAY = 60; // 60秒
let lastActivityTime = Date.now();

/**
 * 初始化學生管理模組
 */
export function initStudents() {
    console.log('初始化學生管理模組');
    
    // 初始化 UI 事件
    initUI();
    
    // 渲染班級下拉選單和學生列表
    renderClassDropdown();
    renderStudents();
}

/**
 * 初始化 UI 和事件處理
 */
function initUI() {
    // 班級選擇
    let sel = document.getElementById("classSelect");
    sel.addEventListener("change", (evt) => {
        if (checkIfUpdating()) { 
            evt.target.value = currentClass; 
            return; 
        }
        currentClass = evt.target.value;
        renderStudents();
    });

    // 管理功能子選單切換
    document.getElementById("btnManage").addEventListener("click", function() {
        this.classList.toggle("active");
    });

    // 資料管理子選單切換
    document.getElementById("btnDataManage").addEventListener("click", function() {
        this.classList.toggle("active");
    });

    // CSV 匯入
    document.getElementById("importCSV").addEventListener("change", (evt) => {
        if (checkIfUpdating()) {
            evt.target.value = "";
            return;
        }
        importCSV(evt);
    });

    // 點擊狀態列觸發同步
    let syncBar = document.getElementById("syncStatusBar");
    syncBar.addEventListener("click", () => {
        // 檢查是否需要同步
        let isDirty = document.getElementById("statusDirty").className === "red";
        if (!isDirty) {
            alert("資料已是最新狀態");
            return;
        }
        
        performSync();
    });

    // 學生 popup
    document.getElementById("btnSaveStudent").addEventListener("click", saveStudent);
    document.getElementById("btnClosePopup").addEventListener("click", closePopup);
    document.getElementById("btnCancelStudent").addEventListener("click", closePopup);
    document.getElementById("btnUploadImage").addEventListener("click", () => {
        document.getElementById("customImageUpload").click();
    });
    document.getElementById("customImageUpload").addEventListener("change", handleCustomImageUpload);

    // 班級管理
    document.getElementById("btnAddClass").addEventListener("click", addClassPrompt);
    document.getElementById("btnCloseClassPopup").addEventListener("click", closeClassPopup);
    document.getElementById("btnCloseClassPopupBottom").addEventListener("click", closeClassPopup);

    // 設定選單
    document.getElementById("btnScoreSettings").addEventListener("click", showScoreButtonsSettings);

    // 管理選單
    document.getElementById("btnClassManage").addEventListener("click", showClassPopup);
    document.getElementById("btnAddStudent").addEventListener("click", () => showPopup('add'));

    // 功能選單
    document.getElementById("btnExportCSV").addEventListener("click", exportCSV);
    document.getElementById("btnImportCSV").addEventListener("click", () => {
        document.getElementById("importCSV").click();
    });
    
    // 登入選擇彈窗
    document.getElementById("closeLoginPopup").addEventListener("click", () => {
        document.getElementById("loginOverlay").classList.remove("show");
        document.getElementById("loginPopup").classList.remove("show");
    });
    
    // 設置ESC鍵關閉彈窗
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closePopup();
            closeClassPopup();
            // 關閉其他可能的彈窗
            document.querySelectorAll('.login-overlay, .login-popup, .help-overlay, .help-popup, .wheel-overlay, .wheel-popup').forEach(el => {
                el.classList.remove('show');
            });
        }
    });
    
    // 添加點擊遮罩關閉彈窗功能
    document.querySelectorAll('.overlay, .class-overlay, .login-overlay, .help-overlay, .wheel-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                e.target.classList.remove('show');
                // 找到對應的彈窗並關閉
                const popupId = e.target.id.replace('Overlay', 'Popup');
                document.getElementById(popupId)?.classList.remove('show');
            }
        });
    });
}

/**
 * 取得目前班級的學生列表
 * @returns {Array} 學生列表
 */
export function getStudents() {
    if (!classes[currentClass]) classes[currentClass] = [];
    return classes[currentClass];
}

/**
 * 取得當前班級物件
 * @returns {Object} 班級物件
 */
export function getCurrentClass() {
    return { name: currentClass, students: getStudents() };
}

/**
 * 渲染學生列表
 */
export function renderStudents() {
    let arr = getStudents();
    let container = document.getElementById("studentContainer");
    container.innerHTML = "";
    
    arr.forEach((st, idx) => {
        const card = document.createElement("div");
        card.classList.add("student-card");
        const imgSrc = st.customImage || imageMap[st.imageLabel] || "";
        
        // 添加拖拉屬性
        card.draggable = true;
        card.dataset.index = idx;
        
        // 添加拖拉事件監聽器
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);
        
        // 根據分數正負決定按鈕類別
        const getButtonClass = (score) => {
            return score >= 0 ? 'positive' : 'negative';
        };
        
        // 創建學生卡片內容
        card.innerHTML = `
            <button class="delete-btn">×</button>
            <img src="${imgSrc}" alt="${st.gender}">
            <p>${st.name}</p>
            <p id="score-${idx}">${st.score} 分</p>
            <button class="btn-score ${getButtonClass(classes.scoreButtons[0])}">${classes.scoreButtons[0] >= 0 ? '+' : ''}${classes.scoreButtons[0]}</button>
            <button class="btn-score ${getButtonClass(classes.scoreButtons[1])}">${classes.scoreButtons[1] >= 0 ? '+' : ''}${classes.scoreButtons[1]}</button>
            <button class="btn-score ${getButtonClass(classes.scoreButtons[2])}">${classes.scoreButtons[2] >= 0 ? '+' : ''}${classes.scoreButtons[2]}</button>
            <button class="btn-score ${getButtonClass(classes.scoreButtons[3])}">${classes.scoreButtons[3] >= 0 ? '+' : ''}${classes.scoreButtons[3]}</button>
            <div class="quickAdjust">
                <select id="sign-${idx}">
                    <option value="+">+</option>
                    <option value="-">-</option>
                </select>
                <input type="number" id="custom-${idx}" placeholder="自訂分數" style="width:60px;">
                <button class="custom-adjust-btn">確定</button>
            </div>
        `;
        
        // 添加事件監聽器
        const deleteBtn = card.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => deleteStudent(idx));
        
        const studentImage = card.querySelector('img');
        studentImage.addEventListener('click', () => editStudent(idx));
        
        const scoreButtons = card.querySelectorAll('.btn-score');
        scoreButtons.forEach((btn, btnIdx) => {
            btn.addEventListener('click', () => updateScore(idx, classes.scoreButtons[btnIdx]));
        });
        
        const customAdjustBtn = card.querySelector('.custom-adjust-btn');
        customAdjustBtn.addEventListener('click', () => customAdjust(idx));
        
        container.appendChild(card);
    });
}

/**
 * 拖拉相關函數 - 開始拖動
 */
function handleDragStart(e) {
    this.classList.add('dragging');
    e.dataTransfer.setData('text/plain', this.dataset.index);
}

/**
 * 拖拉相關函數 - 結束拖動
 */
function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.student-card').forEach(card => {
        card.classList.remove('drag-over');
    });
}

/**
 * 拖拉相關函數 - 拖過元素上方
 */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
}

/**
 * 拖拉相關函數 - 放置元素
 */
function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const toIndex = parseInt(this.dataset.index);
    
    if (fromIndex === toIndex) return;
    
    // 更新陣列順序
    const arr = getStudents();
    const [movedStudent] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, movedStudent);
    
    // 儲存並重新渲染
    saveClassesLocal();
    renderStudents();
    markDirty();
}

/**
 * 編輯學生
 * @param {number} idx 學生索引
 */
export function editStudent(idx) {
    if (checkIfUpdating()) return;
    
    // 獲取學生數據
    const students = getStudents();
    if (idx < 0 || idx >= students.length) {
        showToast('找不到要編輯的學生', 'error');
        return;
    }
    
    // 傳遞正確的模式和學生對象
    showPopup('edit', {idx: idx, ...students[idx]});
}

/**
 * 刪除學生
 * @param {number} idx 學生索引
 */
export function deleteStudent(idx) {
    if (checkIfUpdating()) return;
    
    let students = getStudents();
    if (idx < 0 || idx >= students.length) {
        showToast('找不到要刪除的學生', 'error');
        return;
    }
    
    const student = students[idx];
    if (!confirm(`確定要刪除學生「${student.name}」嗎？此操作無法恢復。`)) {
        return;
    }
    
    students.splice(idx, 1);
    
    // 更新班級資料並儲存
    saveClassesLocal();
    
    localStorage.setItem('students', JSON.stringify(students));
    renderStudents();
    showToast(`已刪除學生：${student.name}`, 'success');
    markDirty();
}

/**
 * 更新學生分數
 * @param {number} idx 學生索引
 * @param {number} delta 分數變化
 */
export function updateScore(idx, delta) {
    if (checkIfUpdating()) return;
    let arr = getStudents();
    arr[idx].score += delta;
    saveClassesLocal();
    document.getElementById(`score-${idx}`).textContent = arr[idx].score + " 分";
    markDirty();
}

/**
 * 自訂分數調整
 * @param {number} idx 學生索引
 */
export function customAdjust(idx) {
    if (checkIfUpdating()) return;
    let arr = getStudents();
    let signSel = document.getElementById(`sign-${idx}`);
    let customIn = document.getElementById(`custom-${idx}`);
    let sign = signSel.value;
    let val = parseInt(customIn.value) || 0;
    if (sign === "-") val = -val;
    arr[idx].score += val;
    saveClassesLocal();
    document.getElementById(`score-${idx}`).textContent = arr[idx].score + " 分";
    customIn.value = "";
    markDirty();
}

/**
 * 處理自訂圖片上傳
 * @param {Event} evt 事件對象
 */
async function handleCustomImageUpload(evt) {
    const file = evt.target.files[0];
    if (!file) return;

    // 檢查檔案類型
    if (!file.type.startsWith('image/')) {
        showToast('請上傳圖片檔案', 'error');
        return;
    }

    // 檢查檔案大小（限制為 5MB）
    if (file.size > 5 * 1024 * 1024) {
        showToast('圖片大小不能超過 5MB', 'error');
        return;
    }

    // 檢查是否已登入 Google
    if (!getIsSignedIn()) {
        showToast('請先登入 Google 帳號才能上傳圖片', 'error');
        return;
    }

    try {
        // 顯示上傳中的提示
        const preview = document.getElementById('customImagePreview');
        preview.innerHTML = `
            <div class="upload-progress-container">
                <div class="upload-progress-bar" id="uploadProgressBar"></div>
                <div class="upload-progress-text" id="uploadProgressText">準備上傳...</div>
            </div>
        `;

        // 顯示上傳開始通知
        showToast('圖片上傳中...', 'info');
        
        // 模擬上傳進度
        let progress = 0;
        const progressBar = document.getElementById('uploadProgressBar');
        const progressText = document.getElementById('uploadProgressText');
        
        const progressInterval = setInterval(() => {
            if (progress < 90) {
                progress += 5;
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `上傳中 ${progress}%`;
            }
        }, 200);

        // 上傳到 Google Drive
        const fileId = await uploadImageToDrive(file);
        customImageFileId = fileId;
        
        // 取得圖片的公開連結
        const imageUrl = getImageUrlFromDrive(fileId);
        customImageData = imageUrl;
        
        // 清除進度間隔
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        progressText.textContent = '上傳完成 100%';
        
        // 短暫延遲後更新預覽
        setTimeout(() => {
            preview.innerHTML = `
                <img src="${imageUrl}" alt="自訂圖片">
                <button id="removeCustomImgBtn" style="display:block; margin:5px auto; background:#ff4d4d;">移除自訂圖片</button>
            `;
            
            // 添加移除圖片按鈕事件
            document.getElementById("removeCustomImgBtn").addEventListener("click", clearCustomImage);
            
            // 取消選擇預設圖片
            document.querySelectorAll(".image-preview img").forEach(x => x.classList.remove("selected"));
            setSelectedImage("");

            // 更新已上傳圖片集合
            uploadedImages.add(JSON.stringify({
                url: imageUrl,
                id: fileId
            }));
            
            // 更新已上傳圖片區域
            updateUploadedImagesSection();
            
            // 顯示成功通知
            showToast('圖片上傳成功', 'success');
        }, 500);
    } catch (err) {
        console.error('圖片上傳失敗:', err);
        showToast('圖片上傳失敗，請稍後再試', 'error');
        document.getElementById('customImagePreview').innerHTML = '';
    }
}

/**
 * 清除自訂圖片
 */
export function clearCustomImage() {
    customImageData = null;
    customImageFileId = null;
    document.getElementById("customImagePreview").innerHTML = "";
    document.getElementById("customImageUpload").value = "";
    
    // 清除已上傳圖片的選中狀態
    document.querySelectorAll('.uploaded-images-grid img').forEach(img => {
        img.classList.remove('selected');
    });
    
    // 選擇第一個預設圖片
    let gender = document.getElementById("studentGender").value;
    let labels = genderImageLabels[gender];
    setSelectedImage(labels[0]);
    updateImagePreview();
}

/**
 * 更新圖片預覽
 */
function updateImagePreview() {
    let gender = document.getElementById("studentGender").value;
    let imageSelection = document.getElementById("imageSelection");
    imageSelection.innerHTML = "";
    let labels = genderImageLabels[gender];
    
    // 如果切換性別後，之前選中的圖片不屬於新性別，則重置選擇
    const currentSelected = getSelectedImage();
    if (currentSelected && !labels.includes(currentSelected)) {
        setSelectedImage("");
    }
    
    labels.forEach((lbl, idx) => {
        let img = document.createElement("img");
        img.src = imageMap[lbl];
        img.setAttribute('data-label', lbl);
        img.onclick = () => {
            // 選擇此圖片
            setSelectedImage(lbl);
            
            // 清除自訂圖片
            customImageData = null;
            customImageFileId = null;
            document.getElementById("customImagePreview").innerHTML = "";
            document.getElementById("customImageUpload").value = "";
        };
        
        // 選中圖片的邏輯：如果沒有自訂圖片時才套用
        if (!customImageData && ((idx === 0 && !currentSelected) || currentSelected === lbl)) {
            setSelectedImage(lbl);
        }
        
        imageSelection.appendChild(img);
    });
}

// 更多函數...會在另外的檔案中繼續實現

/**
 * 儲存班級資料到本地
 */
export function saveClassesLocal() {
    localStorage.setItem("classes", JSON.stringify(classes));
}

// 將 window 物件暴露的函數定義全局參照
window.deleteStudent = deleteStudent;
window.editStudent = editStudent;
window.updateScore = updateScore;
window.customAdjust = customAdjust;
window.clearCustomImage = clearCustomImage;

// 添加新增/編輯學生功能，這些會在另一個檔案中繼續補充
export function showPopup(mode = 'add', student = null) {
    if (checkIfUpdating()) return;

    document.getElementById("overlay").classList.add("show");
    document.getElementById("studentPopup").classList.add("show");
    
    let nameField = document.getElementById("studentName");
    let genderField = document.getElementById("studentGender");
    let scoreField = document.getElementById("studentScore");
    
    // 初始化值
    editIndex = student ? student.idx : -1;
    customImageData = student ? student.customImage : null;
    customImageFileId = student ? student.id : null;
    document.getElementById("customImagePreview").innerHTML = "";
    document.getElementById("customImageUpload").value = "";
    
    if (mode === 'add') {
        // 新增模式
        document.getElementById("popupTitle").textContent = "新增學生";
        nameField.value = "";
        genderField.value = "男";
        scoreField.value = "0";
        setSelectedImage("");
    } else if (mode === 'edit' && student) {
        // 編輯模式
        document.getElementById("popupTitle").textContent = "編輯學生";
        nameField.value = student.name || "";
        genderField.value = student.gender || "男";
        scoreField.value = student.score || "0";
        
        // 設置自訂圖片或已選圖片
        if (student.customImage) {
            customImageData = student.customImage;
            document.getElementById("customImagePreview").innerHTML = `
                <img src="${student.customImage}" alt="自訂圖片">
                <button id="removeCustomImgBtn" style="display:block; margin:5px auto; background:#ff4d4d;">移除自訂圖片</button>
            `;
            // 添加移除圖片按鈕事件
            document.getElementById("removeCustomImgBtn").addEventListener("click", clearCustomImage);
        } else {
            setSelectedImage(student.imageLabel || "");
        }
    } else {
        // 處理無效情況
        document.getElementById("popupTitle").textContent = "新增學生";
        nameField.value = "";
        genderField.value = "男";
        scoreField.value = "0";
        setSelectedImage("");
    }
    
    // 更新性別對應的圖片預覽
    genderField.addEventListener("change", updateImagePreview);
    updateImagePreview();
    
    // 更新已上傳圖片區域
    updateUploadedImagesSection();
    
    // 初始化拖放上傳功能
    initDragDropUpload();
}

export function closePopup() {
    document.getElementById("overlay").classList.remove("show");
    document.getElementById("studentPopup").classList.remove("show");
    editIndex = -1;
}

export function saveStudent() {
    const nameField = document.getElementById("studentName");
    const scoreField = document.getElementById("studentScore");
    const genderField = document.getElementById("studentGender");
    
    // 表單驗證
    if (!nameField.value.trim()) {
        nameField.classList.add('error');
        showToast('請輸入學生姓名', 'error');
        nameField.focus();
        return;
    } else {
        nameField.classList.remove('error');
    }
    
    if (!scoreField.value || scoreField.value < 0) {
        scoreField.classList.add('error');
        showToast('請輸入有效的分數', 'error');
        scoreField.focus();
        return;
    } else {
        scoreField.classList.remove('error');
    }
    
    // 取得已選擇的圖片
    let imageSrc = getSelectedImage();
    let student = {
        name: nameField.value,
        score: parseInt(scoreField.value, 10),
        gender: genderField.value,
        image: imageSrc,
        customImage: customImageData,
        customImageId: customImageFileId
    };
    
    let students = getStudents();
    
    if (editIndex === -1) {
        // 新增模式
        students.push(student);
        showToast(`已新增學生：${student.name}`, 'success');
    } else {
        // 編輯模式
        students[editIndex] = student;
        showToast(`已更新學生：${student.name}`, 'success');
    }
    
    localStorage.setItem('students', JSON.stringify(students));
    
    // 直接更新班級資料並儲存
    saveClassesLocal();
    
    closePopup();
    renderStudents();
    markDirty();
}

export function renderClassDropdown() {
    let sel = document.getElementById("classSelect");
    sel.innerHTML = "";
    Object.keys(classes).forEach(className => {
        // 排除系統特殊屬性
        if (className !== "scoreButtons" && className !== "rewards") {
            let opt = document.createElement("option");
            opt.value = className;
            opt.textContent = className;
            sel.appendChild(opt);
        }
    });
    
    sel.value = currentClass;
}

// 班級管理相關函數
export function showClassPopup() {
    if (checkIfUpdating()) return;
    
    document.getElementById("classOverlay").classList.add("show");
    document.getElementById("classPopup").classList.add("show");
    
    // 更新班級列表
    let classList = document.getElementById("classList");
    classList.innerHTML = "";
    
    Object.keys(classes).forEach(className => {
        // 排除系統特殊屬性
        if (className !== "scoreButtons" && className !== "rewards") {
            let li = document.createElement("li");
            li.className = "class-item";
            li.innerHTML = `
                <span class="class-name">${className} (${classes[className].length} 位學生)</span>
                <div class="class-item-buttons">
                    <button class="delete-class-btn danger-btn" data-class="${className}">刪除</button>
                </div>
            `;
            classList.appendChild(li);
        }
    });
    
    // 為刪除按鈕添加事件處理
    document.querySelectorAll(".delete-class-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            deleteClass(this.dataset.class);
        });
    });
}

export function closeClassPopup() {
    document.getElementById("classOverlay").classList.remove("show");
    document.getElementById("classPopup").classList.remove("show");
}

export function addClassPrompt() {
    const result = prompt("請輸入新班級名稱：");
    
    // 檢查 result 是否為 null（用戶點擊取消）或空字串
    if (!result) return;
    
    const newClassName = result.trim();
    if (!newClassName) {
        showToast("班級名稱不能為空", "error");
        return;
    }
    
    if (classes[newClassName]) {
        showToast("班級已存在", "error");
        return;
    }
    
    classes[newClassName] = [];
    saveClassesLocal();
    currentClass = newClassName;
    renderClassDropdown();
    renderStudents();
    showClassPopup(); // 重新整理班級列表
    markDirty();
    showToast(`已建立新班級：${newClassName}`, "success");
}

// CSV 匯入匯出相關函數
export function exportCSV() {
    let arr = getStudents();
    let csv = "姓名,性別,分數,圖片標籤,自訂圖片\n";
    
    arr.forEach(st => {
        csv += `${st.name},${st.gender},${st.score},${st.imageLabel},${st.customImage || ""}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentClass}_學生資料.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

export function importCSV(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const contents = e.target.result;
        const lines = contents.split('\n');
        const header = lines[0].split(',');
        
        // 基本檢查，確保格式正確
        if (header.length < 3 || 
            !header.includes("姓名") || 
            !header.includes("性別") || 
            !header.includes("分數")) {
            alert("CSV 格式不正確，請確保包含姓名、性別和分數欄位");
            return;
        }
        
        const nameIdx = header.indexOf("姓名");
        const genderIdx = header.indexOf("性別");
        const scoreIdx = header.indexOf("分數");
        const labelIdx = header.indexOf("圖片標籤");
        const customImgIdx = header.indexOf("自訂圖片");
        
        // 解析學生資料
        let students = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const data = lines[i].split(',');
            if (data.length <= 1) continue;
            
            const student = {
                name: data[nameIdx],
                gender: data[genderIdx],
                score: parseInt(data[scoreIdx]) || 0
            };
            
            // 處理圖片標籤
            if (labelIdx !== -1 && data[labelIdx]) {
                student.imageLabel = data[labelIdx];
            } else {
                student.imageLabel = genderImageLabels[student.gender][0];
            }
            
            // 處理自訂圖片
            if (customImgIdx !== -1 && data[customImgIdx]) {
                student.customImage = data[customImgIdx];
            }
            
            students.push(student);
        }
        
        if (students.length === 0) {
            alert("沒有找到有效的學生資料");
            return;
        }
        
        if (confirm(`已解析 ${students.length} 位學生，確定要匯入嗎？`)) {
            classes[currentClass] = students;
            saveClassesLocal();
            renderStudents();
            markDirty();
        }
    };
    
    reader.readAsText(file);
    evt.target.value = ""; // 清空檔案選擇
}

// 設定相關函數
export function showScoreButtonsSettings() {
    const settings = prompt(
        "請設置四個分數按鈕的值，用逗號分隔（如：-5,-1,1,5）:", 
        classes.scoreButtons.join(",")
    );
    
    if (!settings) return;
    
    const values = settings.split(",").map(val => parseInt(val.trim()));
    
    if (values.length !== 4 || values.some(isNaN)) {
        alert("請輸入四個有效的數字，用逗號分隔");
        return;
    }
    
    classes.scoreButtons = values;
    saveClassesLocal();
    renderStudents();
    markDirty();
}

// 自動同步相關函數
export function performSync() {
    if (!getIsSignedIn()) {
        alert("請先登入 Google 帳號");
        return;
    }
    
    if (updatingState) {
        alert("同步處理中，請稍後");
        return;
    }
    
    markUpdating();
    updatingState = true;
    
    showSyncOverlay();
    
    // 檢查 syncMessage 元素是否存在，不存在則創建
    let syncMessage = document.getElementById("syncMessage");
    if (!syncMessage) {
        // 獲取同步彈窗
        const syncPopup = document.getElementById("syncPopup");
        if (syncPopup) {
            // 創建訊息元素
            syncMessage = document.createElement("p");
            syncMessage.id = "syncMessage";
            syncMessage.style.margin = "10px 0";
            syncPopup.appendChild(syncMessage);
        }
    }
    
    // 顯示同步開始訊息
    if (syncMessage) {
        syncMessage.textContent = "正在同步資料...";
    }
    
    // 儲存資料到 Google Drive
    saveDriveFile("classes.json", classes)
        .then(() => {
            // 顯示同步完成訊息
            if (syncMessage) {
                syncMessage.textContent = "同步完成！";
            }
            
            setTimeout(() => {
                hideSyncOverlay();
                markSynced();
                updatingState = false;
            }, 1000);
        })
        .catch(err => {
            console.error("同步失敗:", err);
            
            // 顯示同步失敗訊息
            if (syncMessage) {
                syncMessage.textContent = "同步失敗，請稍後再試";
            }
            
            setTimeout(() => {
                hideSyncOverlay();
                markDirty();
                updatingState = false;
            }, 2000);
        });
}

// 同步狀態相關函數
export function setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
    });
}

export function resetInactivityTimer() {
    lastActivityTime = Date.now();
    
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    inactivityTimer = setTimeout(checkCloudFile, INACTIVITY_CHECK_DELAY * 1000);
}

// 上傳圖片相關函數
export function updateUploadedImagesSection() {
    if (!getIsSignedIn()) return; // 未登入不顯示
    
    // 檢查上傳圖片區域是否存在，不存在則創建
    let uploadedImagesSection = document.getElementById("uploadedImagesSection");
    if (!uploadedImagesSection) {
        // 創建上傳圖片區域
        uploadedImagesSection = document.createElement("div");
        uploadedImagesSection.id = "uploadedImagesSection";
        uploadedImagesSection.className = "uploaded-images-section";
        uploadedImagesSection.innerHTML = `
            <h4>已上傳圖片</h4>
            <div id="uploadedImagesGrid" class="uploaded-images-grid"></div>
        `;
        
        // 將區域添加到學生彈窗中的自定義圖片上傳區域之後
        const customImageUpload = document.querySelector('.custom-image-upload');
        if (customImageUpload) {
            customImageUpload.after(uploadedImagesSection);
        } else {
            // 如果找不到自定義圖片上傳區域，則添加到彈窗末尾
            document.querySelector(".popup-content")?.appendChild(uploadedImagesSection);
        }
    }
    
    uploadedImagesSection.style.display = "block";
    const grid = document.getElementById("uploadedImagesGrid");
    if (!grid) return; // 如果找不到網格元素，則退出
    
    grid.innerHTML = '<div class="loading-spinner"></div>';
    
    // 獲取已上傳的所有圖片
    getAllImages().then(images => {
        grid.innerHTML = '';
        
        if (images.length === 0) {
            grid.innerHTML = '<p>尚未上傳圖片</p>';
            return;
        }
        
        images.forEach(image => {
            const imgDiv = document.createElement('div');
            imgDiv.className = 'uploaded-image-item';
            
            const img = document.createElement('img');
            // 使用 url 屬性或 thumbnailLink，或者直接從 ID 生成 URL
            img.src = image.url || image.thumbnailLink || getImageUrlFromDrive(image.id);
            img.alt = image.name;
            img.title = image.name;
            img.addEventListener('click', () => {
                // 取消選擇其他圖片
                document.querySelectorAll('.uploaded-images-grid img').forEach(i => {
                    i.classList.remove('selected');
                });
                
                // 選擇此圖片
                img.classList.add('selected');
                customImageData = getImageUrlFromDrive(image.id);
                customImageFileId = image.id;
                
                // 更新預覽
                document.getElementById('customImagePreview').innerHTML = `
                    <img src="${customImageData}" alt="自訂圖片">
                    <button id="removeCustomImgBtn" class="danger-btn">移除自訂圖片</button>
                `;
                
                // 添加移除圖片按鈕事件
                document.getElementById("removeCustomImgBtn").addEventListener("click", clearCustomImage);
                
                // 取消選擇預設圖片
                document.querySelectorAll(".image-preview img").forEach(x => x.classList.remove("selected"));
                setSelectedImage("");
            });
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-image-btn';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('確定要刪除此圖片嗎？')) {
                    deleteFile(image.id).then(() => {
                        // 如果刪除的是正在使用的圖片，清除選擇
                        if (customImageFileId === image.id) {
                            clearCustomImage();
                        }
                        imgDiv.remove();
                    }).catch(err => {
                        console.error('刪除圖片失敗:', err);
                        alert('刪除圖片失敗，請稍後再試');
                    });
                }
            });
            
            imgDiv.appendChild(img);
            imgDiv.appendChild(deleteBtn);
            grid.appendChild(imgDiv);
            
            // 如果是目前選中的圖片，標記為選中
            if (customImageFileId === image.id) {
                img.classList.add('selected');
            }
        });
    }).catch(err => {
        console.error('獲取已上傳圖片失敗:', err);
        grid.innerHTML = '<p>無法獲取已上傳圖片，請稍後再試</p>';
    });
}

// 公開暴露全局函數和變數
window.classes = classes;
window.currentClass = currentClass;
window.renderClassDropdown = renderClassDropdown;
window.renderStudents = renderStudents;
window.markUpdating = markUpdating;

export function deleteClass(className) {
    if (Object.keys(classes).filter(c => c !== "scoreButtons" && c !== "rewards").length <= 1) {
        alert("至少要保留一個班級");
        return;
    }
    
    if (!confirm(`確定要刪除 ${className} 班嗎？此操作無法復原。`)) {
        return;
    }
    
    delete classes[className];
    saveClassesLocal();
    
    // 如果刪除的是當前班級，則切換到第一個班級
    if (className === currentClass) {
        currentClass = Object.keys(classes).find(c => c !== "scoreButtons" && c !== "rewards");
        renderClassDropdown();
        renderStudents();
    }
    
    showClassPopup(); // 重新整理班級列表
    markDirty();
}

// 初始化拖放上傳
function initDragDropUpload() {
    const dropArea = document.getElementById('customImagePreview');
    if (!dropArea) return;
    
    const preventDefaults = e => {
        e.preventDefault();
        e.stopPropagation();
    };
    
    const highlight = () => {
        dropArea.classList.add('highlight');
    };
    
    const unhighlight = () => {
        dropArea.classList.remove('highlight');
    };
    
    const handleDrop = e => {
        preventDefaults(e);
        unhighlight();
        
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files && files.length) {
            const file = files[0];
            
            // 創建一個虛擬的 file input change 事件
            const mockEvent = {
                target: { files: [file] }
            };
            
            handleCustomImageUpload(mockEvent);
        }
    };
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    dropArea.addEventListener('drop', handleDrop, false);
    
    // 添加提示文字
    if (dropArea.childElementCount === 0) {
        dropArea.innerHTML = '<div class="drop-area-hint">拖放圖片至此上傳<br>或點擊「上傳自訂圖片」按鈕</div>';
    }
} 