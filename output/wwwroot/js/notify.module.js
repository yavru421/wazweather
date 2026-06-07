export async function requestPermission() {
    if (!('Notification' in window)) {
        return 'unsupported';
    }
    // Handles both promise-based and callback-based older browsers
    try {
        return await Notification.requestPermission();
    } catch (e) {
        return new Promise((resolve) => {
            Notification.requestPermission((result) => {
                resolve(result);
            });
        });
    }
}

export async function showNotification(title, options) {
    if (!('Notification' in window)) {
        console.warn("Notifications not supported in this browser.");
        return false;
    }

    if (Notification.permission !== 'granted') {
        const permission = await requestPermission();
        if (permission !== 'granted') {
            console.warn("Notification permission was not granted.");
            return false;
        }
    }

    // Try service worker first (better background integration)
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.ready;
            if (reg && 'showNotification' in reg) {
                await reg.showNotification(title, options);
                return true;
            }
        } catch (e) {
            console.warn("Service Worker notification failed, falling back to Web Notification API", e);
        }
    }

    // Native fallback
    try {
        new Notification(title, options);
        return true;
    } catch (e) {
        console.error("Failed to show native Notification: ", e);
        return false;
    }
}

export function scheduleLocal(title, options, delayMs) {
    if (delayMs < 0) delayMs = 0;
    
    const timeoutId = setTimeout(async () => {
        await showNotification(title, options);
    }, delayMs);
    
    return timeoutId;
}

export function cancelScheduledLocal(timeoutId) {
    clearTimeout(timeoutId);
    return true;
}
