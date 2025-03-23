import { getStudents } from './students.js';
import { checkIfUpdating, markDirty } from './utils.js';

// 輪轉盤相關變數
let wheelCanvas = null;
let wheelCtx = null;
let wheelRotation = 0;
let isSpinning = false;
let selectedStudents = []; // 改為數組，以保持一致性
let wheelAnimation = null;
let isRewardWheel = false; // 是否為獎懲輪轉盤
let rewards = []; // 獎懲項目

/**
 * 初始化輪盤功能
 */
export function initWheel() {
    console.log('初始化輪盤功能');
    
    // 從全局變數中獲取獎懲項目資料
    if (window.classes && window.classes.rewards) {
        rewards = window.classes.rewards;
    } else {
        rewards = ["獎勵", "懲罰"];
    }
    
    // 初始化轉盤
    try {
        wheelCanvas = document.getElementById("wheelCanvas");
        if (!wheelCanvas) {
            console.error("找不到輪盤畫布元素");
            return;
        }
        
        wheelCtx = wheelCanvas.getContext("2d");
        if (!wheelCtx) {
            console.error("無法獲取畫布2D上下文");
            return;
        }
        
        // 設置轉盤尺寸
        const wheelContainer = document.querySelector('.wheel-container');
        if (!wheelContainer) {
            console.warn("找不到輪盤容器，使用預設尺寸");
            wheelCanvas.width = 300;
            wheelCanvas.height = 300;
        } else {
            const containerWidth = wheelContainer.offsetWidth || 300;
            wheelCanvas.width = Math.max(containerWidth * 0.9, 100);
            wheelCanvas.height = wheelCanvas.width;
        }
    } catch (err) {
        console.error("初始化輪盤時發生錯誤:", err);
        // 使用預設尺寸
        if (wheelCanvas) {
            wheelCanvas.width = 300;
            wheelCanvas.height = 300;
        }
    }
    
    // 事件綁定
    document.getElementById("btnWheel").addEventListener("click", showWheel);
    document.getElementById("btnCloseWheel").addEventListener("click", closeWheel);
    document.getElementById("btnCloseWheelBottom").addEventListener("click", closeWheel);
    document.getElementById("btnSpinWheel").addEventListener("click", startSpin);
    document.getElementById("btnResetWheel").addEventListener("click", resetSelectedStudents);
    
    // 切換學生/獎懲輪盤
    document.getElementById("btnStudentWheel").addEventListener("click", () => {
        switchWheelType("student");
    });
    
    document.getElementById("btnRewardWheel").addEventListener("click", () => {
        switchWheelType("reward");
    });
    
    // 新增獎懲項目
    document.getElementById("btnAddReward").addEventListener("click", addReward);
    
    // 點擊轉盤停止
    wheelCanvas.addEventListener("click", () => {
        if (isSpinning) {
            stopSpin();
        }
    });
    
    // 響應式設計 - 窗口大小變化時重新渲染轉盤
    window.addEventListener("resize", () => {
        if (document.getElementById("wheelPopup").classList.contains("show")) {
            const containerWidth = document.querySelector('.wheel-container').offsetWidth;
            wheelCanvas.width = containerWidth * 0.9;
            wheelCanvas.height = wheelCanvas.width;
            renderWheel();
        }
    });
    
    // 設置滾輪事件 - 避免在轉盤區域捲動頁面
    wheelCanvas.addEventListener('wheel', (e) => {
        if (document.getElementById("wheelPopup").classList.contains("show")) {
            e.preventDefault();
        }
    });
    
    // 渲染輪轉盤
    renderWheel();
    
    // 更新已選列表
    updateSelectedList();
    
    // 更新獎懲列表
    updateRewardList();
}

/**
 * 顯示輪盤彈窗
 */
