export async function copyText(text) {
    if (!navigator.clipboard) return false;
    try { 
        await navigator.clipboard.writeText(text); 
        return true; 
    }
    catch { 
        return false; 
    }
}

export async function readText() {
    if (!navigator.clipboard || !navigator.clipboard.readText) return "";
    try { 
        return await navigator.clipboard.readText(); 
    }
    catch { 
        return ""; 
    }
}
