// main.js - 主程式入口
import { initGoogleAuth, getIsSignedIn } from './googleAuth.js';
import { initStudents } from './students.js';
import { initWheel, showWheel, switchWheelType } from './wheel.js';
import { attachSidebarToggle, setupESCKeyHandler } from './utils.js';

// 當頁面載入完成後執行
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 載入完成，開始初始化應用程式');
    
    // 初始化側邊欄切換功能
    attachSidebarToggle();
    
    // 初始化 Google 身份驗證功能
    initGoogleAuth();
    
    // 初始化學生管理模組
    initStudents();
    
    // 初始化輪盤模組
    initWheel();
    
    // 初始化幫助標籤切換功能
    initHelpTabs();
    
    // 初始化新的側邊欄功能
    initSidebarFunctions();
    
    // 設置 ESC 鍵關閉視窗
    setupESCKeyHandler();
    
    // 確保登入按鈕狀態正確更新
    updateLoginButtonsState();
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
    
    // 學生輪轉盤按鈕事件
    const btnStudentWheel = document.getElementById('btnStudentWheel');
    if (btnStudentWheel) {
        btnStudentWheel.addEventListener('click', () => {
            console.log('點擊學生輪轉盤');
            showWheel();
            setTimeout(() => switchWheelType('student'), 100);
        });
    }
    
    // 獎懲輪轉盤按鈕事件
    const btnRewardWheel = document.getElementById('btnRewardWheel');
    if (btnRewardWheel) {
        btnRewardWheel.addEventListener('click', () => {
            console.log('點擊獎懲輪轉盤');
            showWheel();
            setTimeout(() => switchWheelType('reward'), 100);
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
            // 觸發匯入 CSV 事件
            const importCSVInput = document.getElementById('importCSV');
            if (importCSVInput) {
                importCSVInput.click();
            }
        });
    }
}

// 顯示幫助彈窗並選擇對應標籤
function showHelpPopup(tabType) {
    // 顯示幫助彈窗
    document.getElementById('helpOverlay').classList.add('show');
    document.getElementById('helpPopup').classList.add('show');
    
    // 選擇對應標籤
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabType}"]`);
    if (tabBtn) {
        // 模擬點擊對應的標籤按鈕
        tabBtn.click();
    }
}

// 初始化幫助標籤切換功能
function initHelpTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除所有按鈕的 active 類別
            tabBtns.forEach(b => b.classList.remove('active'));
            // 為當前按鈕添加 active 類別
            btn.classList.add('active');
            
            // 隱藏所有內容
            const contents = document.querySelectorAll('.tab-content');
            contents.forEach(content => content.classList.remove('active'));
            
            // 顯示對應的內容
            const targetId = btn.dataset.tab === 'usage' ? 'usageContent' : 'versionContent';
            document.getElementById(targetId).classList.add('active');
        });
    });
    
    // 幫助視窗關閉按鈕
    document.getElementById('btnCloseHelp').addEventListener('click', () => {
        document.getElementById('helpOverlay').classList.remove('show');
        document.getElementById('helpPopup').classList.remove('show');
    });
} 