let devicemotionListener = null;

export async function requestPermission() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        try {
            const permissionState = await DeviceMotionEvent.requestPermission();
            return permissionState === 'granted';
        } catch (error) {
            console.error("DeviceMotionEvent.requestPermission failed", error);
            return false;
        }
    }
    return true; // Not required/already supported on other devices
}

export function startListening(dotNetHelper, callbackMethodName) {
    stopListening();
    devicemotionListener = (event) => {
        dotNetHelper.invokeMethodAsync(callbackMethodName, {
            accelerationX: event.acceleration?.x || 0,
            accelerationY: event.acceleration?.y || 0,
            accelerationZ: event.acceleration?.z || 0,
            accelerationIncludingGravityX: event.accelerationIncludingGravity?.x || 0,
            accelerationIncludingGravityY: event.accelerationIncludingGravity?.y || 0,
            accelerationIncludingGravityZ: event.accelerationIncludingGravity?.z || 0,
            rotationRateAlpha: event.rotationRate?.alpha || 0,
            rotationRateBeta: event.rotationRate?.beta || 0,
            rotationRateGamma: event.rotationRate?.gamma || 0,
            interval: event.interval
        });
    };
    window.addEventListener('devicemotion', devicemotionListener);
}

export function stopListening() {
    if (devicemotionListener) {
        window.removeEventListener('devicemotion', devicemotionListener);
        devicemotionListener = null;
    }
}
