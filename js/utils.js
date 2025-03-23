// utils.js - 各種通用功能和工具函數
import { getIsSignedIn } from './googleAuth.js';

// 顯示使用說明
export function showHelp() {
    const helpOverlay = document.querySelector('.help-overlay');
    const helpPopup = document.querySelector('.help-popup');
    helpOverlay.classList.add('show');
    helpPopup.classList.add('show');

    // 設置標籤切換
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // 移除所有活動狀態
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // 添加新的活動狀態
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

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
    selectedImage = image;
    
    // 如果在圖片預覽中有對應元素，也更新其選中狀態
    if (typeof image === 'string' && document.querySelector('.image-preview')) {
        document.querySelectorAll('.image-preview img').forEach(img => {
            img.classList.toggle('selected', img.src === image || img.getAttribute('data-label') === image);
        });
    }
}

/**
 * 獲取選擇的圖片
 * @returns {string} 圖片標籤
 */
export function getSelectedImage() {
    // 如果有透過 DOM 選中的圖片，優先返回
    const selectedImgDOM = document.querySelector('.image-preview img.selected');
    if (selectedImgDOM) {
        return selectedImgDOM.getAttribute('data-label') || selectedImgDOM.src;
    }
    return selectedImage;
}

/**
 * 附加側邊欄切換功能
 */
export function attachSidebarToggle() {
    const toggleBtn = document.getElementById('sidebarToggle');
    if (!toggleBtn) return;
    
    toggleBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    });
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
            } else if (document.getElementById("wheelOverlay").classList.contains("show")) {
                document.getElementById("wheelOverlay").classList.remove("show");
                document.getElementById("wheelPopup").classList.remove("show");
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