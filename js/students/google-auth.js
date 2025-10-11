const DEFAULT_EXPIRES_IN_SECONDS = 3600;
const REFRESH_BUFFER_SECONDS = 5 * 60;
const MIN_REFRESH_DELAY_SECONDS = 60;

export function createGoogleAuth(storage) {
    const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    const storedToken = store?.getItem('googleAccessToken') || null;
    const storedExpiryRaw = store?.getItem('googleAccessTokenExpiresAt');
    const storedExpiry = storedExpiryRaw ? Number(storedExpiryRaw) : NaN;

    let accessToken = null;
    let isSignedIn = false;
    let tokenClient = null;
    let refreshTimer = null;
    let pendingRefreshDelayMs = null;

    if (storedToken) {
        const now = Date.now();
        if (Number.isFinite(storedExpiry)) {
            if (storedExpiry > now) {
                accessToken = storedToken;
                isSignedIn = true;
                const remainingSeconds = Math.max(Math.floor((storedExpiry - now) / 1000), 0);
                scheduleTokenRefresh(remainingSeconds);
            } else {
                store?.removeItem('googleAccessToken');
                store?.removeItem('googleAccessTokenExpiresAt');
            }
        } else {
            accessToken = storedToken;
            isSignedIn = true;
            scheduleTokenRefresh(DEFAULT_EXPIRES_IN_SECONDS);
        }
    }

    function clearRefreshTimer() {
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }
    }

    function scheduleRefreshTimerWithDelay(delayMs) {
        clearRefreshTimer();
        if (!Number.isFinite(delayMs) || delayMs <= 0) {
            delayMs = (DEFAULT_EXPIRES_IN_SECONDS - REFRESH_BUFFER_SECONDS) * 1000;
        }

        if (!tokenClient) {
            pendingRefreshDelayMs = delayMs;
            return;
        }

        refreshTimer = setTimeout(() => {
            refreshTimer = null;
            pendingRefreshDelayMs = null;
            if (!tokenClient || !isSignedIn) return;
            try {
                tokenClient.requestAccessToken({ prompt: '' });
            } catch (err) {
                console.error('自動延長登入失敗:', err);
            }
        }, delayMs);
    }

    function scheduleTokenRefresh(expiresInSeconds) {
        let effectiveExpiresIn = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
            ? expiresInSeconds
            : DEFAULT_EXPIRES_IN_SECONDS;

        const refreshDelaySeconds = Math.max(
            effectiveExpiresIn - REFRESH_BUFFER_SECONDS,
            MIN_REFRESH_DELAY_SECONDS
        );

        scheduleRefreshTimerWithDelay(refreshDelaySeconds * 1000);
    }

    function persistToken(newToken, expiresInSeconds) {
        accessToken = newToken;
        isSignedIn = !!newToken;

        if (!newToken) {
            store?.removeItem('googleAccessToken');
            store?.removeItem('googleAccessTokenExpiresAt');
            clearRefreshTimer();
            pendingRefreshDelayMs = null;
            return;
        }

        store?.setItem('googleAccessToken', accessToken);

        const effectiveExpiresIn = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
            ? expiresInSeconds
            : DEFAULT_EXPIRES_IN_SECONDS;
        const expiresAt = Date.now() + effectiveExpiresIn * 1000;
        store?.setItem('googleAccessTokenExpiresAt', String(expiresAt));
        scheduleTokenRefresh(effectiveExpiresIn);
    }

    function initGoogleAuth(onSuccess, onFailure) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '310618779783-ephi24bku6psi9c7c1babi0v1n7fu8u9.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (resp) => {
                if (resp.error) {
                    console.error('取得 Google 存取權杖失敗:', resp.error);
                    persistToken(null);
                    onFailure?.(resp.error);
                    return;
                }

                const wasSignedIn = isSignedIn;
                persistToken(resp.access_token, Number(resp.expires_in));

                if (!wasSignedIn) {
                    onSuccess?.();
                }
            }
        });

        if (pendingRefreshDelayMs !== null) {
            const delay = pendingRefreshDelayMs;
            pendingRefreshDelayMs = null;
            scheduleRefreshTimerWithDelay(delay);
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
        const token = accessToken;
        const finish = () => {
            persistToken(null);
            callback?.();
        };

        if (!token) {
            finish();
            return;
        }

        google.accounts.oauth2.revoke(token, finish);
    }

    function getAccessToken() {
        return accessToken;
    }

    function getIsSignedIn() {
        return isSignedIn;
    }

    function simulateTokenExpired() {
        clearRefreshTimer();
        pendingRefreshDelayMs = null;
        accessToken = 'test_expired_token';
        isSignedIn = true;
        store?.setItem('googleAccessToken', accessToken);
        store?.setItem('googleAccessTokenExpiresAt', String(Date.now() - 1000));
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
