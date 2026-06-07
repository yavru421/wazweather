export function checkCapabilities() {
    const caps = {
        camera: false,
        geo: false,
        motion: false,
        haptics: false,
        share: false,
        notify: false,
        battery: false,
        media: false,
        screen: false,
        bluetooth: false
    };

    if (typeof navigator !== 'undefined') {
        caps.camera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        caps.geo = 'geolocation' in navigator;
        caps.haptics = typeof navigator.vibrate === 'function';
        caps.share = typeof navigator.share === 'function';
        caps.battery = typeof navigator.getBattery === 'function';
        caps.media = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        caps.screen = 'fullscreenEnabled' in document || 'wakeLock' in navigator;
        caps.bluetooth = 'bluetooth' in navigator || 'NDEFReader' in window;
    }

    if (typeof window !== 'undefined') {
        caps.motion = 'DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window;
        caps.notify = 'Notification' in window;
    }

    return caps;
}
