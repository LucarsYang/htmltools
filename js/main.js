// main.js - 主程式入口
import { initGoogleAuth, getIsSignedIn } from './googleAuth.js';
import { initStudents } from './students.js';
import { initWheel } from './wheel.js';
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
    
    // 註冊「說明」按鈕點擊事件
    document.getElementById('btnHelp').addEventListener('click', () => {
        document.getElementById('helpOverlay').classList.add('show');
        document.getElementById('helpPopup').classList.add('show');
    });
} 