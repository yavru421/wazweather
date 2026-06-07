let audioCtx = null;
let analyser = null;
let micStream = null;
let animationFrameId = null;

export function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));
}

export async function startMic(canvasId, dotNetHelper, callbackMethodName) {
    if (!isSupported()) return false;
    try {
        stopMic();
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const canvas = document.getElementById(canvasId);
        const canvasCtx = canvas ? canvas.getContext('2d') : null;
        
        const draw = () => {
            if (!micStream) return;
            animationFrameId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            
            // Send volume callback to Blazor
            if (dotNetHelper && callbackMethodName) {
                try {
                    dotNetHelper.invokeMethodAsync(callbackMethodName, average);
                } catch (e) {
                    // Ignore callback error if disposed
                }
            }
            
            // Draw on canvas if available
            if (canvasCtx && canvas) {
                canvasCtx.fillStyle = 'rgb(33, 37, 41)';
                canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
                
                const barWidth = (canvas.width / bufferLength) * 2.5;
                let barHeight;
                let x = 0;
                
                for (let i = 0; i < bufferLength; i++) {
                    barHeight = dataArray[i] / 2;
                    canvasCtx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
                    canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                    x += barWidth + 1;
                }
            }
        };
        
        draw();
        return true;
    } catch (e) {
        console.error("StartMic failed", e);
        return false;
    }
}

export function stopMic() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
    analyser = null;
}
