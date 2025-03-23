// googleAuth.js - 處理 Google 身份驗證相關功能
import { 
    showMainButtons, hideMainButtons, markSynced, markDirty,
    showLoginChoice, closeLoginChoice, backToLoginChoice,
    showLoginProcessingOverlay, hideLoginProcessingOverlay,
    showToast
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
    console.log('準備初始化 Google 身份驗證');
    
    // 檢查 Google API 是否已載入
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
        console.log('Google Identity API 尚未載入，等待載入完成...');
        
        // 設置事件監聽器等待 API 載入完成
        const apiReadyHandler = () => {
            console.log('收到 Google API 已準備就緒事件，開始初始化身份驗證');
            document.removeEventListener('googleApiReady', apiReadyHandler);
            initGoogleAuthAfterApiLoaded();
        };
        
        document.addEventListener('googleApiReady', apiReadyHandler);
        
        // 如果超過10秒仍未載入，顯示錯誤提示
        setTimeout(() => {
            if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
                console.error('Google API 載入超時，請重新整理頁面');
                showToast("Google API 載入失敗，請重新整理頁面或嘗試離線模式", "error");
                showLoginChoice();
            }
        }, 10000);
        
        return;
    }
    
    // API 已載入，直接初始化
    initGoogleAuthAfterApiLoaded();
}

/**
 * 在 Google API 載入完成後初始化身份驗證
 * @private
 */
function initGoogleAuthAfterApiLoaded() {
    // 從 localStorage 中恢復 token
    accessToken = localStorage.getItem("googleAccessToken") || null;
    
    // 更嚴謹的登入狀態驗證
    validateToken().then(isValid => {
        isGoogleSignedIn = isValid;
        
        // 更新 UI 顯示狀態
        updateLoginButtonsDisplay();
        
        if (isGoogleSignedIn) {
            console.log('發現有效的 Google 登入狀態');
            showToast("已自動登入 Google 帳號", "success");
            markSynced();
            loadClassesFromDrive();
            setupActivityListeners();
            resetInactivityTimer();
        } else if (accessToken) {
            // Token 存在但無效
            console.log('發現無效的 Google 登入狀態，刪除本地 Token');
            localStorage.removeItem("googleAccessToken");
            accessToken = null;
            showLoginChoice();
        } else {
            console.log('未發現已保存的 Google 登入狀態，顯示登入選項');
            showLoginChoice();
        }
    });
    
    try {
        // 初始化 Google 認證客戶端
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (resp) => {
                if (resp.error) {
                    console.error('Google 認證失敗:', resp.error);
                    hideLoginProcessingOverlay();
                    localStorage.removeItem("googleAccessToken");
                    showToast("Google 登入失敗，請重試", "error");
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
                    showToast("Google 登入成功", "success");
                    markSynced();
                    loadClassesFromDrive();
                    setupActivityListeners();
                    resetInactivityTimer();
                }
            }
        });
        
        // 註冊登入和登出按鈕的事件處理
        const loginBtn = document.getElementById("login-btn");
        const logoutBtn = document.getElementById("logout-btn");
        const btnLoginNow = document.getElementById("btnLoginNow");
        const btnOffline = document.getElementById("btnOffline");
        
        // 處理登入按鈕點擊
        const handleLoginClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 防止重複觸發
            if (loginBtn.dataset.processing === 'true') {
                console.log('登入處理中，請稍候...');
                return;
            }
            
            console.log('觸發登入事件');
            loginBtn.dataset.processing = 'true';
            showLoginProcessingOverlay();
            signIn();
        };
        
        if (loginBtn) {
            // 移除舊的事件監聽器
            loginBtn.removeEventListener("click", handleLoginClick);
            loginBtn.removeEventListener("touchend", handleLoginClick);
            loginBtn.removeEventListener("touchstart", handleLoginClick);
            
            // 添加新的事件監聽器
            loginBtn.addEventListener("click", handleLoginClick, { passive: false });
            loginBtn.addEventListener("touchend", handleLoginClick, { passive: false });
            loginBtn.addEventListener("touchstart", (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false });
        }
        
        // 處理登入選擇視窗的登入按鈕
        const handleLoginNowClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 防止重複觸發
            if (btnLoginNow.dataset.processing === 'true') {
                console.log('登入處理中，請稍候...');
                return;
            }
            
            console.log('觸發登入選擇視窗的登入事件');
            btnLoginNow.dataset.processing = 'true';
            closeLoginChoice();
            showMainButtons();
            markDirty();
            showLoginProcessingOverlay();
            signIn();
        };
        
        if (btnLoginNow) {
            // 移除舊的事件監聽器
            btnLoginNow.removeEventListener("click", handleLoginNowClick);
            btnLoginNow.removeEventListener("touchend", handleLoginNowClick);
            btnLoginNow.removeEventListener("touchstart", handleLoginNowClick);
            
            // 添加新的事件監聽器
            btnLoginNow.addEventListener("click", handleLoginNowClick, { passive: false });
            btnLoginNow.addEventListener("touchend", handleLoginNowClick, { passive: false });
            btnLoginNow.addEventListener("touchstart", (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, { passive: false });
        }
        
        // 處理登出按鈕
        if (logoutBtn) {
            logoutBtn.addEventListener("click", handleLogout, { passive: true });
            logoutBtn.addEventListener("touchend", (e) => {
                e.preventDefault();
                handleLogout();
            }, { passive: true });
        }
        
        // 處理離線模式按鈕
        if (btnOffline) {
            btnOffline.addEventListener("click", () => {
                closeLoginChoice();
                showMainButtons();
                markDirty();
                showToast("離線模式啟用，之後登入Google可能覆蓋資料", "info");
            }, { passive: true });
            btnOffline.addEventListener("touchend", (e) => {
                e.preventDefault();
                closeLoginChoice();
                showMainButtons();
                markDirty();
                showToast("離線模式啟用，之後登入Google可能覆蓋資料", "info");
            }, { passive: true });
        }
    } catch (error) {
        console.error('初始化 Google 認證客戶端失敗:', error);
        showToast("初始化 Google 認證失敗，您可以選擇離線模式", "error");
        showLoginChoice();
    }
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
    
    // 防止重複登入
    if (isGoogleSignedIn) {
        console.log('已經登入，無需重複登入');
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
        showToast("您尚未登入", "info");
        return;
    }
    
    showToast("正在登出...", "info");
    
    stopAutoSyncTimer();
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }
    
    signOut(() => {
        console.log("已登出");
        hideMainButtons();
        updateLoginButtonsDisplay();
        showToast("已成功登出 Google 帳號", "success");
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
    const events = [
        'mousedown', 'mousemove', 'keypress', 'scroll', 
        'touchstart', 'touchend', 'touchmove', 'click'
    ];
    
    events.forEach(event => {
        document.addEventListener(event, resetInactivityTimer, {
            passive: true,
            capture: true
        });
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

/**
 * 驗證 Token 是否有效
 * @returns {Promise<boolean>} Token 是否有效
 */
async function validateToken() {
    if (!accessToken) return false;
    
    try {
        // 嘗試使用 token 進行簡單的 API 調用
        const response = await fetch(
            'https://www.googleapis.com/drive/v3/about?fields=user',
            { headers: { "Authorization": `Bearer ${accessToken}` } }
        );
        
        return response.ok;
    } catch (err) {
        console.error('Token 驗證失敗:', err);
        return false;
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