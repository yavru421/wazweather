let themeListener = null;
let currentHelper = null;
let currentCallback = "";

export function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function watchSystemTheme(dotNetHelper, callbackMethodName) {
    currentHelper = dotNetHelper;
    currentCallback = callbackMethodName;
    
    if (themeListener) {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', themeListener);
    }
    
    themeListener = (e) => {
        const theme = e.matches ? 'dark' : 'light';
        currentHelper.invokeMethodAsync(currentCallback, theme);
    };
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeListener);
}

export function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        root.setAttribute('data-bs-theme', 'dark'); // Bootstrap 5 support
    } else if (theme === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
        root.setAttribute('data-bs-theme', 'light');
    } else {
        // System
        const system = getSystemTheme();
        root.setAttribute('data-bs-theme', system);
        root.classList.add(system);
        root.classList.remove(system === 'dark' ? 'light' : 'dark');
    }
}
