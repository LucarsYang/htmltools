// wheelSpinner.js - 獎懲輪轉盤功能
import { showToast, generateUniqueId } from './utils.js';

// 獎懲項目默認列表
let wheelItems = [
    { id: generateUniqueId(), text: "優秀表現", color: "#4CAF50", isReward: true },
    { id: generateUniqueId(), text: "積極參與", color: "#8BC34A", isReward: true },
    { id: generateUniqueId(), text: "勇於發言", color: "#CDDC39", isReward: true },
    { id: generateUniqueId(), text: "再接再厲", color: "#FFEB3B", isReward: null },
    { id: generateUniqueId(), text: "注意聽講", color: "#FFC107", isReward: false },
    { id: generateUniqueId(), text: "保持安靜", color: "#FF9800", isReward: false },
    { id: generateUniqueId(), text: "遵守規則", color: "#FF5722", isReward: false }
];

// 輪轉盤當前狀態
let isSpinning = false;
let resultCallback = null;
let lastStopAngle = 0;
let isWheelInitialized = false;

/**
 * 初始化輪轉盤功能
 */
export function initWheelSpinner() {
    console.log('初始化獎懲輪轉盤功能');
    setupWheelEventListeners();
    loadSavedWheelItems();
}

/**
 * 設置輪轉盤相關的事件監聽器
 */
function setupWheelEventListeners() {
    // 當遊戲區菜單項目被點擊時
    const btnOpenWheel = document.getElementById('btnOpenWheel');
    if (btnOpenWheel) {
        btnOpenWheel.addEventListener('click', () => {
            console.log('點擊開啟獎懲輪轉盤');
            showWheelPopup();
        });
    }
    
    // 關閉輪轉盤按鈕
    const btnCloseWheel = document.getElementById('btnCloseWheel');
    if (btnCloseWheel) {
        btnCloseWheel.addEventListener('click', () => {
            document.getElementById('wheelOverlay').classList.remove('show');
            document.getElementById('wheelPopup').classList.remove('show');
        });
    }
    
    // 旋轉按鈕
    const btnSpinWheel = document.getElementById('btnSpinWheel');
    if (btnSpinWheel) {
        btnSpinWheel.addEventListener('click', () => {
            if (!isSpinning) {
                spinWheel();
            }
        });
    }
    
    // 輪轉盤設定
    const btnWheelSettings = document.getElementById('btnWheelSettings');
    if (btnWheelSettings) {
        btnWheelSettings.addEventListener('click', () => {
            showWheelSettings();
        });
    }
    
    // 關閉設定按鈕
    const btnCloseWheelSettings = document.getElementById('btnCloseWheelSettings');
    if (btnCloseWheelSettings) {
        btnCloseWheelSettings.addEventListener('click', () => {
            document.getElementById('wheelSettingsOverlay').classList.remove('show');
            document.getElementById('wheelSettingsPopup').classList.remove('show');
        });
    }
    
    // 添加新項目按鈕
    const btnAddWheelItem = document.getElementById('btnAddWheelItem');
    if (btnAddWheelItem) {
        btnAddWheelItem.addEventListener('click', () => {
            addWheelItem();
        });
    }
    
    // 保存輪轉盤設定
    const btnSaveWheelSettings = document.getElementById('btnSaveWheelSettings');
    if (btnSaveWheelSettings) {
        btnSaveWheelSettings.addEventListener('click', () => {
            saveWheelSettings();
        });
    }
}

/**
 * 顯示輪轉盤視窗
 */
function showWheelPopup() {
    document.getElementById('wheelOverlay').classList.add('show');
    document.getElementById('wheelPopup').classList.add('show');
    
    // 添加方向標記
    const wheelContainer = document.querySelector('.wheel-container');
    if (wheelContainer && !document.getElementById('wheelMarker')) {
        const marker = document.createElement('div');
        marker.id = 'wheelMarker';
        marker.className = 'wheel-marker';
        wheelContainer.appendChild(marker);
    }
    
    if (!isWheelInitialized) {
        drawWheel();
        isWheelInitialized = true;
    }
}

/**
 * 繪製輪轉盤
 */
function drawWheel() {
    const canvas = document.getElementById('wheelCanvas');
    if (!canvas) {
        console.error('找不到輪轉盤 Canvas 元素');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    
    // 清除畫布
    ctx.clearRect(0, 0, width, height);
    
    // 繪製輪轉盤背景
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = "#f5f5f5";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#333";
    ctx.stroke();
    
    // 計算每個項目的角度
    const numItems = wheelItems.length;
    const arcSize = 2 * Math.PI / numItems;
    
    // 繪製每個項目扇形
    for (let i = 0; i < numItems; i++) {
        const item = wheelItems[i];
        const startAngle = i * arcSize;
        const endAngle = (i + 1) * arcSize;
        
        // 繪製扇形
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#333";
        ctx.stroke();
        
        // 繪製文字
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + arcSize / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#000";
        
        // 使用較小字體和較短的半徑讓文字顯示在扇形中央
        const textRadius = radius * 0.75;
        ctx.font = "bold 14px Arial";
        ctx.fillText(item.text, textRadius, 5);
        ctx.restore();
    }
    
    // 繪製中心圓
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI, false);
    ctx.fillStyle = "#333";
    ctx.fill();
}