export function showWheel() {
    // 檢查是否有學生
    const students = getStudents();
    if (students.length === 0) {
        alert("班級中沒有學生");
        return;
    }
    
    // 顯示轉盤
    document.getElementById("wheelOverlay").classList.add("show");
    document.getElementById("wheelPopup").classList.add("show");
    
    // 重置轉盤
    isSpinning = false;
    wheelRotation = 0;
    
    // 確保畫布已正確初始化
    if (!wheelCanvas || !wheelCtx) {
        wheelCanvas = document.getElementById("wheelCanvas");
        wheelCtx = wheelCanvas.getContext("2d");
    }
    
    // 重設轉盤尺寸
    setTimeout(() => {
        const containerWidth = document.querySelector('.wheel-container')?.offsetWidth || 300;
        wheelCanvas.width = containerWidth * 0.9;
        wheelCanvas.height = wheelCanvas.width;
        
        // 預設使用學生轉盤
        switchWheelType("student");
        
        // 更新已選名單
        updateSelectedList();
    }, 50); // 輕微延遲以確保 DOM 已完全更新
}

/**
 * 關閉輪盤彈窗
 */
export function closeWheel() {
    document.getElementById("wheelOverlay").classList.remove("show");
    document.getElementById("wheelPopup").classList.remove("show");
    
    // 停止轉盤
    if (isSpinning) {
        stopSpin();
    }
}

/**
 * 渲染輪盤
 */
function renderWheel() {
    const items = isRewardWheel ? rewards : getStudents();
    if (!items || items.length === 0) {
        console.warn('沒有可用的項目來渲染輪盤');
        return;
    }
    
    const noRepeat = document.getElementById("noRepeat")?.checked;
    const availableItems = noRepeat ? 
        (isRewardWheel ? items.filter(item => !selectedStudents.includes(item)) : items.filter(s => !selectedStudents.includes(s.name))) : 
        items;
    
    if (!wheelCanvas || !wheelCtx) {
        wheelCanvas = document.getElementById("wheelCanvas");
        wheelCtx = wheelCanvas.getContext("2d");
        if (!wheelCanvas || !wheelCtx) return;
    }

    // 確保畫布有尺寸
    if (wheelCanvas.width <= 0 || wheelCanvas.height <= 0) {
        const containerWidth = document.querySelector('.wheel-container')?.offsetWidth || 300;
        wheelCanvas.width = containerWidth * 0.9;
        wheelCanvas.height = wheelCanvas.width;
    }

    if (availableItems.length === 0) {
        wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
        wheelCtx.fillStyle = "#f5f5f5";
        wheelCtx.beginPath();
        wheelCtx.arc(wheelCanvas.width/2, wheelCanvas.height/2, Math.max(wheelCanvas.width/2 - 10, 10), 0, Math.PI * 2);
        wheelCtx.fill();
        
        wheelCtx.fillStyle = "#666";
        wheelCtx.font = "24px Arial";
        wheelCtx.textAlign = "center";
        wheelCtx.textBaseline = "middle";
        wheelCtx.fillText("所有項目都已選過", wheelCanvas.width/2, wheelCanvas.height/2);
        return;
    }

    const centerX = wheelCanvas.width / 2;
    const centerY = wheelCanvas.height / 2;
    // 確保半徑至少為10
    const radius = Math.max(Math.min(centerX, centerY) - 10, 10);
    const colors = ["#FF5733", "#33FF57", "#3357FF", "#F333FF", "#33FFF3", "#FF3333"];

    wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
    
    // 繪製扇形
    const angleStep = (Math.PI * 2) / availableItems.length;
    availableItems.forEach((item, index) => {
        const startAngle = index * angleStep + wheelRotation;
        const endAngle = (index + 1) * angleStep + wheelRotation;

        wheelCtx.beginPath();
        wheelCtx.moveTo(centerX, centerY);
        wheelCtx.arc(centerX, centerY, radius, startAngle, endAngle);
        wheelCtx.closePath();
        wheelCtx.fillStyle = colors[index % colors.length];
        wheelCtx.fill();
        wheelCtx.strokeStyle = "#fff";
        wheelCtx.lineWidth = 3;
        wheelCtx.stroke();

        // 繪製文字
        wheelCtx.save();
        wheelCtx.translate(centerX, centerY);
        wheelCtx.rotate(startAngle + angleStep / 2);
        wheelCtx.textAlign = "right";
        wheelCtx.fillStyle = "#fff";
        wheelCtx.font = "18px Arial";
        wheelCtx.fillText(isRewardWheel ? item : item.name, radius - 30, 5);
        wheelCtx.restore();
    });
}

