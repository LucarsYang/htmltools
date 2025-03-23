import { getStudents } from './students.js';
import { checkIfUpdating, markDirty } from './utils.js';

// 輪轉盤相關變數
let wheelCanvas = null;
let wheelCtx = null;
let wheelRotation = 0;
let isSpinning = false;
let selectedStudents = new Set();
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
    
    // 註冊輪盤按鈕點擊事件
    document.getElementById("btnWheel").addEventListener('click', showWheelPopup);
}

/**
 * 顯示輪盤彈窗
 */
export function showWheelPopup() {
    if (checkIfUpdating()) return;
    
    document.getElementById("wheelOverlay").classList.add("show");
    const wheelPopup = document.getElementById("wheelPopup");
    wheelPopup.classList.add("show");
    wheelPopup.classList.add("enlarged");
    
    // 初始化畫布
    wheelCanvas = document.getElementById("wheelCanvas");
    wheelCtx = wheelCanvas.getContext("2d");
    
    // 設置畫布大小
    wheelCanvas.width = 600;
    wheelCanvas.height = 600;
    
    // 初始化事件監聽器
    document.getElementById("btnSpinWheel").addEventListener("click", startSpinning);
    document.getElementById("btnCloseWheel").addEventListener("click", closeWheelPopup);
    document.getElementById("btnResetWheel").addEventListener("click", resetSelectedStudents);
    document.getElementById("btnStudentWheel").addEventListener("click", () => switchWheelType(false));
    document.getElementById("btnRewardWheel").addEventListener("click", () => switchWheelType(true));
    document.getElementById("btnAddReward").addEventListener("click", addNewReward);
    
    // 點擊輪轉盤時停止轉動
    wheelCanvas.addEventListener("click", () => {
        if (isSpinning) {
            isSpinning = false;
            if (wheelAnimation) {
                cancelAnimationFrame(wheelAnimation);
            }
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
 * 關閉輪盤彈窗
 */
export function closeWheelPopup() {
    const wheelPopup = document.getElementById("wheelPopup");
    document.getElementById("wheelOverlay").classList.remove("show");
    wheelPopup.classList.remove("show");
    wheelPopup.classList.remove("enlarged");
    if (wheelAnimation) {
        cancelAnimationFrame(wheelAnimation);
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
        (isRewardWheel ? items.filter(item => !selectedStudents.has(item)) : items.filter(s => !selectedStudents.has(s.name))) : 
        items;
    
    if (!wheelCanvas || !wheelCtx) {
        wheelCanvas = document.getElementById("wheelCanvas");
        wheelCtx = wheelCanvas.getContext("2d");
        if (!wheelCanvas || !wheelCtx) return;
    }

    if (availableItems.length === 0) {
        wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
        wheelCtx.fillStyle = "#f5f5f5";
        wheelCtx.beginPath();
        wheelCtx.arc(wheelCanvas.width/2, wheelCanvas.height/2, wheelCanvas.width/2 - 10, 0, Math.PI * 2);
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
    const radius = Math.min(centerX, centerY) - 10;
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
 * @param {boolean} isReward 是否為獎懲輪盤
 */
function switchWheelType(isReward) {
    isRewardWheel = isReward;
    document.getElementById("btnStudentWheel").classList.toggle("active", !isReward);
    document.getElementById("btnRewardWheel").classList.toggle("active", isReward);
    document.getElementById("wheelTitle").textContent = isReward ? "獎懲輪轉盤" : "學生輪轉盤";
    document.getElementById("rewardControls").style.display = isReward ? "block" : "none";
    selectedStudents.clear();
    updateSelectedList();
    renderWheel();
}

/**
 * 開始轉動輪盤
 */
function startSpinning() {
    if (isSpinning) return;
    
    const items = isRewardWheel ? rewards : getStudents();
    if (!items || items.length === 0) {
        alert("沒有可用的項目！");
        return;
    }
    
    const noRepeat = document.getElementById("noRepeat")?.checked;
    const availableItems = noRepeat ? 
        (isRewardWheel ? items.filter(item => !selectedStudents.has(item)) : items.filter(s => !selectedStudents.has(s.name))) : 
        items;
    
    if (availableItems.length === 0) {
        alert("所有項目都已選過！");
        return;
    }

    // 隱藏其他元素
    document.querySelector('.wheel-type-switch').style.display = 'none';
    document.querySelector('.wheel-controls-container').style.display = 'none';
    document.querySelector('.selected-students').style.display = 'none';
    document.getElementById('rewardControls').style.display = 'none';
    document.getElementById('wheelTitle').style.display = 'none';

    // 調整輪轉盤容器大小
    const wheelContainer = document.querySelector('.wheel-container');
    wheelContainer.style.width = '90vh';
    wheelContainer.style.height = '90vh';
    wheelCanvas.width = wheelContainer.clientWidth;
    wheelCanvas.height = wheelContainer.clientHeight;

    isSpinning = true;
    const spinDuration = 3000; // 3秒
    const startTime = Date.now();
    const startRotation = wheelRotation;
    const totalRotation = Math.PI * 8 + Math.random() * Math.PI * 2; // 至少轉4圈

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / spinDuration, 1);
        
        // 使用緩動函數
        const easeOut = 1 - Math.pow(1 - progress, 3);
        wheelRotation = startRotation + totalRotation * easeOut;
        
        renderWheel();
        
        if (progress < 1) {
            wheelAnimation = requestAnimationFrame(animate);
        } else {
            isSpinning = false;
            // 計算選中的項目
            const angleStep = (Math.PI * 2) / availableItems.length;
            // 調整角度計算，考慮指針在頂部（270度）的位置
            const pointerAngle = Math.PI * 1.5; // 270度
            let finalAngle = (-wheelRotation + pointerAngle) % (Math.PI * 2);
            if (finalAngle < 0) {
                finalAngle += Math.PI * 2;
            }
            const selectedIndex = Math.floor(finalAngle / angleStep);
            const selectedItem = availableItems[selectedIndex];
            
            if (selectedItem) {
                // 只有在勾選不重複時，才將項目加入已選名單
                if (noRepeat) {
                    selectedStudents.add(isRewardWheel ? selectedItem : selectedItem.name);
                    updateSelectedList();
                }
                
                // 先顯示選中結果
                alert(`選中：${isRewardWheel ? selectedItem : selectedItem.name}`);
                
                // 恢復其他元素的顯示
                document.querySelector('.wheel-type-switch').style.display = 'flex';
                document.querySelector('.wheel-controls-container').style.display = 'flex';
                document.querySelector('.selected-students').style.display = 'flex';
                document.getElementById('rewardControls').style.display = isRewardWheel ? 'block' : 'none';
                document.getElementById('wheelTitle').style.display = 'block';

                // 恢復輪轉盤容器的原始大小
                const wheelContainer = document.querySelector('.wheel-container');
                wheelContainer.style.width = '600px';
                wheelContainer.style.height = '600px';
                wheelCanvas.width = 600;
                wheelCanvas.height = 600;

                // 確保重新渲染輪轉盤
                setTimeout(() => {
                    renderWheel();
                }, 0);
            }
        }
    }

    animate();
}

/**
 * 重置已選名單
 */
function resetSelectedStudents() {
    selectedStudents.clear();
    updateSelectedList();
    renderWheel();
}

/**
 * 更新已選列表
 */
function updateSelectedList() {
    const selectedList = document.getElementById("selectedList");
    selectedList.innerHTML = "";
    
    // 將 Set 轉換為陣列並反轉順序，這樣最新的會在最前面
    const selectedArray = Array.from(selectedStudents).reverse();
    
    selectedArray.forEach((item, index) => {
        const li = document.createElement("li");
        if (isRewardWheel) {
            li.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${item}
                </div>
                <button class="remove-btn">×</button>
            `;
        } else {
            const students = getStudents();
            const student = students && students.length > 0 ? students.find(s => s.name === item) : null;
            if (student) {
                const imgSrc = student.customImage || (window.imageMap ? window.imageMap[student.imageLabel] : "") || "";
                li.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="min-width: 25px; color: #666;">${selectedArray.length - index}.</span>
                        <img src="${imgSrc}" alt="${student.gender}" style="width: 30px; height: 30px; border-radius: 50%;">
                        ${item}
                    </div>
                    <button class="remove-btn">×</button>
                `;
            } else {
                li.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="min-width: 25px; color: #666;">${selectedArray.length - index}.</span>
                        ${item}
                    </div>
                    <button class="remove-btn">×</button>
                `;
            }
        }
        
        // 添加事件監聽器
        const removeBtn = li.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => {
            removeSelectedStudent(item);
        });
        
        selectedList.appendChild(li);
    });
}

/**
 * 移除已選學生
 * @param {string} name 學生姓名或獎懲項目
 */
function removeSelectedStudent(name) {
    selectedStudents.delete(name);
    updateSelectedList();
    renderWheel();
}

/**
 * 新增獎懲項目
 */
function addNewReward() {
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
function updateRewardList() {
    const rewardList = document.getElementById("rewardList");
    rewardList.innerHTML = "";
    
    rewards.forEach((reward, index) => {
        const div = document.createElement("div");
        div.className = "reward-item";
        div.innerHTML = `
            ${reward}
            <button class="delete-reward-btn">×</button>
        `;
        
        // 添加事件監聽器
        const deleteBtn = div.querySelector('.delete-reward-btn');
        deleteBtn.addEventListener('click', () => {
            deleteReward(index);
        });
        
        rewardList.appendChild(div);
    });
}

// 如果需要，可以提供一個暴露給全局的刪除獎勵函數
export { removeSelectedStudent, deleteReward }; 