/**
 * 轉動輪盤
 */
function spinWheel() {
    if (isSpinning) return;
    
    isSpinning = true;
    const canvas = document.getElementById('wheelCanvas');
    const ctx = canvas.getContext('2d');
    
    // 播放轉動音效
    const spinSound = document.getElementById('wheelSpinSound');
    if (spinSound) {
        spinSound.currentTime = 0;
        spinSound.play();
    }
    
    // 動畫參數
    let startTime = null;
    const spinTime = 4000; // 旋轉時間(毫秒)
    const spinStartAngle = lastStopAngle;  // 從上次停止角度開始
    
    // 隨機決定旋轉圈數 (5-10圈) 再加上隨機角度
    const numRotations = 5 + Math.random() * 5;
    const destinationAngle = spinStartAngle + (numRotations * 2 * Math.PI) + (Math.random() * 2 * Math.PI);
    
    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        
        // 計算已經經過的時間
        const progress = timestamp - startTime;
        const elapsedFraction = Math.min(progress / spinTime, 1);
        
        // 使用 ease-out 函數讓旋轉逐漸減速
        const easedFraction = 1 - Math.pow(1 - elapsedFraction, 3);
        
        // 計算當前角度
        const currentAngle = spinStartAngle + (destinationAngle - spinStartAngle) * easedFraction;
        
        // 清除畫布並重繪
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(currentAngle);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        drawWheel();
        ctx.restore();
        
        // 如果動畫未完成，繼續下一幀
        if (progress < spinTime) {
            requestAnimationFrame(animate);
        } else {
            // 動畫結束後計算結果
            isSpinning = false;
            lastStopAngle = currentAngle % (2 * Math.PI);
            determineResult(lastStopAngle);
            
            // 播放結束音效
            const resultSound = document.getElementById('wheelResultSound');
            if (resultSound) {
                resultSound.currentTime = 0;
                resultSound.play();
            }
        }
    }
    
    requestAnimationFrame(animate);
}

/**
 * 確定輪轉盤結果
 * @param {number} finalAngle - 最終停止的角度
 */
function determineResult(finalAngle) {
    const numItems = wheelItems.length;
    const arcSize = 2 * Math.PI / numItems;
    
    // 原始角度需要反轉，因為繪圖是順時針，但輪盤旋轉是逆時針
    // 12點鐘方向為0，而畫布的0從3點鐘方向開始，因此需要調整
    let adjustedAngle = (finalAngle + Math.PI / 2) % (2 * Math.PI);
    if (adjustedAngle < 0) adjustedAngle += 2 * Math.PI;
    
    // 計算索引
    let itemIndex = Math.floor(numItems - (adjustedAngle / arcSize));
    itemIndex = itemIndex % numItems;
    
    // 獲取結果項目
    const result = wheelItems[itemIndex];
    console.log('輪轉盤結果:', result);
    
    // 顯示結果
    showWheelResult(result);
    
    // 如果有回調函數，傳遞結果
    if (typeof resultCallback === 'function') {
        resultCallback(result);
    }
}

/**
 * 顯示輪轉盤結果
 * @param {Object} result - 結果項目
 */
function showWheelResult(result) {
    const resultElement = document.getElementById('wheelResult');
    if (resultElement) {
        resultElement.textContent = result.text;
        resultElement.style.backgroundColor = result.color;
        
        // 根據獎勵或懲罰顯示不同圖標
        const iconElement = document.getElementById('wheelResultIcon');
        if (iconElement) {
            if (result.isReward === true) {
                iconElement.innerHTML = '🎉';
            } else if (result.isReward === false) {
                iconElement.innerHTML = '😢';
            } else {
                iconElement.innerHTML = '😐';
            }
        }
        
        document.getElementById('wheelResultContainer').classList.add('show');
        
        // 5秒後隱藏結果
        setTimeout(() => {
            document.getElementById('wheelResultContainer').classList.remove('show');
        }, 5000);
    }
    
    // 顯示 Toast 消息
    const messageType = result.isReward === true ? 'success' : (result.isReward === false ? 'error' : 'info');
    showToast(`輪轉盤結果: ${result.text}`, messageType);
}

