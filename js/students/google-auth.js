export function createGoogleAuth(storage) {
    const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    let accessToken = store?.getItem('googleAccessToken') || null;
    let isSignedIn = !!accessToken;
    let tokenClient = null;
    let refreshTimer = null;
    const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
    const DEFAULT_TOKEN_LIFESPAN_SEC = 3600;
    let initialSignInCompleted = isSignedIn;

    function initGoogleAuth(onSuccess, onFailure) {
        tokenClient = google.accounts.oauth2.initTokenClient({
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
        google.accounts.oauth2.revoke(accessToken, () => {
            accessToken = null;
            isSignedIn = false;
            store?.removeItem('googleAccessToken');
            clearRefreshTimer();
            initialSignInCompleted = false;
            callback?.();
        });
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
