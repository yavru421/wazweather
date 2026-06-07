export function getItem(key) {
    try {
        return window.localStorage.getItem(key);
    } catch (e) {
        console.error("localStorage.getItem failed", e);
        return null;
    }
}

export function setItem(key, value) {
    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.error("localStorage.setItem failed", e);
        return false;
    }
}

export function removeItem(key) {
    try {
        window.localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error("localStorage.removeItem failed", e);
        return false;
    }
}

export function clear() {
    try {
        window.localStorage.clear();
        return true;
    } catch (e) {
        console.error("localStorage.clear failed", e);
        return false;
    }
}
