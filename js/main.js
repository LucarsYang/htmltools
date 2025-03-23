// main.js - 主程式入口
import { initGoogleAuth, getIsSignedIn } from './googleAuth.js';
import { initStudents } from './students.js';
import { attachSidebarToggle, setupESCKeyHandler } from './utils.js';
import { initWheelSpinner, setResultCallback } from './wheelSpinner.js';

// 當頁面載入完成後執行
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 載入完成，開始初始化應用程式');
    
    // 初始化側邊欄切換功能
    attachSidebarToggle();
    
    // 初始化 Google 身份驗證功能
    initGoogleAuth();
    
    // 初始化學生管理模組
    initStudents();
    
    // 初始化新的側邊欄功能
    initSidebarFunctions();
    
    // 初始化輪轉盤功能
    initWheelSpinner();
    
    // 設置 ESC 鍵關閉視窗
    setupESCKeyHandler();
    
    // 確保登入按鈕狀態正確更新
    updateLoginButtonsState();
    
    // 設置輪轉盤結果回調函數
    setupWheelResultCallback();
});

// 確保登入按鈕狀態正確更新
function updateLoginButtonsState() {
    setTimeout(() => {
        const loginBtn = document.getElementById("login-btn");
        const logoutBtn = document.getElementById("logout-btn");
        
        if (loginBtn && logoutBtn) {
            const isSignedIn = getIsSignedIn();
            loginBtn.style.display = isSignedIn ? "none" : "inline-block";
            logoutBtn.style.display = isSignedIn ? "inline-block" : "none";
        }
    }, 500); // 短暫延遲確保其他初始化完成
}

// 初始化新的側邊欄功能
function initSidebarFunctions() {
    console.log('初始化側邊欄功能...');
    
    // 管理功能子選單項目
    const btnScoreSettings = document.getElementById('btnScoreSettings');
    if (btnScoreSettings) {
        btnScoreSettings.addEventListener('click', () => {
            console.log('點擊分數按鈕設定');
            // 實現分數設定功能
            // TODO: 實現分數設定功能
        });
    }
    
    const btnClassManage = document.getElementById('btnClassManage');
    if (btnClassManage) {
        btnClassManage.addEventListener('click', () => {
            console.log('點擊班級管理');
            document.getElementById('classOverlay').classList.add('show');
            document.getElementById('classPopup').classList.add('show');
        });
    }
    
    const btnAddStudent = document.getElementById('btnAddStudent');
    if (btnAddStudent) {
        btnAddStudent.addEventListener('click', () => {
            console.log('點擊新增學生');
            // 如果是從 students.js 導入的 addStudent 函數，可以直接調用
            // 否則可以觸發一個自定義事件
            const addStudentEvent = new CustomEvent('addStudent');
            document.dispatchEvent(addStudentEvent);
        });
    }
    
    // 使用說明按鈕事件
    const btnUsageGuide = document.getElementById('btnUsageGuide');
    if (btnUsageGuide) {
        btnUsageGuide.addEventListener('click', () => {
            console.log('點擊使用說明');
            showHelpPopup('usage');
        });
    }
    
    // 版本歷程按鈕事件
    const btnVersionHistory = document.getElementById('btnVersionHistory');
    if (btnVersionHistory) {
        btnVersionHistory.addEventListener('click', () => {
            console.log('點擊版本歷程');
            showHelpPopup('version');
        });
    }
    
    // CSV 資料子選單
    const btnExportCSV = document.getElementById('btnExportCSV');
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            console.log('點擊匯出 CSV');
            // 觸發匯出 CSV 事件
            const exportEvent = new CustomEvent('exportCSV');
            document.dispatchEvent(exportEvent);
        });
    }
    
    const btnImportCSV = document.getElementById('btnImportCSV');
    if (btnImportCSV) {
        btnImportCSV.addEventListener('click', () => {
            console.log('點擊匯入 CSV');
            // 直接觸發檔案選擇，而非通過自定義事件
            document.getElementById('importCSV').click();
        });
    }
}

// 設置輪轉盤結果回調函數
function setupWheelResultCallback() {
    setResultCallback((result) => {
        console.log('輪轉盤結果回調:', result);
        
        // 顯示結果通知
        const messageType = result.isReward === true ? 'success' : 
                        (result.isReward === false ? 'warning' : 'info');
        const messagePrefix = result.isReward === true ? '獎勵' : 
                           (result.isReward === false ? '懲罰' : '');
        
        // 如果有選中的學生，顯示更具體的訊息
        const selectedStudent = document.querySelector('.student-card.selected');
        if (selectedStudent) {
            const studentName = selectedStudent.querySelector('.student-name').textContent;
            showToast(`${studentName} ${messagePrefix}: ${result.text}`, messageType);
        }
    });
}

// 顯示幫助彈窗並選擇對應標籤
function showHelpPopup(tabType) {
    // 顯示幫助彈窗
    document.getElementById('helpOverlay').classList.add('show');
    document.getElementById('helpPopup').classList.add('show');
    
    // 設置標題和顯示對應內容
    const helpTitle = document.getElementById('helpTitle');
    const usageContent = document.getElementById('usageContent');
    const versionContent = document.getElementById('versionContent');
    
    if (tabType === 'usage') {
        helpTitle.textContent = '使用說明';
        usageContent.style.display = 'block';
        versionContent.style.display = 'none';
    } else if (tabType === 'version') {
        helpTitle.textContent = '版本歷程';
        usageContent.style.display = 'none';
        versionContent.style.display = 'block';
    }
    
    // 添加關閉按鈕事件處理
    document.getElementById('btnCloseHelp').addEventListener('click', () => {
        document.getElementById('helpOverlay').classList.remove('show');
        document.getElementById('helpPopup').classList.remove('show');
    });
} 