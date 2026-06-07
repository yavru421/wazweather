export async function requestPermission() {
    if (!('Notification' in window)) {
        return 'denied';
    }
    return await Notification.requestPermission();
}

export function showNotification(title, body, icon = null, vibrate = null) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }
    const options = {
        body: body,
        icon: icon || undefined,
        vibrate: vibrate || undefined
    };
    new Notification(title, options);
}

export function scheduleLocalNotification(title, body, delayMs, icon = null, vibrate = null) {
    setTimeout(() => {
        showNotification(title, body, icon, vibrate);
    }, delayMs);
}
