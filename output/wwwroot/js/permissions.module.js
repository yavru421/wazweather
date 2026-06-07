export async function queryPermission(name) {
    if (!navigator.permissions) {
        return 'unsupported';
    }
    try {
        // Some browsers don't support querying specific permissions like 'camera' or 'microphone'
        // and throw an error. Handle gracefully by returning 'prompt'
        const result = await navigator.permissions.query({ name: name });
        return result.state; // 'granted', 'denied', 'prompt'
    } catch (e) {
        console.warn(`Querying permission '${name}' is not supported directly.`, e);
        return 'prompt';
    }
}
