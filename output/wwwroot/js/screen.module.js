let wakeLock = null;

export async function requestFullscreen() {
    if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
    }
}

export async function exitFullscreen() {
    if (document.exitFullscreen) {
        await document.exitFullscreen();
    }
}

export async function lockOrientation(orientation) {
    if (screen.orientation && screen.orientation.lock) {
        try {
            await screen.orientation.lock(orientation);
            return true;
        } catch (e) {
            console.error("Orientation lock failed", e);
            return false;
        }
    }
    return false;
}

export async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            return true;
        } catch (err) {
            console.error("Wake lock request failed", err);
            return false;
        }
    }
    return false;
}

export async function releaseWakeLock() {
    if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
    }
}
