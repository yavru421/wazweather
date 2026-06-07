export function isSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export async function share(title, text, url) {
    if (!isSupported()) return false;
    try {
        await navigator.share({ title, text, url });
        return true;
    } catch (e) {
        console.error("Share failed", e);
        return false;
    }
}
