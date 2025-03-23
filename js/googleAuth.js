// googleAuth.js - 處理 Google 身份驗證相關功能
import { 
    showMainButtons, hideMainButtons, markSynced, markDirty,
    showLoginChoice, closeLoginChoice, backToLoginChoice,
    showLoginProcessingOverlay, hideLoginProcessingOverlay
} from './utils.js';
import { loadDriveFile } from './googleDrive.js';

// Google API 配置
const CLIENT_ID = '310618779783-ephi24bku6psi9c7c1babi0v1n7fu8u9.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCpO6sP8jmBvwuuM2qRU8XYyaFHD_TP-34';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// 外部可訪問的變數和函數
let tokenClient;
let accessToken = null;
let isGoogleSignedIn = false;

// 自動檢查相關變數
let inactivityTimer = null;
const INACTIVITY_CHECK_DELAY = 60; // 60秒

/**
 * 初始化 Google 身份驗證
 */
export function initGoogleAuth() {
    console.log('初始化 Google 身份驗證');
    
    // 從 localStorage 中恢復 token
    accessToken = localStorage.getItem("googleAccessToken") || null;
    isGoogleSignedIn = !!accessToken;
    
    // 更新 UI 顯示狀態
    updateLoginButtonsDisplay();
    
    if (isGoogleSignedIn) {
        console.log('發現已保存的 Google 登入狀態');
        markSynced();
        loadClassesFromDrive();
        setupActivityListeners();
        resetInactivityTimer();
    } else {
        console.log('未發現已保存的 Google 登入狀態，顯示登入選項');
        showLoginChoice();
    }
    
    // 初始化 Google 認證客戶端
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
            if (resp.error) {
                console.error('Google 認證失敗:', resp.error);
                hideLoginProcessingOverlay();
                localStorage.removeItem("googleAccessToken");
                backToLoginChoice();
            } else {
                // 認證成功
                console.log('Google 認證成功');
                accessToken = resp.access_token;
                localStorage.setItem("googleAccessToken", accessToken);
                isGoogleSignedIn = true;
                hideLoginProcessingOverlay();
                
                // 更新 UI 顯示狀態
                updateLoginButtonsDisplay();
                markSynced();
                loadClassesFromDrive();
                setupActivityListeners();
                resetInactivityTimer();
            }
        }
    });
    
    // 註冊登入和登出按鈕的事件處理
    document.getElementById("login-btn").addEventListener("click", () => {
        showLoginProcessingOverlay();
        signIn();
    });
    
    document.getElementById("logout-btn").addEventListener("click", handleLogout);
    
    // 登入選擇視窗的按鈕事件
    document.getElementById("btnLoginNow").addEventListener("click", () => {
        closeLoginChoice();
        showMainButtons();
        markDirty();
        showLoginProcessingOverlay();
        signIn();
    });
    
    document.getElementById("btnOffline").addEventListener("click", () => {
        closeLoginChoice();
        showMainButtons();
        markDirty();
        alert("離線模式啟用，之後登入Google可能覆蓋資料。");
    });
}

/**
 * 更新登入按鈕的顯示狀態
 */
function updateLoginButtonsDisplay() {
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const classSelect = document.getElementById("classSelect");
    
    if (loginBtn && logoutBtn) {
        loginBtn.style.display = isGoogleSignedIn ? "none" : "inline-block";
        logoutBtn.style.display = isGoogleSignedIn ? "inline-block" : "none";
    }
    
    if (classSelect) {
        classSelect.style.display = "inline-block";
    }
}

/**
 * 執行 Google 登入
 */
export function signIn() {
    if (!tokenClient) {
        console.warn("tokenClient未初始化");
        return;
    }
    tokenClient.requestAccessToken();
}

/**
 * 執行 Google 登出
 */
export function signOut(callback) {
    if (!accessToken) {
        if (callback) callback();
        return;
    }
    
    google.accounts.oauth2.revoke(accessToken, () => {
        accessToken = null;
        isGoogleSignedIn = false;
        localStorage.removeItem("googleAccessToken");
        if (callback) callback();
    });
}

/**
 * 處理登出按鈕點擊
 */
