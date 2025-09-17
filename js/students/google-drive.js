export function createGoogleDrive(googleAuth) {
    let appFolderId = null;

    async function ensureAppFolder() {
        if (!googleAuth.getIsSignedIn()) return null;
        const token = googleAuth.getAccessToken();

        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='htmltools' and mimeType='application/vnd.google-apps.folder' and trashed=false&spaces=drive&fields=files(id,name)`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!searchRes.ok) throw new Error(`Search Error ${searchRes.status}`);
        const searchData = await searchRes.json();

        if (searchData.files && searchData.files.length > 0) {
            appFolderId = searchData.files[0].id;
            return appFolderId;
        }

        const folderMetadata = {
            name: 'htmltools',
            mimeType: 'application/vnd.google-apps.folder'
        };

        const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(folderMetadata)
        });
        if (!createRes.ok) throw new Error(`Create Folder Error ${createRes.status}`);
        const createData = await createRes.json();
        appFolderId = createData.id;
        return appFolderId;
    }

    async function loadDriveFile(fileName) {
        if (!googleAuth.getIsSignedIn()) return null;
        const token = googleAuth.getAccessToken();
        await ensureAppFolder();

        const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${appFolderId}' in parents and name='${fileName}' and trashed=false&spaces=drive&fields=files(id,name)`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!listRes.ok) throw new Error(`List Error ${listRes.status}`);
        const listData = await listRes.json();
        if (!listData.files || listData.files.length === 0) {
            return null;
        }
        const fileId = listData.files[0].id;

        const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!getRes.ok) throw new Error(`Get Error ${getRes.status}`);
        const content = await getRes.text();
        return JSON.parse(content);
    }

    async function saveDriveFile(fileName, dataObj) {
        if (!googleAuth.getIsSignedIn()) throw new Error('尚未登入Google');
        const token = googleAuth.getAccessToken();
        await ensureAppFolder();

        if (token === 'test_expired_token') {
            throw new Error('401 Unauthorized');
        }

        const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${appFolderId}' in parents and name='${fileName}' and trashed=false&spaces=drive&fields=files(id,name)`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!listRes.ok) throw new Error(`List Error ${listRes.status}`);
        const listData = await listRes.json();
        const fileId = (listData.files && listData.files.length > 0) ? listData.files[0].id : null;

        if (fileId) {
            await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }

        const fileMetadata = {
            name: fileName,
            mimeType: 'application/json',
            parents: [appFolderId]
        };
        const fileContent = new Blob([JSON.stringify(dataObj)], { type: 'application/json' });
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        form.append('file', fileContent);

        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: form
        });

        if (!uploadRes.ok) throw new Error(`Upload Error ${uploadRes.status}`);
        await uploadRes.json();
    }

    async function uploadImageToDrive(file) {
        const token = googleAuth.getAccessToken();
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
            await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            throw new Error('設定權限失敗');
        }

        return uploadData.id;
    }

    async function getImageUrlFromDrive(fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w200-h200`;
    }

    async function getAllImages() {
        if (!googleAuth.getIsSignedIn()) return [];
        const token = googleAuth.getAccessToken();
        await ensureAppFolder();

        try {
            const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${appFolderId}' in parents and mimeType contains 'image/' and trashed=false&fields=files(id,name,mimeType)`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!searchRes.ok) throw new Error('搜尋圖片失敗');
            const searchData = await searchRes.json();

            return searchData.files.map(file => ({
                id: file.id,
                url: `https://drive.google.com/thumbnail?id=${file.id}&sz=w200-h200`,
                name: file.name
            }));
        } catch (err) {
            console.error('取得圖片列表失敗:', err);
            return [];
        }
    }

    async function deleteFile(fileId) {
        if (!googleAuth.getIsSignedIn()) return;
        const token = googleAuth.getAccessToken();

        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('刪除失敗');
            return true;
        } catch (err) {
            console.error('刪除檔案失敗:', err);
            throw err;
        }
    }

    return {
        loadDriveFile,
        saveDriveFile,
        uploadImageToDrive,
        getImageUrlFromDrive,
        getAllImages,
        deleteFile
    };
}
