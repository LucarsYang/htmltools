// 輪轉盤功能模組
class WheelManager {
    constructor(getStudents, getClasses) {
        this.getStudents = getStudents;
        this.getClasses = getClasses;
        this.currentMode = 'student'; // 'student' 或 'reward'
        this.selectedItems = {
            student: [],
            reward: []
        };
        this.rewardItems = this.loadRewardItems();
        this.isSpinning = false;
        this.currentRotation = 0;
        this.canvas = null;
        this.ctx = null;
        this.wheelData = [];
        
        this.init();
    }

    init() {
        this.createWheelContainer();
        this.bindEvents();
        this.updateWheelData();
    }

    createWheelContainer() {
        const container = document.getElementById('wheel-main-container');
        if (!container) return;

        container.innerHTML = `
            <div class="wheel-overlay" id="wheelOverlay">
                <div class="wheel-container">
                    <div class="wheel-header">
                        <h2 class="wheel-title">🎡 輪轉盤</h2>
                        <button class="wheel-close" id="wheelClose">×</button>
                    </div>
                    
                    <div class="wheel-mode-switch">
                        <button class="mode-btn active" data-mode="student">學生輪轉盤</button>
                        <button class="mode-btn" data-mode="reward">獎懲輪轉盤</button>
                    </div>
                    
                    <div class="wheel-section">
                        <div class="wheel-display">
                            <div class="wheel-canvas-container">
                                <canvas id="wheelCanvas" width="500" height="500"></canvas>
                                <div class="wheel-pointer"></div>
                            </div>
                        </div>
                        
                        <div class="wheel-right-panel">
                            <div class="wheel-controls">
                                <div class="control-group">
                                    <label class="control-label">控制選項</label>
                                    <div class="checkbox-group">
                                        <input type="checkbox" id="noRepeatCheck" checked>
                                        <label for="noRepeatCheck">不重複選擇</label>
                                    </div>
                                    <button class="control-btn secondary" id="resetBtn">重置已選名單</button>
                                    <button class="control-btn primary" id="spinBtn">開始轉動</button>
                                </div>
                            </div>
                            
                            <div class="selected-items">
                                <h3>已選項目</h3>
                                <div class="selected-list" id="selectedList">
                                    <div class="empty-state">暫無已選項目</div>
                                </div>
                            </div>
                            
                            <div class="reward-management" id="rewardManagement" style="display: none;">
                                <h3>獎懲項目管理</h3>
                                <div class="reward-input-group">
                                    <input type="text" class="reward-input" id="rewardInput" placeholder="輸入新的獎懲項目">
                                    <button class="reward-add-btn" id="rewardAddBtn">新增</button>
                                </div>
                                <div class="reward-list" id="rewardList"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="result-popup" id="resultPopup">
                <h2>🎉 恭喜！</h2>
                <div class="result-text" id="resultText"></div>
                <button class="result-close" id="resultClose">確定</button>
            </div>
        `;
    }

