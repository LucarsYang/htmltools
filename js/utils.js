// utils.js - 各種通用功能和工具函數
import { getIsSignedIn } from './googleAuth.js';

// 顯示使用說明
export function showHelp() {
    const helpOverlay = document.querySelector('.help-overlay');
    const helpPopup = document.querySelector('.help-popup');
    helpOverlay.classList.add('show');
    helpPopup.classList.add('show');

    // 默認顯示使用說明
    document.getElementById('usageContent').style.display = 'block';
    document.getElementById('versionContent').style.display = 'none';

    // 關閉按鈕
    document.querySelector('.help-popup .close-btn')?.addEventListener('click', () => {
        helpOverlay.classList.remove('show');
        helpPopup.classList.remove('show');
    });
}

// 格式化日期
export function formatDate(date) {
    return new Date(date).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 防抖函數
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 生成唯一ID
export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 深拷貝對象
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// 檢查是否為移動設備
export function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 顯示錯誤訊息
export function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// 顯示成功訊息
export function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);

    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// 驗證表單數據
export function validateForm(data, rules) {
    const errors = {};
    
    for (const field in rules) {
        if (rules.hasOwnProperty(field)) {
            const value = data[field];
            const fieldRules = rules[field];

            if (fieldRules.required && !value) {
                errors[field] = '此欄位為必填';
                continue;
            }

            if (fieldRules.minLength && value.length < fieldRules.minLength) {
                errors[field] = `最少需要 ${fieldRules.minLength} 個字元`;
            }

            if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
                errors[field] = `最多只能有 ${fieldRules.maxLength} 個字元`;
            }

            if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
                errors[field] = fieldRules.message || '格式不正確';
            }
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

// 本地存儲包裝器
export const storage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Error saving to localStorage:', e);
        }
    },
    
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Error reading from localStorage:', e);
            return defaultValue;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Error removing from localStorage:', e);
        }
    },
    
    clear() {
        try {
            localStorage.clear();
        } catch (e) {
            console.error('Error clearing localStorage:', e);
        }
    }
};

// utils.js - 各種通用功能和工具函數

// 性別->圖片映射
export const imageMap = {
    "男1": "https://img.icons8.com/?size=100&id=oqlkrpDy3clZ&format=png&color=000000",
    "男2": "https://img.icons8.com/?size=100&id=C3wj6TWvegSk&format=png&color=000000",
    "男3": "https://img.icons8.com/?size=100&id=2lwL3N2H9Tbm&format=png&color=000000",
    "女1": "https://img.icons8.com/?size=100&id=eNAHQgRxtqVv&format=png&color=000000",
    "女2": "https://img.icons8.com/?size=100&id=DH9FJ32siusV&format=png&color=000000",
    "女3": "https://img.icons8.com/?size=100&id=gvFfuFtdrY7s&format=png&color=000000"
};

// 性別對應的圖片標籤
export const genderImageLabels = {
    "男": ["男1", "男2", "男3"],
    "女": ["女1", "女2", "女3"]
};

// 儲存選擇的圖片
let selectedImage = "";

/**
 * 設置選擇的圖片
 * @param {string} image 圖片標籤
 */
export function setSelectedImage(image) {
    console.log('設置選擇的圖片:', image);
    selectedImage = image;
    
    // 如果在圖片預覽中有對應元素，也更新其選中狀態
    if (typeof image === 'string' && document.querySelector('.image-preview')) {
        document.querySelectorAll('.image-preview img').forEach(img => {
            const isSelected = 
                img.src === image || 
                img.getAttribute('data-label') === image;
            img.classList.toggle('selected', isSelected);
        });
    }
}

/**
 * 獲取選擇的圖片
 * @returns {string} 圖片標籤或URL
 */
export function getSelectedImage() {
    // 如果有透過 DOM 選中的圖片，優先返回
    const selectedImgDOM = document.querySelector('.image-preview img.selected');
    if (selectedImgDOM) {
        // 優先使用 data-label 屬性，如果沒有則使用 src
        return selectedImgDOM.getAttribute('data-label') || selectedImgDOM.src;
    }
    return selectedImage;
}

/**
 * 附加側邊欄切換功能
 */
