export async function requestDevice() {
    if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth is not supported.");
    }
    try {
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true
        });
        return device.name || `Device ID: ${device.id}`;
    } catch (e) {
        console.error("Bluetooth requestDevice failed", e);
        return "";
    }
}

export async function scanNfc(dotNetHelper, callbackMethodName) {
    if (!('NDEFReader' in window)) {
        console.error("Web NFC is not supported.");
        return false;
    }
    try {
        const ndef = new window.NDEFReader();
        await ndef.scan();
        ndef.addEventListener("reading", ({ message, serialNumber }) => {
            let text = "";
            for (const record of message.records) {
                if (record.recordType === "text") {
                    const textDecoder = new TextDecoder(record.data);
                    text += textDecoder.decode(record.data);
                }
            }
            dotNetHelper.invokeMethodAsync(callbackMethodName, {
                serialNumber: serialNumber,
                text: text
            });
        });
        return true;
    } catch (e) {
        console.error("NFC Scan failed", e);
        return false;
    }
}
