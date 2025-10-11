export function createGoogleAuth(storage) {
    const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    let accessToken = store?.getItem('googleAccessToken') || null;
    let isSignedIn = !!accessToken;
    let tokenClient = null;
    let refreshTimer = null;
    const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
    const DEFAULT_TOKEN_LIFESPAN_SEC = 3600;
    let initialSignInCompleted = isSignedIn;
    let googleReadyPromise = null;
    const GOOGLE_LOAD_CHECK_INTERVAL_MS = 100;
    const GOOGLE_LOAD_TIMEOUT_MS = 15 * 1000;

    function waitForGoogleOAuth() {
        if (typeof window === 'undefined') {
            return Promise.reject(new Error('Google OAuth 僅能在瀏覽器環境使用'));
        }

        if (window.google?.accounts?.oauth2) {
            return Promise.resolve(window.google);
        }

        if (!googleReadyPromise) {
            googleReadyPromise = new Promise((resolve, reject) => {
                const deadline = Date.now() + GOOGLE_LOAD_TIMEOUT_MS;

                const checkGoogleLoaded = () => {
                    if (window.google?.accounts?.oauth2) {
                        resolve(window.google);
                        return;
                    }

                    if (Date.now() >= deadline) {
                        reject(new Error('Google Identity Services 載入逾時'));
                        return;
                    }

                    window.setTimeout(checkGoogleLoaded, GOOGLE_LOAD_CHECK_INTERVAL_MS);
                };

                window.setTimeout(checkGoogleLoaded, GOOGLE_LOAD_CHECK_INTERVAL_MS);
            });
        }

        return googleReadyPromise;
    }

    function initGoogleAuth(onSuccess, onFailure) {
        waitForGoogleOAuth()
            .then((googleGlobal) => {
                tokenClient = googleGlobal.accounts.oauth2.initTokenClient({
                    client_id: '310618779783-ephi24bku6psi9c7c1babi0v1n7fu8u9.apps.googleusercontent.com',
                    scope: 'https://www.googleapis.com/auth/drive.file',
                    callback: (resp) => {
                        if (resp.error) {
                            clearRefreshTimer();
                            onFailure?.(resp.error);
                        } else {
                            accessToken = resp.access_token;
                            store?.setItem('googleAccessToken', accessToken);
                            isSignedIn = true;
                            scheduleTokenRefresh(resp.expires_in);
                            if (!initialSignInCompleted) {
                                initialSignInCompleted = true;
                                onSuccess?.();
                            }
                        }
                    }
                });

                if (isSignedIn) {
                    scheduleTokenRefresh();
                    requestSilentRefresh();
                }
            })
            .catch((err) => {
                console.error('初始化 Google 登入失敗', err);
                onFailure?.(err);
            });
    }

    function signIn() {
        if (!tokenClient) {
            console.warn('tokenClient 未初始化');
            return;
        }
        tokenClient.requestAccessToken();
    }

    function signOut(callback) {
        if (!accessToken) {
            callback?.();
            return;
        }

        const googleRevoke = window?.google?.accounts?.oauth2?.revoke;
        if (typeof googleRevoke !== 'function') {
            console.warn('找不到 Google OAuth revoke 函式，改為本地登出');
            completeSignOut(callback);
            return;
        }

        googleRevoke(accessToken, () => {
            completeSignOut(callback);
        });
    }

    function completeSignOut(callback) {
        accessToken = null;
        isSignedIn = false;
        store?.removeItem('googleAccessToken');
        clearRefreshTimer();
        initialSignInCompleted = false;
        callback?.();
    }

    function getAccessToken() {
        return accessToken;
    }

    function getIsSignedIn() {
        return isSignedIn;
    }

    function simulateTokenExpired() {
        accessToken = 'test_expired_token';
        isSignedIn = true;
        store?.setItem('googleAccessToken', accessToken);
        scheduleTokenRefresh();
    }

    function clearRefreshTimer() {
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }
    }

    function scheduleTokenRefresh(expiresInSec = DEFAULT_TOKEN_LIFESPAN_SEC) {
        if (typeof window === 'undefined') return;
        clearRefreshTimer();
        const lifespan = Number.isFinite(Number(expiresInSec)) && Number(expiresInSec) > 0
            ? Number(expiresInSec)
            : DEFAULT_TOKEN_LIFESPAN_SEC;
        const delay = Math.max((lifespan * 1000) - TOKEN_REFRESH_MARGIN_MS, 5 * 60 * 1000);
        refreshTimer = window.setTimeout(() => {
            requestSilentRefresh();
        }, delay);
    }

    function requestSilentRefresh() {
        if (!tokenClient || !isSignedIn) return;
        try {
            tokenClient.requestAccessToken({ prompt: '' });
        } catch (err) {
            console.warn('刷新存取權杖失敗', err);
        }
    }

    return {
        initGoogleAuth,
        signIn,
        signOut,
        getAccessToken,
        getIsSignedIn,
        simulateTokenExpired
    };
}