export function handleLogout() {
    if (!accessToken) {
        alert("尚未登入");
        return;
    }
    
    stopAutoSyncTimer();
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    signOut(() => {
        console.log("已登出");
        hideMainButtons();
        updateLoginButtonsDisplay();
        backToLoginChoice();
    });
}

/**
 * 檢查學生數據文件
 */
export function checkStudentsFile() {
    let token = getAccessToken();
    if (!token) return;
    
    console.log("檢查學生數據文件");
    
    // 示例：列出檔案
    gapi.client.drive.files.list({
        q: "name='students_data.json'",
        spaces: 'drive',
        fields: 'files(id, name)',
    }).then(response => {
        const files = response.result.files;
        if (files && files.length > 0) {
            console.log('找到檔案:', files);
        } else {
            console.log('未找到學生數據文件，需要建立新檔案');
        }
    }).catch(err => {
        console.error('檢查檔案時發生錯誤:', err);
    });
}

/**
 * 獲取 Google 認證 Token
 * @returns {string|null} 認證 Token
 */
export function getAccessToken() {
    return accessToken;
}

/**
 * 獲取 Google 登入狀態
 * @returns {boolean} 是否已登入
 */
export function getIsSignedIn() {
    return isGoogleSignedIn;
}

/**
 * 設置活動監聽器
 */
export function setupActivityListeners() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer);
    });
}

/**
 * 重置不活動計時器
 */
export function resetInactivityTimer() {
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    inactivityTimer = setTimeout(checkCloudFile, INACTIVITY_CHECK_DELAY * 1000);
}

/**
 * 檢查雲端檔案
 */
async function checkCloudFile() {
    if (!isGoogleSignedIn) return;

    try {
        const cloudData = await loadDriveFile("classes.json");
        if (!cloudData) return;

        // 比較本地和雲端資料
        const localData = JSON.stringify(window.classes || {});
        const cloudDataStr = JSON.stringify(cloudData);

        if (localData !== cloudDataStr) {
            // 如果資料不同，顯示確認對話框
            if (confirm("發現雲端檔案有更新，是否要同步？\n注意：同步後本地資料將被雲端資料覆蓋。")) {
                // 用戶確認同步
                markUpdating();
                // 更新本地資料為雲端資料
                window.classes = cloudData;
                localStorage.setItem("classes", JSON.stringify(cloudData));
                window.renderClassDropdown();
                window.renderStudents();
                markSynced();
            }
        }
    } catch (err) {
        console.error("檢查雲端檔案失敗:", err);
        if (err.message.includes("401") || err.message.includes("unauthorized")) {
            alert("登入已過期，請重新登入");
            handleLogout();
        }
    }
}

/**
 * 從 Google Drive 載入班級資料
 */
export async function loadClassesFromDrive() {
    if (!isGoogleSignedIn) return;
    
    try {
        let data = await loadDriveFile("classes.json");
        if (data) {
            // 確保 scoreButtons 存在
            if (!data.scoreButtons) {
                data.scoreButtons = [-5, -1, 1, 5];  // 使用預設值
            }
            window.classes = data;
            localStorage.setItem("classes", JSON.stringify(data));
            
            // 確保當前班級存在
            if (!data[window.currentClass]) {
                window.currentClass = Object.keys(data).find(key => key !== 'scoreButtons') || "一班";
            }
            
            if (window.renderClassDropdown) window.renderClassDropdown();
            if (window.renderStudents) window.renderStudents();
            markSynced();
        } else {
            console.log("未找到 classes.json => 等使用者手動同步建立");
            markDirty();
        }
    } catch(err) {
        console.error("loadClasses失敗:", err);
        markDirty();
    }
}

// 這些函數需要在其他模塊中實現並全局暴露
function stopAutoSyncTimer() {
    if (window.stopAutoSyncTimer) {
        window.stopAutoSyncTimer();
    }
}

function markUpdating() {
    if (window.markUpdating) {
        window.markUpdating();
    }
}

// 導出需要的變數和函數
export {
    CLIENT_ID,
    API_KEY,
    DISCOVERY_DOC,
    SCOPES,
    tokenClient
}; 