/**
 * 設置結果回調函數
 * @param {Function} callback - 回調函數，接收結果項目作為參數
 */
export function setResultCallback(callback) {
    resultCallback = callback;
}

/**
 * 顯示輪轉盤設定畫面
 */
function showWheelSettings() {
    // 顯示設定視窗
    document.getElementById('wheelSettingsOverlay').classList.add('show');
    document.getElementById('wheelSettingsPopup').classList.add('show');
    
    // 渲染現有項目
    renderWheelItems();
}

/**
 * 渲染輪轉盤項目列表
 */
function renderWheelItems() {
    const container = document.getElementById('wheelItemsList');
    if (!container) return;
    
    // 清空容器
    container.innerHTML = '';
    
    // 創建項目行
    wheelItems.forEach((item, index) => {
        const itemRow = document.createElement('div');
        itemRow.className = 'wheel-item-row';
        itemRow.dataset.id = item.id;
        
        // 項目內容
        itemRow.innerHTML = `
            <input type="text" class="wheel-item-text" value="${item.text}" placeholder="項目文字">
            <input type="color" class="wheel-item-color" value="${item.color}">
            <select class="wheel-item-type">
                <option value="reward" ${item.isReward === true ? 'selected' : ''}>獎勵</option>
                <option value="neutral" ${item.isReward === null ? 'selected' : ''}>中性</option>
                <option value="punishment" ${item.isReward === false ? 'selected' : ''}>懲罰</option>
            </select>
            <button class="wheel-item-delete" data-id="${item.id}">刪除</button>
        `;
        
        // 添加到容器
        container.appendChild(itemRow);
        
        // 添加刪除按鈕事件
        const deleteBtn = itemRow.querySelector('.wheel-item-delete');
        deleteBtn.addEventListener('click', () => {
            removeWheelItem(item.id);
        });
    });
}

/**
 * 添加新的輪轉盤項目
 */
function addWheelItem() {
    const newItem = {
        id: generateUniqueId(),
        text: "新項目",
        color: getRandomColor(),
        isReward: null
    };
    
    wheelItems.push(newItem);
    renderWheelItems();
}

/**
 * 移除輪轉盤項目
 * @param {string} itemId - 要移除的項目ID
 */
function removeWheelItem(itemId) {
    if (wheelItems.length <= 2) {
        showToast('輪轉盤至少需要2個項目', 'error');
        return;
    }
    
    wheelItems = wheelItems.filter(item => item.id !== itemId);
    renderWheelItems();
}

/**
 * 保存輪轉盤設定
 */
function saveWheelSettings() {
    // 獲取所有項目行
    const itemRows = document.querySelectorAll('.wheel-item-row');
    const updatedItems = [];
    
    // 更新項目數據
    itemRows.forEach(row => {
        const id = row.dataset.id;
        const text = row.querySelector('.wheel-item-text').value.trim();
        const color = row.querySelector('.wheel-item-color').value;
        const type = row.querySelector('.wheel-item-type').value;
        
        // 檢查文字是否為空
        if (text === '') {
            showToast('項目文字不能為空', 'error');
            return;
        }
        
        // 根據類型設置 isReward
        let isReward = null;
        if (type === 'reward') isReward = true;
        else if (type === 'punishment') isReward = false;
        
        updatedItems.push({
            id,
            text,
            color,
            isReward
        });
    });
    
    // 檢查是否至少有兩個項目
    if (updatedItems.length < 2) {
        showToast('輪轉盤至少需要2個項目', 'error');
        return;
    }
    
    // 更新輪轉盤項目並重繪
    wheelItems = updatedItems;
    drawWheel();
    
    // 保存設定到本地存儲
    saveWheelItemsToStorage();
    
    // 關閉設定視窗
    document.getElementById('wheelSettingsOverlay').classList.remove('show');
    document.getElementById('wheelSettingsPopup').classList.remove('show');
    
    showToast('輪轉盤設定已保存', 'success');
}

/**
 * 從本地存儲加載保存的輪轉盤項目
 */
function loadSavedWheelItems() {
    try {
        const savedItems = localStorage.getItem('wheelItems');
        if (savedItems) {
            wheelItems = JSON.parse(savedItems);
        }
    } catch (e) {
        console.error('讀取輪轉盤項目失敗:', e);
    }
}

/**
 * 保存輪轉盤項目到本地存儲
 */
function saveWheelItemsToStorage() {
    try {
        localStorage.setItem('wheelItems', JSON.stringify(wheelItems));
    } catch (e) {
        console.error('保存輪轉盤項目失敗:', e);
    }
}

/**
 * 生成隨機顏色
 * @returns {string} 隨機顏色的十六進位碼
 */
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
} 