/**
 * 切換輪盤類型
 * @param {string} type 輪盤類型
 */
export function switchWheelType(type) {
    isRewardWheel = type === "reward";
    
    // 更新按鈕樣式
    document.getElementById("btnStudentWheel").classList.toggle("active", !isRewardWheel);
    document.getElementById("btnRewardWheel").classList.toggle("active", isRewardWheel);
    
    // 更新標題
    document.getElementById("wheelTitle").textContent = isRewardWheel ? "獎懲輪轉盤" : "學生輪轉盤";
    
    // 顯示/隱藏獎懲控制區
    document.getElementById("rewardControls").style.display = isRewardWheel ? "block" : "none";
    
    // 顯示/隱藏不重複選擇選項
    document.querySelector(".wheel-left-controls").style.display = isRewardWheel ? "none" : "flex";
    
    // 確保畫布尺寸正確
    if (!wheelCanvas || !wheelCtx || wheelCanvas.width <= 20) {
        wheelCanvas = document.getElementById("wheelCanvas");
        wheelCtx = wheelCanvas.getContext("2d");
        const containerWidth = document.querySelector('.wheel-container')?.offsetWidth || 300;
        wheelCanvas.width = Math.max(containerWidth * 0.9, 100);
        wheelCanvas.height = wheelCanvas.width;
    }
    
    // 更新轉盤渲染
    renderWheel();
    
    // 更新已選名單
    updateSelectedList();
    
    // 更新獎懲列表
    if (isRewardWheel) {
        updateRewardList();
    }
}

/**
 * 開始轉動輪盤
 */
export function startSpin() {
    if (isSpinning) return;
    
    const items = isRewardWheel ? rewards : getStudents().map(s => s.name);
    if (items.length === 0) {
        alert(isRewardWheel ? "請先新增獎懲項目" : "班級中沒有學生");
        return;
    }
    
    // 檢查是否已全部選過
    const noRepeat = document.getElementById("noRepeat").checked;
    if (!isRewardWheel && noRepeat && selectedStudents.length >= items.length) {
        if (confirm("已選擇所有學生，是否重置名單?")) {
            resetSelectedStudents();
        } else {
            return;
        }
    }
    
    // 若設置不重複選擇，則過濾掉已選過的項目
    const availableItems = isRewardWheel ? items : 
        (noRepeat ? items.filter(name => !selectedStudents.includes(name)) : items);
    
    if (availableItems.length === 0) {
        alert("沒有可選的項目了");
        return;
    }
    
    isSpinning = true;
    document.getElementById("btnSpinWheel").disabled = true;
    document.getElementById("btnSpinWheel").textContent = "轉動中...";
    document.getElementById("wheelCanvas").classList.add("spinning");
    
    // 隨機選擇一個項目
    const randomIndex = Math.floor(Math.random() * availableItems.length);
    const selected = isRewardWheel ? availableItems[randomIndex] : 
        availableItems[randomIndex];
    
    // 計算目標角度
    const segmentAngle = 2 * Math.PI / items.length;
    const targetSegment = items.indexOf(selected);
    const extraSpins = 4; // 額外旋轉圈數
    const targetAngle = segmentAngle * targetSegment + extraSpins * 2 * Math.PI;
    
    // 啟動動畫
    let startTime = null;
    const duration = 3000; // 旋轉持續時間
    const initialVelocity = 0.2; // 初始速度
    
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用緩動函數使動畫更自然
        const easing = 1 - Math.pow(1 - progress, 3);
        wheelRotation = initialVelocity + easing * targetAngle;
        
        // 檢查並確保輪盤大小正確
        if (wheelCanvas.width <= 0 || wheelCanvas.height <= 0) {
            const containerWidth = document.querySelector('.wheel-container')?.offsetWidth || 300;
            wheelCanvas.width = containerWidth * 0.9;
            wheelCanvas.height = wheelCanvas.width;
        }
        
        renderWheel();
        
        if (progress < 1) {
            wheelAnimation = requestAnimationFrame(step);
        } else {
            stopSpin(selected);
        }
    }
    
    wheelAnimation = requestAnimationFrame(step);
}

