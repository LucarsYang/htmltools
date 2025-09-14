// 考試倒數計時器功能
class ExamCountdownTimer {
    constructor() {
        this.schedules = [];
        this.currentSchedule = null;
        this.timer = null;
        this.isRunning = false;
        this.isFullscreen = false;
        this.currentView = 'config'; // 'config' 或 'display'
        
        this.init();
    }

    init() {
        this.createHTML();
        this.bindEvents();
        this.loadSchedules();
        this.updateFullscreenButtonText();
    }

    createHTML() {
        // 建立全畫面燈箱容器
        const overlay = document.createElement('div');
        overlay.id = 'examTimerOverlay';
        overlay.className = 'exam-timer-overlay';
        
        overlay.innerHTML = `
            <!-- 設定畫面 -->
            <div id="examTimerConfig" class="exam-timer-config">
                <h2>考試倒數計時器</h2>
                
                <!-- 時程新增表單 -->
                <div class="schedule-form">
                    <div class="form-group">
                        <label for="subjectName">考試科目：</label>
                        <input type="text" id="subjectName" placeholder="例如：國語" maxlength="20">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="startTime">開始時間：</label>
                            <input type="time" id="startTime">
                        </div>
                        <div class="form-group">
                            <label for="endTime">結束時間：</label>
                            <input type="time" id="endTime">
                        </div>
                    </div>
                    <button id="btnAddSchedule" class="btn-add-schedule">新增時程</button>
                </div>
                
                <!-- 時程佇列 -->
                <div class="schedule-list">
                    <h3>已排定時程</h3>
                    <div class="schedule-list-content">
                        <div id="scheduleList"></div>
                    </div>
                </div>
                
                <!-- 控制按鈕 -->
                <div class="timer-controls">
                    <button id="btnClearAll" class="btn-clear-all">清空全部</button>
                    <button id="btnStartTimer" class="btn-start-timer">開始計時</button>
                    <button id="btnCancelTimer" class="btn-cancel-timer">退出設定</button>
                </div>
            </div>
            
            <!-- 倒數計時畫面 -->
            <div id="examTimerDisplay" class="exam-timer-display">
                <div class="system-time" id="systemTime"></div>
                <div class="exam-status" id="examStatus">考試進行中</div>
                <div class="exam-subject" id="examSubject">國語</div>
                <div class="countdown-timer" id="countdownTimer">00:00:00</div>
                <div class="waiting-status" id="waitingStatus" style="display: none;">等待下一個時程</div>
                <div class="waiting-timer" id="waitingTimer" style="display: none;">00:00:00</div>
                <div class="exam-finished" id="examFinished" style="display: none;">考試結束</div>
                
                <div class="timer-display-controls">
                    <button id="btnBackSettings" class="btn-back-settings">返回設定</button>
                    <button id="btnFullscreen" class="btn-fullscreen">全螢幕</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    bindEvents() {
        // 設定畫面事件
        document.getElementById('btnAddSchedule').addEventListener('click', () => this.addSchedule());
        document.getElementById('btnClearAll').addEventListener('click', () => this.clearAllSchedules());
        document.getElementById('btnStartTimer').addEventListener('click', () => this.startTimer());
        document.getElementById('btnCancelTimer').addEventListener('click', () => this.hide());
        
        // 倒數計時畫面事件
        document.getElementById('btnBackSettings').addEventListener('click', () => this.backToConfig());
        document.getElementById('btnFullscreen').addEventListener('click', () => this.toggleFullscreen());
        
        // 鍵盤事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.currentView === 'display') {
                    this.backToConfig();
                } else {
                    this.hide();
                }
            }
        });
        
        // 全螢幕變化事件
        document.addEventListener('fullscreenchange', () => {
            this.isFullscreen = !!document.fullscreenElement;
            this.updateFullscreenButtonText();
        });
    }

    addSchedule() {
        const subject = document.getElementById('subjectName').value.trim();
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        
        if (!subject) {
            alert('請輸入考試科目');
            return;
        }
        
        if (!startTime || !endTime) {
            alert('請選擇開始和結束時間');
            return;
        }
        
        if (startTime >= endTime) {
            alert('結束時間必須晚於開始時間');
            return;
        }
        
        const schedule = {
            id: Date.now(),
            subject: subject,
            startTime: startTime,
            endTime: endTime
        };
        
        this.schedules.push(schedule);
        this.schedules.sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        this.renderScheduleList();
        this.saveSchedules();
        
        // 清空表單
        document.getElementById('subjectName').value = '';
        document.getElementById('startTime').value = '';
        document.getElementById('endTime').value = '';
    }

    removeSchedule(id) {
        this.schedules = this.schedules.filter(s => s.id !== id);
        this.renderScheduleList();
        this.saveSchedules();
    }

    clearAllSchedules() {
        if (this.schedules.length === 0) {
            alert('沒有時程需要清空');
            return;
        }
        
        if (confirm('確定要清空所有時程嗎？')) {
            this.schedules = [];
            this.renderScheduleList();
            this.saveSchedules();
        }
    }

    renderScheduleList() {
        const list = document.getElementById('scheduleList');
        list.innerHTML = '';
        
        if (this.schedules.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">尚無排定時程</p>';
            return;
        }
        
        this.schedules.forEach(schedule => {
            const item = document.createElement('div');
            item.className = 'schedule-item';
            item.innerHTML = `
                <div class="schedule-info">${schedule.startTime} - ${schedule.endTime} ${schedule.subject}</div>
                <button class="schedule-remove" onclick="examTimer.removeSchedule(${schedule.id})">×</button>
            `;
            list.appendChild(item);
        });
    }

    startTimer() {
        if (this.schedules.length === 0) {
            alert('請先新增至少一個時程');
            return;
        }
        
        this.currentView = 'display';
        this.showDisplayView();
        this.findCurrentSchedule();
        this.startCountdown();
    }

    findCurrentSchedule() {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        
        // 尋找當前正在進行的時程
        this.currentSchedule = this.schedules.find(schedule => 
            currentTime >= schedule.startTime && currentTime < schedule.endTime
        );
        
        if (this.currentSchedule) {
            // 正在進行中
            document.getElementById('examStatus').textContent = '考試進行中';
            document.getElementById('examSubject').textContent = this.currentSchedule.subject;
            document.getElementById('countdownTimer').style.display = 'block';
            document.getElementById('waitingStatus').style.display = 'none';
            document.getElementById('waitingTimer').style.display = 'none';
            document.getElementById('examFinished').style.display = 'none';
        } else {
            // 尋找下一個時程
            const nextSchedule = this.schedules.find(schedule => 
                currentTime < schedule.startTime
            );
            
            if (nextSchedule) {
                // 等待下一個時程
                this.currentSchedule = nextSchedule;
                document.getElementById('examStatus').textContent = '等待下一個時程';
                document.getElementById('examSubject').textContent = nextSchedule.subject;
                document.getElementById('countdownTimer').style.display = 'none';
                document.getElementById('waitingStatus').style.display = 'block';
                document.getElementById('waitingTimer').style.display = 'block';
                document.getElementById('examFinished').style.display = 'none';
            } else {
                // 所有時程都已結束
                document.getElementById('examStatus').textContent = '';
                document.getElementById('examSubject').textContent = '';
                document.getElementById('countdownTimer').style.display = 'none';
                document.getElementById('waitingStatus').style.display = 'none';
                document.getElementById('waitingTimer').style.display = 'none';
                document.getElementById('examFinished').style.display = 'block';
            }
        }
    }

    startCountdown() {
        this.isRunning = true;
        this.updateSystemTime();
        this.timer = setInterval(() => {
            this.updateSystemTime();
            this.updateCountdown();
        }, 1000);
    }

    stopCountdown() {
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    updateSystemTime() {
        const now = new Date();
        const timeString = now.toTimeString().slice(0, 8);
        document.getElementById('systemTime').textContent = timeString;
    }

    updateCountdown() {
        if (!this.currentSchedule) return;
        
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        
        // 調試日誌
        console.log('updateCountdown - currentTime:', currentTime, 'startTime:', this.currentSchedule.startTime, 'endTime:', this.currentSchedule.endTime);
        console.log('條件檢查 - currentTime >= startTime:', currentTime >= this.currentSchedule.startTime, 'currentTime < endTime:', currentTime < this.currentSchedule.endTime);
        
        // 檢查是否正在進行考試
        if (currentTime >= this.currentSchedule.startTime && currentTime < this.currentSchedule.endTime) {
            console.log('進入考試進行中分支');
            
            // 確保顯示狀態正確
            document.getElementById('examStatus').textContent = '考試進行中';
            document.getElementById('examSubject').textContent = this.currentSchedule.subject;
            document.getElementById('countdownTimer').style.display = 'block';
            document.getElementById('waitingStatus').style.display = 'none';
            document.getElementById('waitingTimer').style.display = 'none';
            document.getElementById('examFinished').style.display = 'none';
            
            // 正在進行中，顯示剩餘時間
            const endTime = new Date();
            const [hours, minutes] = this.currentSchedule.endTime.split(':');
            endTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            const remaining = endTime - now;
            if (remaining > 0) {
                const timeString = this.formatTime(remaining);
                document.getElementById('countdownTimer').textContent = timeString;
                document.getElementById('countdownTimer').classList.remove('time-up');
            } else {
                // 時間到
                document.getElementById('countdownTimer').textContent = '00:00:00';
                document.getElementById('countdownTimer').classList.add('time-up');
                this.playTimeUpSound();
            }
        } else if (currentTime < this.currentSchedule.startTime) {
            console.log('進入等待開始分支');
            // 等待開始，顯示倒數到開始時間
            const startTime = new Date();
            const [hours, minutes] = this.currentSchedule.startTime.split(':');
            startTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            const waiting = startTime - now;
            if (waiting > 0) {
                const timeString = this.formatTime(waiting);
                document.getElementById('waitingTimer').textContent = timeString;
            } else {
                // 等待時間結束，檢查是否應該開始考試
                console.log('等待時間結束 - currentTime:', currentTime, 'startTime:', this.currentSchedule.startTime, 'endTime:', this.currentSchedule.endTime);
                if (currentTime >= this.currentSchedule.startTime && currentTime < this.currentSchedule.endTime) {
                    console.log('切換到考試進行中狀態');
                    // 時間到了，直接切換到考試進行中狀態
                    document.getElementById('examStatus').textContent = '考試進行中';
                    document.getElementById('examSubject').textContent = this.currentSchedule.subject;
                    document.getElementById('countdownTimer').style.display = 'block';
                    document.getElementById('waitingStatus').style.display = 'none';
                    document.getElementById('waitingTimer').style.display = 'none';
                    document.getElementById('examFinished').style.display = 'none';
                    // 清除等待倒數計時器的內容
                    document.getElementById('waitingTimer').textContent = '00:00:00';
                } else {
                    console.log('時間已超過考試時間，尋找下一個時程');
                    // 如果時間已經超過考試時間，尋找下一個時程
                    this.findCurrentSchedule();
                }
            }
        } else {
            console.log('進入時程已結束分支');
            // 當前時程已結束，尋找下一個
            this.findCurrentSchedule();
        }
    }

    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    playTimeUpSound() {
        // 播放提示音（使用 Web Audio API）
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 1);
        } catch (e) {
            console.log('無法播放提示音');
        }
    }

    showDisplayView() {
        document.getElementById('examTimerConfig').style.display = 'none';
        document.getElementById('examTimerDisplay').classList.add('show');
    }

    backToConfig() {
        this.stopCountdown();
        this.currentView = 'config';
        document.getElementById('examTimerDisplay').classList.remove('show');
        document.getElementById('examTimerConfig').style.display = 'block';
        
        // 退出全螢幕
        if (this.isFullscreen) {
            this.exitFullscreen();
        }
    }

    toggleFullscreen() {
        if (this.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
        this.updateFullscreenButtonText();
    }

    enterFullscreen() {
        const element = document.getElementById('examTimerOverlay');
        if (element.requestFullscreen) {
            element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
        }
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    updateFullscreenButtonText() {
        const button = document.getElementById('btnFullscreen');
        if (this.isFullscreen) {
            button.textContent = '退出全螢幕';
        } else {
            button.textContent = '全螢幕';
        }
    }

    show() {
        document.getElementById('examTimerOverlay').classList.add('show');
    }

    hide() {
        this.stopCountdown();
        document.getElementById('examTimerOverlay').classList.remove('show');
        this.backToConfig();
    }

    saveSchedules() {
        localStorage.setItem('examTimerSchedules', JSON.stringify(this.schedules));
    }

    loadSchedules() {
        const saved = localStorage.getItem('examTimerSchedules');
        if (saved) {
            this.schedules = JSON.parse(saved);
            this.renderScheduleList();
        }
    }
}

// 建立全域實例
let examTimer = null;

// 初始化函數
function initExamTimer() {
    if (!examTimer) {
        examTimer = new ExamCountdownTimer();
    }
    examTimer.show();
}

// 將函數暴露到全域範圍
window.initExamTimer = initExamTimer;