export function attachSidebarToggle() {
    console.log('初始化側邊欄切換功能');
    const toggleBtn = document.getElementById('sidebarToggle');
    if (!toggleBtn) return;
    
    toggleBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        // 開關側邊欄的折疊狀態
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        
        // 如果側邊欄被折疊，關閉所有顯示的子選單
        if (sidebar.classList.contains('collapsed')) {
            console.log('側邊欄已折疊，關閉所有子選單');
            // 隱藏所有已打開的子選單
            document.querySelectorAll('.submenu.show').forEach(submenu => {
                submenu.classList.remove('show');
            });
            
            // 移除所有 active 狀態
            document.querySelectorAll('.menu-item.active').forEach(item => {
                item.classList.remove('active');
            });
        }
    });
    
    // 初始化子選單點擊事件
    initSubmenus();
}

/**
 * 初始化側邊欄子選單
 */
function initSubmenus() {
    console.log('初始化側邊欄子選單');
    
    // 為所有帶有子選單的選單項目添加點擊事件
    const menuItems = document.querySelectorAll('.menu-item.has-submenu');
    console.log('找到子選單項目數:', menuItems.length);
    
    // 首先確保所有子選單ID正確
    const submenuMapping = {
        'btnManage': 'manageSubmenu',
        'btnHelpMenu': 'helpSubmenu',
        'btnDataManage': 'dataSubmenu'
    };
    
    menuItems.forEach(item => {
        const itemId = item.id;
        console.log('設置選單點擊事件:', itemId);
        
        item.addEventListener('click', function(e) {
            console.log('選單項目被點擊:', this.id);
            e.preventDefault();
            e.stopPropagation();
            
            // 獲取對應的子選單 - 使用映射表確保ID正確
            const submenuId = submenuMapping[this.id] || this.id.replace('btn', '') + 'Submenu';
            const submenu = document.getElementById(submenuId);
            console.log('點擊選單項:', this.id, '對應子選單:', submenuId, '子選單存在:', !!submenu);
            
            if (submenu) {
                // 檢查側邊欄是否處於折疊狀態
                const sidebar = document.getElementById('sidebar');
                const isCollapsed = sidebar.classList.contains('collapsed');
                
                // 切換子選單的顯示狀態
                const wasShown = submenu.classList.contains('show');
                submenu.classList.toggle('show');
                this.classList.toggle('active');
                
                console.log(`子選單 ${submenuId} 狀態: ${wasShown ? '隱藏' : '顯示'}`);
                
                // 計算子選單位置
                if (isCollapsed) {
                    const rect = this.getBoundingClientRect();
                    submenu.style.top = `${rect.top}px`;
                }
                
                // 關閉其他子選單
                document.querySelectorAll('.submenu').forEach(otherSubmenu => {
                    if (otherSubmenu.id !== submenuId && otherSubmenu.classList.contains('show')) {
                        console.log('關閉其他子選單:', otherSubmenu.id);
                        otherSubmenu.classList.remove('show');
                        
                        // 找到對應的選單項並移除 active 狀態
                        const otherItem = document.querySelector(`[id$="${otherSubmenu.id.replace('Submenu', '')}"]`);
                        if (otherItem) {
                            otherItem.classList.remove('active');
                        }
                    }
                });
                
                // 確保子選單中的項目能夠點擊
                const submenuItems = submenu.querySelectorAll('.menu-item');
                submenuItems.forEach(subItem => {
                    // 確保子選單項目的點擊不會被父選單攔截
                    subItem.addEventListener('click', function(evt) {
                        console.log('子選單項目被點擊:', this.id);
                        evt.stopPropagation();
                    });
                });
            } else {
                console.error(`找不到子選單: ${submenuId}，請檢查HTML結構`);
            }
        });
    });
    
    // 點擊頁面其他區域時關閉所有子選單
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.menu-item') && !e.target.closest('.submenu')) {
            console.log('點擊頁面其他區域，關閉所有子選單');
            document.querySelectorAll('.submenu.show').forEach(submenu => {
                submenu.classList.remove('show');
            });
            
            document.querySelectorAll('.menu-item.active').forEach(item => {
                item.classList.remove('active');
            });
        }
    });
    
    // 確保子選單初始化完成後，第一次點擊能夠正常顯示
    setTimeout(() => {
        console.log('子選單初始化完成');
    }, 500);
}

/**
 * 顯示/隱藏主功能按鈕
 */
export function hideMainButtons() {
    document.getElementById("login-btn").style.display = "none";
    document.getElementById("logout-btn").style.display = "none";
    document.getElementById("classSelect").style.display = "none";
}

export function showMainButtons() {
    // 直接從導入的 getIsSignedIn 函數獲取登入狀態
    // 需要確保此函數在調用時已經導入了 getIsSignedIn
    // 如果未傳入 getIsSignedIn 函數，則嘗試從 window.getIsSignedIn 獲取
    const isSignedIn = typeof getIsSignedIn === 'function' ? getIsSignedIn() : false;
    document.getElementById("login-btn").style.display = isSignedIn ? "none" : "inline-block";
    document.getElementById("logout-btn").style.display = isSignedIn ? "inline-block" : "none";
    document.getElementById("classSelect").style.display = "inline-block";
}

