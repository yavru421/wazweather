export function isSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function vibrate(durationMs) {
    if (isSupported()) {
        navigator.vibrate(durationMs);
    }
}

export function vibratePattern(pattern) {
    if (isSupported()) {
        navigator.vibrate(pattern);
    }
}
