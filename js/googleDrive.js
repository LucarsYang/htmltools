import { getAccessToken, getIsSignedIn } from './googleAuth.js';

let syncStatus = 'synced'; // 'synced', 'modified', 'syncing'
let fileId = null;
const FILE_NAME = 'students_data.json';

// 應用程式目錄的 ID
let appFolderId = null;

// 初始化 Google Drive
export function initGoogleDrive() {
    updateSyncStatus('synced');
    checkExistingFile();
}

// 更新同步狀態
export function updateSyncStatus(status) {
    syncStatus = status;
    const statusBar = document.getElementById('syncStatusBar');
    if (!statusBar) return;

    statusBar.className = '';
    switch (status) {
        case 'modified':
            statusBar.classList.add('red');
            statusBar.innerHTML = '<i class="fas fa-exclamation-circle"></i> 有未同步的更改';
            break;
        case 'syncing':
            statusBar.classList.add('yellow');
            statusBar.innerHTML = '<i class="fas fa-sync fa-spin"></i> 同步中...';
            break;
        case 'synced':
            statusBar.classList.add('green');
            statusBar.innerHTML = '<i class="fas fa-check-circle"></i> 已同步';
            break;
        default:
            statusBar.classList.add('grey');
            statusBar.innerHTML = '<i class="fas fa-times-circle"></i> 未連接';
    }
}

// 檢查是否存在已有的文件
async function checkExistingFile() {
    if (!getIsSignedIn()) return;

    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and mimeType='application/json' and trashed=false&spaces=drive&fields=files(id, name, modifiedTime)`,
            { headers: { "Authorization": `Bearer ${getAccessToken()}` } }
        );

        if (!response.ok) throw new Error("List Error " + response.status);
        const files = await response.json();
        if (files && files.files && files.files.length > 0) {
            fileId = files.files[0].id;
            await loadFromDrive();
        }
    } catch (err) {
        console.error('Error checking existing file:', err);
    }
}

// 從 Drive 載入數據
export async function loadFromDrive() {
    if (!fileId || !getIsSignedIn()) return null;

    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            { headers: { "Authorization": `Bearer ${getAccessToken()}` } }
        );
        if (!response.ok) throw new Error("Get Error " + response.status);
        const content = await response.text();
        return JSON.parse(content);
    } catch (err) {
        console.error('Error loading from Drive:', err);
        return null;
    }
}

// 保存數據到 Drive
export async function saveToDrive(data) {
    if (!getIsSignedIn()) return;

    updateSyncStatus('syncing');
    const metadata = {
        name: FILE_NAME,
        mimeType: 'application/json',
    };

    const content = JSON.stringify(data);

    try {
        if (fileId) {
            // 更新現有文件
            await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'PATCH',
                headers: {
                    "Authorization": `Bearer ${getAccessToken()}`,
                    "Content-Type": "application/json"
                },
                body: content
            });
        } else {
            // 創建新文件
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?fields=id`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${getAccessToken()}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(metadata)
                }
            );
            if (!response.ok) throw new Error("Create File Error " + response.status);
            const fileData = await response.json();
            fileId = fileData.id;
        }
        updateSyncStatus('synced');
    } catch (err) {
        console.error('Error saving to Drive:', err);
        updateSyncStatus('modified');
    }
}

// 手動同步
export async function syncWithDrive() {
    if (!getIsSignedIn()) {
        alert('請先登入 Google 帳號');
        return;
    }

    const data = JSON.parse(localStorage.getItem('studentsData') || '[]');
    await saveToDrive(data);
}

/**
 * 確保應用程式目錄存在
 * @returns {Promise<string|null>} 目錄 ID
 */
export async function ensureAppFolder() {
    if (!getIsSignedIn()) return null;
    let token = getAccessToken();

    try {
        // 先搜尋是否已存在目錄
        let searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='htmltools' and mimeType='application/vnd.google-apps.folder' and trashed=false&spaces=drive&fields=files(id,name)`,
            { headers: { "Authorization": `Bearer ${token}` } }
        );
        if (!searchRes.ok) throw new Error("Search Error " + searchRes.status);
        let searchData = await searchRes.json();

        if (searchData.files && searchData.files.length > 0) {
            // 目錄已存在
            appFolderId = searchData.files[0].id;
            return appFolderId;
        }

        // 建立新目錄
        let folderMetadata = {
            name: "htmltools",
            mimeType: "application/vnd.google-apps.folder"
        };

        let createRes = await fetch(
            "https://www.googleapis.com/drive/v3/files?fields=id",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(folderMetadata)
            }
        );
        if (!createRes.ok) throw new Error("Create Folder Error " + createRes.status);
        let createData = await createRes.json();
        appFolderId = createData.id;
        return appFolderId;
    } catch(err) {
        console.error("確保應用程式目錄時發生錯誤:", err);
        return null;
    }
}

/**
 * 從 Google Drive 載入檔案
 * @param {string} fileName 檔案名稱
 * @returns {Promise<object|null>} 檔案內容
 */
export async function loadDriveFile(fileName) {
    if (!getIsSignedIn()) return null;
    let token = getAccessToken();
    
    try {
        await ensureAppFolder();

        // 在應用程式目錄中搜尋檔案
        let listRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${appFolderId}' in parents and name='${fileName}' and trashed=false&spaces=drive&fields=files(id,name)`,
            { headers: { "Authorization": `Bearer ${token}` } }
        );
        if (!listRes.ok) throw new Error("List Error " + listRes.status);
        let listData = await listRes.json();
        if (!listData.files || listData.files.length === 0) {
            return null;
        }
        let fileId = listData.files[0].id;

        let getRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            { headers: { "Authorization": `Bearer ${token}` } }
        );
        if (!getRes.ok) throw new Error("Get Error " + getRes.status);
        let content = await getRes.text();
        return JSON.parse(content);
    } catch(err) {
        console.error("載入檔案失敗:", err);
        throw err;
    }
}

