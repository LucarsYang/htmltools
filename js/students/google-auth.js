export function createGoogleAuth(storage) {
    const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
    let accessToken = store?.getItem('googleAccessToken') || null;
    let isSignedIn = !!accessToken;
    let tokenClient = null;

    function initGoogleAuth(onSuccess, onFailure) {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: '310618779783-ephi24bku6psi9c7c1babi0v1n7fu8u9.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (resp) => {
                if (resp.error) {
                    onFailure?.(resp.error);
                } else {
                    accessToken = resp.access_token;
                    store?.setItem('googleAccessToken', accessToken);
                    isSignedIn = true;
                    onSuccess?.();
                }
            }
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
        google.accounts.oauth2.revoke(accessToken, () => {
            accessToken = null;
            isSignedIn = false;
            store?.removeItem('googleAccessToken');
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