    bindEvents() {
        // 關閉按鈕
        document.getElementById('wheelClose')?.addEventListener('click', () => this.hide());
        
        // ESC 鍵關閉
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible()) {
                this.hide();
            }
        });

        // 模式切換
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.switchMode(mode);
            });
        });

        // 控制按鈕
        document.getElementById('resetBtn')?.addEventListener('click', () => this.resetSelected());
        document.getElementById('spinBtn')?.addEventListener('click', () => this.spin());
        
        // 不重複選擇核取方塊
        document.getElementById('noRepeatCheck')?.addEventListener('change', () => {
            this.updateWheelData();
        });
        
        // 輪盤點擊停止
        document.getElementById('wheelCanvas')?.addEventListener('click', () => {
            if (this.isSpinning) {
                this.stopSpin();
            }
        });

        // 獎懲項目管理
        document.getElementById('rewardAddBtn')?.addEventListener('click', () => this.addRewardItem());
        document.getElementById('rewardInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addRewardItem();
            }
        });

        // 結果彈窗
        document.getElementById('resultClose')?.addEventListener('click', () => this.hideResult());
    }

    show() {
        document.getElementById('wheelOverlay')?.classList.add('show');
        this.updateWheelData();
        this.updateRewardList();
    }

    hide() {
        document.getElementById('wheelOverlay')?.classList.remove('show');
    }

    isVisible() {
        return document.getElementById('wheelOverlay')?.classList.contains('show') || false;
    }

    switchMode(mode) {
        this.currentMode = mode;
        
        // 更新按鈕狀態
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // 顯示/隱藏獎懲管理
        const rewardManagement = document.getElementById('rewardManagement');
        if (rewardManagement) {
            rewardManagement.style.display = mode === 'reward' ? 'block' : 'none';
        }

        // 更新已選項目清單顯示
        this.updateSelectedList();
        this.updateWheelData();
    }

    updateWheelData() {
        if (this.currentMode === 'student') {
            this.updateStudentWheelData();
        } else {
            this.updateRewardWheelData();
        }
        this.drawWheel();
    }

    updateStudentWheelData() {
        const students = this.getStudents();
        const noRepeat = document.getElementById('noRepeatCheck')?.checked || false;
        
        let availableStudents = students;
        if (noRepeat) {
            availableStudents = students.filter(student => 
                !this.selectedItems.student.includes(student.name)
            );
        }

        this.wheelData = availableStudents.map((student, index) => ({
            text: student.name,
            color: this.getUniqueColor(index)
        }));

        // 更新轉動按鈕狀態
        const spinBtn = document.getElementById('spinBtn');
        if (spinBtn) {
            spinBtn.disabled = this.wheelData.length < 2;
        }
    }

    updateRewardWheelData() {
        const noRepeat = document.getElementById('noRepeatCheck')?.checked || false;
        
        let availableRewards = this.rewardItems;
        if (noRepeat) {
            availableRewards = this.rewardItems.filter(reward => 
                !this.selectedItems.reward.includes(reward)
            );
        }

        this.wheelData = availableRewards.map((reward, index) => ({
            text: reward,
            color: this.getUniqueColor(index)
        }));

        // 更新轉動按鈕狀態
        const spinBtn = document.getElementById('spinBtn');
        if (spinBtn) {
            spinBtn.disabled = this.wheelData.length < 2;
        }
    }

    drawWheel() {
        this.canvas = document.getElementById('wheelCanvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;

        // 清空畫布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.wheelData.length === 0) {
            // 顯示空狀態
            this.ctx.fillStyle = '#ecf0f1';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            this.ctx.fill();

            this.ctx.fillStyle = '#7f8c8d';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('人數或選項不足', centerX, centerY);
            return;
        }

        const anglePerItem = (2 * Math.PI) / this.wheelData.length;

        this.wheelData.forEach((item, index) => {
            // 從12點鐘方向開始繪製（-Math.PI/2 是12點鐘方向）
            const startAngle = index * anglePerItem + this.currentRotation - Math.PI / 2;
            const endAngle = (index + 1) * anglePerItem + this.currentRotation - Math.PI / 2;

            // 繪製扇形
            this.ctx.fillStyle = item.color;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY);
            this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            this.ctx.closePath();
            this.ctx.fill();

            // 繪製邊框
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // 繪製文字
            const textAngle = startAngle + anglePerItem / 2;
            const textX = centerX + Math.cos(textAngle) * (radius * 0.7);
            const textY = centerY + Math.sin(textAngle) * (radius * 0.7);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // 旋轉文字以適應扇形，調整角度讓12點鐘方向的文字正立
            this.ctx.save();
            this.ctx.translate(textX, textY);
            this.ctx.rotate(textAngle);
            this.ctx.fillText(item.text, 0, 0);
            this.ctx.restore();
        });
    }

    spin() {
        if (this.isSpinning || this.wheelData.length < 2) return;

        // 在開始轉動時更新輪盤資料（移除已選項目）
        this.updateWheelData();

        this.isSpinning = true;
        const spinBtn = document.getElementById('spinBtn');
        if (spinBtn) {
            spinBtn.textContent = '轉動中...';
            spinBtn.disabled = true;
        }

        // 計算旋轉角度（至少轉 5 圈，最多 10 圈）
        const minSpins = 5;
        const maxSpins = 10;
        const spins = minSpins + Math.random() * (maxSpins - minSpins);
        const targetRotation = this.currentRotation + (spins * 2 * Math.PI);

        // 動畫參數
        const duration = 3000 + Math.random() * 2000; // 3-5 秒
        const startTime = Date.now();
        const startRotation = this.currentRotation;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 使用緩動函數
            const easeOut = 1 - Math.pow(1 - progress, 3);
            this.currentRotation = startRotation + (targetRotation - startRotation) * easeOut;
            
            this.drawWheel();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.finishSpin();
            }
        };

        animate();
    }

    stopSpin() {
        if (!this.isSpinning) return;
        this.finishSpin();
    }

    finishSpin() {
        this.isSpinning = false;
        
        const spinBtn = document.getElementById('spinBtn');
        if (spinBtn) {
            spinBtn.textContent = '開始轉動';
            spinBtn.disabled = false;
        }

        // 計算選中的項目
        const anglePerItem = (2 * Math.PI) / this.wheelData.length;
        const normalizedRotation = ((this.currentRotation % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
        
        // 指針在12點鐘方向（0度），計算哪個扇形在指針位置
        // 輪盤是順時針旋轉，所以需要反向計算
        // 由於扇形是從0度開始，我們需要找到指針指向的扇形
        let selectedIndex = Math.floor((2 * Math.PI - normalizedRotation) / anglePerItem) % this.wheelData.length;
        if (selectedIndex < 0) selectedIndex += this.wheelData.length;
        
        const selectedItem = this.wheelData[selectedIndex];
        if (selectedItem) {
            this.showResult(selectedItem.text);
            this.addToSelected(selectedItem.text);
        }
    }

    showResult(text) {
        const resultPopup = document.getElementById('resultPopup');
        const resultText = document.getElementById('resultText');
        
        if (resultPopup && resultText) {
            resultText.textContent = `選中：${text}`;
            resultPopup.classList.add('show');
        }
    }

    hideResult() {
        const resultPopup = document.getElementById('resultPopup');
        if (resultPopup) {
            resultPopup.classList.remove('show');
        }
    }

    addToSelected(text) {
        if (!this.selectedItems[this.currentMode].includes(text)) {
            this.selectedItems[this.currentMode].push(text);
            this.updateSelectedList();
            
            // 不在選中時立即更新輪盤，等下次開始轉動時再更新
        }
    }

    updateSelectedList() {
        const selectedList = document.getElementById('selectedList');
        if (!selectedList) return;

        const currentSelectedItems = this.selectedItems[this.currentMode];
        if (currentSelectedItems.length === 0) {
            selectedList.innerHTML = '<div class="empty-state">暫無已選項目</div>';
            return;
        }

        selectedList.innerHTML = currentSelectedItems.map(item => `
            <div class="selected-item">
                <span class="selected-item-text">${item}</span>
                <button class="selected-item-remove" data-item="${item}">刪除</button>
            </div>
        `).join('');

        // 綁定刪除按鈕事件
        selectedList.querySelectorAll('.selected-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.dataset.item;
                this.removeFromSelected(item);
            });
        });
    }

    removeFromSelected(text) {
        const currentSelectedItems = this.selectedItems[this.currentMode];
        const index = currentSelectedItems.indexOf(text);
        if (index > -1) {
            currentSelectedItems.splice(index, 1);
            this.updateSelectedList();
            
            // 如果啟用了不重複選擇，立即更新輪盤資料
            const noRepeat = document.getElementById('noRepeatCheck')?.checked || false;
            if (noRepeat) {
                this.updateWheelData();
            }
        }
    }

    resetSelected() {
        this.selectedItems[this.currentMode] = [];
        this.updateSelectedList();
        this.updateWheelData();
    }

    // 獎懲項目管理
    addRewardItem() {
        const input = document.getElementById('rewardInput');
        if (!input) return;

        const text = input.value.trim();
        if (!text) return;

        if (!this.rewardItems.includes(text)) {
            this.rewardItems.push(text);
            this.saveRewardItems();
            this.updateRewardList();
            this.updateWheelData();
            input.value = '';
        }
    }

    removeRewardItem(text) {
        const index = this.rewardItems.indexOf(text);
        if (index > -1) {
            this.rewardItems.splice(index, 1);
            this.saveRewardItems();
            this.updateRewardList();
            this.updateWheelData();
        }
    }

    updateRewardList() {
        const rewardList = document.getElementById('rewardList');
        if (!rewardList) return;

        if (this.rewardItems.length === 0) {
            rewardList.innerHTML = '<div class="empty-state">暫無獎懲項目</div>';
            return;
        }

        rewardList.innerHTML = this.rewardItems.map(item => `
            <div class="reward-item">
                <span class="reward-item-text">${item}</span>
                <button class="reward-item-remove" data-item="${item}">刪除</button>
            </div>
        `).join('');

        // 綁定刪除按鈕事件
        rewardList.querySelectorAll('.reward-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.dataset.item;
                this.removeRewardItem(item);
            });
        });
    }

    loadRewardItems() {
        try {
            const saved = localStorage.getItem('wheelRewardItems');
            return saved ? JSON.parse(saved) : [
                '加分 5 分',
                '加分 10 分',
                '加分 15 分',
                '扣分 5 分',
                '扣分 10 分',
                '表演才藝',
                '講笑話',
                '唱歌',
                '跳舞',
                '免作業一次'
            ];
        } catch (error) {
            console.error('載入獎懲項目失敗:', error);
            return [];
        }
    }

    saveRewardItems() {
        try {
            localStorage.setItem('wheelRewardItems', JSON.stringify(this.rewardItems));
        } catch (error) {
            console.error('儲存獎懲項目失敗:', error);
        }
    }

    getRandomColor() {
        const colors = [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    getUniqueColor(index) {
        const colors = [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
            '#1abc9c', '#34495e', '#e67e22', '#95a5a6', '#f1c40f',
            '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
            '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39',
            '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548'
        ];
        return colors[index % colors.length];
    }
}

// 初始化函數
export function init(getStudents, getClasses) {
    let wheelManager = null;

    // 綁定輪轉盤按鈕事件
    document.getElementById('btnWheel')?.addEventListener('click', () => {
        if (!wheelManager) {
            wheelManager = new WheelManager(getStudents, getClasses);
        }
        wheelManager.show();
    });
}
