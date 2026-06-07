let deferredPrompt = null;
let installHelper = null;
let installCallback = "";

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Notify Blazor that install is available
    if (installHelper && installCallback) {
        try {
            installHelper.invokeMethodAsync(installCallback, true);
        } catch (err) {
            console.error("Failed to notify Blazor of beforeinstallprompt", err);
        }
    }
});

window.addEventListener('appinstalled', (e) => {
    // Clear prompt
    deferredPrompt = null;
    console.log('PWA was installed');
    if (installHelper && installCallback) {
        try {
            installHelper.invokeMethodAsync(installCallback, false);
        } catch (err) {
            console.error("Failed to notify Blazor of appinstalled", err);
        }
    }
});

export function isAvailable() {
    return deferredPrompt !== null;
}

export async function prompt() {
    if (!deferredPrompt) {
        return false;
    }
    try {
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        // We've used the prompt, and can't use it again; clear it
        deferredPrompt = null;
        return outcome === 'accepted';
    } catch (e) {
        console.error("PWA prompt failed", e);
        return false;
    }
}

export function onInstall(dotNetHelper, callbackName) {
    installHelper = dotNetHelper;
    installCallback = callbackName;
    
    // If the event was already fired before Blazor registered, notify it immediately
    if (deferredPrompt) {
        try {
            installHelper.invokeMethodAsync(installCallback, true);
        } catch (err) {
            console.error("Failed to notify Blazor in onInstall registration", err);
        }
    }
}

// Returns true when running as an installed PWA (standalone mode)
export function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
}

// Returns true when the user is on iOS Safari (where beforeinstallprompt is unsupported)
export function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}