/**
 * 停止轉盤旋轉
 * @param {string} selected 選中的項目名稱
 */
function stopSpin(selected) {
    if (!isSpinning) return;
    
    // 停止動畫
    if (wheelAnimation) {
        cancelAnimationFrame(wheelAnimation);
    }
    
    // 重置狀態
    isSpinning = false;
    document.getElementById("btnSpinWheel").disabled = false;
    document.getElementById("btnSpinWheel").textContent = "開始轉動";
    document.getElementById("wheelCanvas").classList.remove("spinning");
    
    // 如果提供了選中項目，則處理選中邏輯
    if (selected) {
        // 顯示選中結果
        setTimeout(() => {
            alert(`選中：${selected}`);
            
            // 僅在勾選不重複且是學生輪盤時，將項目加入已選列表
            if (!isRewardWheel && document.getElementById("noRepeat").checked) {
                selectedStudents.push(selected); // 使用 push 而非 add
                updateSelectedList();
            }
        }, 200);
    }
}

/**
 * 重置已選名單
 */
function resetSelectedStudents() {
    selectedStudents = []; // 重置為空數組
    updateSelectedList();
    renderWheel();
}

/**
 * 更新已選列表
 */
export function updateSelectedList() {
    const selectedList = document.getElementById("selectedList");
    selectedList.innerHTML = "";
    
    if (selectedStudents.length === 0) {
        selectedList.innerHTML = "<p>尚未有已選項目</p>";
        return;
    }
    
    selectedStudents.forEach(item => {
        const span = document.createElement("span");
        span.className = "selected-item";
        span.textContent = item;
        selectedList.appendChild(span);
    });
}

/**
 * 移除已選學生
 * @param {string} name 學生姓名或獎懲項目
 */
function removeSelectedStudent(name) {
    const index = selectedStudents.indexOf(name);
    if (index !== -1) {
        selectedStudents.splice(index, 1); // 使用數組方法移除元素
    }
    updateSelectedList();
    renderWheel();
}

/**
 * 新增獎懲項目
 */
function addReward() {
    const input = document.getElementById("newReward");
    const newReward = input.value.trim();
    
    if (newReward && !rewards.includes(newReward)) {
        rewards.unshift(newReward);
        
        // 更新全局的 rewards
        if (window.classes) {
            window.classes.rewards = rewards;
            // 保存到 localStorage
            localStorage.setItem("classes", JSON.stringify(window.classes));
        }
        
        updateRewardList();
        renderWheel();
        input.value = "";
        
        // 標記為需要同步
        markDirty();
    }
}

/**
 * 刪除獎懲項目
 * @param {number} index 項目索引
 */
function deleteReward(index) {
    if (rewards.length <= 2) {
        alert("至少需要保留兩個獎懲項目！");
        return;
    }
    
    rewards.splice(index, 1);
    
    // 更新全局的 rewards
    if (window.classes) {
        window.classes.rewards = rewards;
        // 保存到 localStorage
        localStorage.setItem("classes", JSON.stringify(window.classes));
    }
    
    updateRewardList();
    renderWheel();
    
    // 標記為需要同步
    markDirty();
}

/**
 * 更新獎懲列表
 */
export function updateRewardList() {
    const rewardList = document.getElementById("rewardList");
    rewardList.innerHTML = "";
    
    if (rewards.length === 0) {
        rewardList.innerHTML = "<p>尚未新增獎懲項目</p>";
        return;
    }
    
    rewards.forEach((reward, idx) => {
        const item = document.createElement("div");
        item.className = "reward-item";
        item.innerHTML = `
            <span>${reward}</span>
            <button class="delete-reward-btn" data-idx="${idx}">×</button>
        `;
        rewardList.appendChild(item);
    });
    
    // 綁定刪除按鈕事件
    document.querySelectorAll(".delete-reward-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const idx = parseInt(btn.getAttribute("data-idx"));
            deleteReward(idx);
        });
    });
}

// 如果需要，可以提供一個暴露給全局的刪除獎勵函數
export { removeSelectedStudent, deleteReward }; 
