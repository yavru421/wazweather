const activeStreams = new Map();

export async function startCamera(videoElementId, frontCamera) {
    const videoElement = document.getElementById(videoElementId);
    if (!videoElement) {
        throw new Error(`Video element with id ${videoElementId} not found.`);
    }

    // Stop any existing stream on this video element first
    await stopCamera(videoElementId);

    const constraints = {
        video: {
            facingMode: frontCamera ? "user" : "environment"
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        
        // Wait for metadata to load then play
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resolve();
            };
        });
        
        await videoElement.play();
        activeStreams.set(videoElementId, stream);
        return true;
    } catch (err) {
        console.error("Error starting camera: ", err);
        throw err;
    }
}

export function capturePhoto(videoElementId) {
    const videoElement = document.getElementById(videoElementId);
    if (!videoElement) {
        throw new Error(`Video element with id ${videoElementId} not found.`);
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error("Could not get 2D context for canvas photo capture.");
    }

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg');
}

export async function stopCamera(videoElementId) {
    const stream = activeStreams.get(videoElementId);
    if (stream) {
        stream.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (e) {
                console.error("Error stopping track", e);
            }
        });
        activeStreams.delete(videoElementId);
    }

    const videoElement = document.getElementById(videoElementId);
    if (videoElement) {
        videoElement.srcObject = null;
    }
    return true;
}