/**
 * 登入選擇視窗相關函數
 */
export function showLoginChoice() {
    document.getElementById("loginOverlay").classList.add("show");
    document.getElementById("loginPopup").classList.add("show");
}

export function closeLoginChoice() {
    document.getElementById("loginOverlay").classList.remove("show");
    document.getElementById("loginPopup").classList.remove("show");
}

export function backToLoginChoice() {
    hideLoginProcessingOverlay();
    showLoginChoice();
}

/**
 * 登入處理中視窗相關函數
 */
export function showLoginProcessingOverlay() {
    document.getElementById("loginProcessingOverlay").classList.add("show");
    document.getElementById("loginProcessingPopup").classList.add("show");
}

export function hideLoginProcessingOverlay() {
    document.getElementById("loginProcessingOverlay").classList.remove("show");
    document.getElementById("loginProcessingPopup").classList.remove("show");
}

/**
 * 同步狀態相關函數
 */
export function markDirty() {
    document.getElementById("statusDirty").className = "red";
    document.getElementById("statusUpdating").className = "grey";
    document.getElementById("statusSynced").className = "grey";
    document.getElementById("syncStatusBar").title = "點擊進行同步";
}

export function markUpdating() {
    document.getElementById("statusDirty").className = "grey";
    document.getElementById("statusUpdating").className = "yellow";
    document.getElementById("statusSynced").className = "grey";
    document.getElementById("syncStatusBar").title = "同步處理中...";
}

export function markSynced() {
    document.getElementById("statusDirty").className = "grey";
    document.getElementById("statusUpdating").className = "grey";
    document.getElementById("statusSynced").className = "green";
    document.getElementById("syncStatusBar").title = "資料已同步";
}

/**
 * 檢查是否正在更新中
 * @returns {boolean} 是否正在更新中
 */
export function checkIfUpdating() {
    const statusUpdating = document.getElementById("statusUpdating");
    const isUpdating = statusUpdating && statusUpdating.className === "yellow";
    
    if (isUpdating) {
        alert("目前正在『更新中』，請稍後再操作。");
    }
    
    return isUpdating;
}

/**
 * 同步相關的遮罩控制
 */
export function showSyncOverlay() {
    document.getElementById("syncOverlay").classList.add("show");
    document.getElementById("syncPopup").classList.add("show");
}

export function hideSyncOverlay() {
    document.getElementById("syncOverlay").classList.remove("show");
    document.getElementById("syncPopup").classList.remove("show");
}

/**
 * 視窗關閉功能
 */
export function setupESCKeyHandler() {
    window.addEventListener("keydown", (evt) => {
        if (evt.key === "Escape") {
            // 檢查各個視窗是否開啟
            if (document.getElementById("overlay").classList.contains("show")) {
                document.getElementById("overlay").classList.remove("show");
                document.getElementById("studentPopup").classList.remove("show");
            } else if (document.getElementById("loginOverlay").classList.contains("show")) {
                closeLoginChoice();
            } else if (document.getElementById("classOverlay").classList.contains("show")) {
                document.getElementById("classOverlay").classList.remove("show");
                document.getElementById("classPopup").classList.remove("show");
            } else if (document.getElementById("settingsOverlay")?.classList.contains("show")) {
                document.getElementById("settingsOverlay").classList.remove("show");
                document.getElementById("settingsPopup").classList.remove("show");
            } else if (document.getElementById("helpOverlay").classList.contains("show")) {
                document.getElementById("helpOverlay").classList.remove("show");
                document.getElementById("helpPopup").classList.remove("show");
            }
        }
    });
}

// Toast 通知系統
/**
 * 顯示Toast消息
 * @param {string} message - 顯示的消息
 * @param {string} type - 消息類型: 'success', 'error', 'info'
 * @param {number} duration - 顯示時間(毫秒)
 */
export function showToast(message, type = 'info', duration = 3000) {
    // 確保 toast-container 存在
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    
    // 創建 toast 元素
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // 添加圖標
    let icon = '';
    if (type === 'success') icon = '✓';
    else if (type === 'error') icon = '✗';
    else if (type === 'info') icon = 'ℹ';
    
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
    `;
    
    // 添加到容器
    container.appendChild(toast);
    
    // 動畫效果
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 自動移除
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, duration);
} 