/**
 * 保存檔案到 Google Drive
 * @param {string} fileName 檔案名稱
 * @param {object} dataObj 要保存的資料
 * @returns {Promise<void>}
 */
export async function saveDriveFile(fileName, dataObj) {
    if (!getIsSignedIn()) throw new Error("尚未登入Google");
    let token = getAccessToken();
    
    try {
        await ensureAppFolder();

        // 在應用程式目錄中搜尋檔案
        let listRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${appFolderId}' in parents and name='${fileName}' and trashed=false&spaces=drive&fields=files(id,name)`,
            { headers: { "Authorization": `Bearer ${token}` } }
        );
        if (!listRes.ok) throw new Error("List Error " + listRes.status);
        let listData = await listRes.json();
        let fileId = (listData.files && listData.files.length > 0) ? listData.files[0].id : null;

        if (fileId) {
            // 如果檔案存在，先刪除它
            await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { "Authorization": `Bearer ${token}` }
            });
        }

        // 建立新檔案
        let fileMetadata = {
            name: fileName,
            mimeType: "application/json",
            parents: [appFolderId]
        };
        let fileContent = new Blob([JSON.stringify(dataObj)], { type: "application/json" });
        let form = new FormData();
        form.append("metadata", new Blob([JSON.stringify(fileMetadata)], { type: "application/json" }));
        form.append("file", fileContent);

        let uploadRes = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${token}`
                },
                body: form
            }
        );

        if (!uploadRes.ok) throw new Error("Upload Error " + uploadRes.status);
        await uploadRes.json();
    } catch(err) {
        console.error("保存檔案失敗:", err);
        throw err;
    }
}

/**
 * 上傳圖片到 Google Drive
 * @param {File} file 圖片檔案
 * @returns {Promise<string>} 檔案 ID
 */
export async function uploadImageToDrive(file) {
    const token = getAccessToken();
    if (!token) throw new Error("尚未登入");
    
    try {
        await ensureAppFolder();

        const metadata = {
            name: `student_${Date.now()}_${file.name}`,
            mimeType: file.type,
            parents: [appFolderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: form
        });

        if (!uploadRes.ok) throw new Error('上傳失敗');
        const uploadData = await uploadRes.json();

        // 設定檔案權限為「任何人都可以查看」
        const permissionRes = await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                role: 'reader',
                type: 'anyone'
            })
        });

        if (!permissionRes.ok) {
            // 如果設定權限失敗，刪除已上傳的檔案
            await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            throw new Error('設定權限失敗');
        }

        return uploadData.id;
    } catch(err) {
        console.error("上傳圖片失敗:", err);
        throw err;
    }
}

/**
 * 從 Google Drive 獲取圖片的 URL
 * @param {string} fileId 檔案 ID
 * @returns {string} 圖片 URL
 */
export function getImageUrlFromDrive(fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w200-h200`;
}

/**
 * 獲取所有圖片
 * @returns {Promise<Array>} 圖片列表
 */
export async function getAllImages() {
    if (!getIsSignedIn()) return [];
    const token = getAccessToken();
    
    try {
        await ensureAppFolder();

        // 搜尋應用程式目錄中的所有圖片檔案
        const searchRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${appFolderId}' in parents and mimeType contains 'image/' and trashed=false&fields=files(id,name,mimeType)`,
            { headers: { "Authorization": `Bearer ${token}` } }
        );

        if (!searchRes.ok) throw new Error("搜尋圖片失敗");
        const searchData = await searchRes.json();

        // 為每個圖片取得縮圖 URL
        return searchData.files.map(file => ({
            id: file.id,
            url: `https://drive.google.com/thumbnail?id=${file.id}&sz=w200-h200`,
            name: file.name
        }));
    } catch(err) {
        console.error("取得圖片列表失敗:", err);
        return [];
    }
}

/**
 * 從 Google Drive 刪除檔案
 * @param {string} fileId 檔案 ID
 * @returns {Promise<boolean>} 是否成功
 */
export async function deleteFile(fileId) {
    if (!getIsSignedIn()) return false;
    const token = getAccessToken();
    
    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}`,
            {
                method: 'DELETE',
                headers: { "Authorization": `Bearer ${token}` }
            }
        );
        
        if (!response.ok) throw new Error("刪除失敗");
        return true;
    } catch(err) {
        console.error("刪除檔案失敗:", err);
        throw err;
    }
}

// 導出需要的變量
export {
    syncStatus,
    fileId
}; 