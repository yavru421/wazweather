let batteryListener = null;
let currentBattery = null;

export function isSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function';
}

export async function getStatus() {
    if (!isSupported()) return null;
    try {
        const battery = await navigator.getBattery();
        return {
            level: battery.level,
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime
        };
    } catch (e) {
        console.error("GetBattery failed", e);
        return null;
    }
}

export async function startListening(dotNetHelper, callbackMethodName) {
    if (!isSupported()) return;
    try {
        const battery = await navigator.getBattery();
        currentBattery = battery;
        batteryListener = () => {
            dotNetHelper.invokeMethodAsync(callbackMethodName, {
                level: battery.level,
                charging: battery.charging,
                chargingTime: battery.chargingTime,
                dischargingTime: battery.dischargingTime
            });
        };
        battery.addEventListener('chargingchange', batteryListener);
        battery.addEventListener('levelchange', batteryListener);
        battery.addEventListener('chargingtimechange', batteryListener);
        battery.addEventListener('dischargingtimechange', batteryListener);
    } catch (e) {
        console.error("StartListening for battery failed", e);
    }
}

export function stopListening() {
    if (currentBattery && batteryListener) {
        currentBattery.removeEventListener('chargingchange', batteryListener);
        currentBattery.removeEventListener('levelchange', batteryListener);
        currentBattery.removeEventListener('chargingtimechange', batteryListener);
        currentBattery.removeEventListener('dischargingtimechange', batteryListener);
        batteryListener = null;
        currentBattery = null;
    }
}
