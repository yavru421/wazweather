// ============================================================
// decibell.module.js
// DeciBell Guard — Audio monitoring, dBFS→SPL, event capture
// ============================================================

let audioCtx = null;
let analyser = null;
let micStream = null;
let animationFrameId = null;
let mediaRecorder = null;

// Blazor callback state
let dotNetHelper = null;
let callbackName = null;

// Rolling history for sparkline (last 60 samples ~6 seconds at 100ms)
const DB_HISTORY_LENGTH = 60;
const dbHistory = new Array(DB_HISTORY_LENGTH).fill(0);

// ── dBFS → approximate SPL conversion ──────────────────────
// getByteFrequencyData returns 0-255 per bin (0 = -100dBFS, 255 = 0dBFS).
// We compute RMS, then convert to a 0–100dBFS-ish SPL value.
function calcSpl(dataArray) {
    const n = dataArray.length;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
        const normalized = dataArray[i] / 255.0;
        sumSq += normalized * normalized;
    }
    const rms = Math.sqrt(sumSq / n);
    if (rms === 0) return 0;
    // Convert to dBFS then shift to approximate SPL (0 dBFS ≈ 90 dB SPL)
    const dbfs = 20 * Math.log10(rms);
    const spl = dbfs + 90;
    return Math.max(0, Math.round(spl * 10) / 10);
}

// ── Start monitoring ────────────────────────────────────────
export async function startMonitor(helper, callback) {
    if (audioCtx) stopMonitor();

    dotNetHelper = helper;
    callbackName = callback;

    try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        const source = audioCtx.createMediaStreamSource(micStream);

        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        let lastCallbackTime = 0;
        const CALLBACK_INTERVAL_MS = 100;

        const loop = (timestamp) => {
            if (!micStream) return;
            animationFrameId = requestAnimationFrame(loop);
            analyser.getByteFrequencyData(dataArray);

            if (timestamp - lastCallbackTime >= CALLBACK_INTERVAL_MS) {
                lastCallbackTime = timestamp;
                const spl = calcSpl(dataArray);

                // Update rolling history
                dbHistory.shift();
                dbHistory.push(spl);

                if (dotNetHelper && callbackName) {
                    try {
                        dotNetHelper.invokeMethodAsync(callbackName, spl, [...dbHistory]);
                    } catch (e) {
                        // ignore if Blazor component disposed
                    }
                }
            }
        };

        animationFrameId = requestAnimationFrame(loop);
        return true;

    } catch (e) {
        console.error('[DeciBell] startMonitor failed:', e);
        return false;
    }
}

// ── Stop monitoring ─────────────────────────────────────────
export function stopMonitor() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
    }
    if (audioCtx) {
        try { audioCtx.close(); } catch (_) { }
        audioCtx = null;
    }
    analyser = null;
    dotNetHelper = null;
    callbackName = null;

    // Reset history
    for (let i = 0; i < DB_HISTORY_LENGTH; i++) dbHistory[i] = 0;
}

// ── Capture an audio clip from the live mic stream ──────────
// Returns a promise that resolves to a base64-encoded WebM/Ogg string.
export function captureClip(durationMs) {
    return new Promise((resolve, reject) => {
        if (!micStream) {
            reject(new Error('No active mic stream'));
            return;
        }

        // Choose best supported format
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : 'audio/ogg;codecs=opus';

        const chunks = [];

        try {
            mediaRecorder = new MediaRecorder(micStream, { mimeType });
        } catch (e) {
            // Fallback: no mimeType specified
            mediaRecorder = new MediaRecorder(micStream);
        }

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
            const reader = new FileReader();
            reader.onloadend = () => {
                // reader.result is "data:audio/webm;base64,AAAA..."
                resolve(reader.result);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
            mediaRecorder = null;
        };

        mediaRecorder.onerror = (e) => {
            reject(e.error || new Error('MediaRecorder error'));
            mediaRecorder = null;
        };

        mediaRecorder.start();

        // Auto-stop after durationMs
        setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        }, durationMs);
    });
}

// ── Cancel any in-progress recording ───────────────────────
export function cancelCapture() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder = null;
    }
}

// ── Draw the sparkline history onto a canvas ────────────────
export function drawSparkline(canvasId, history, dangerDb, cautionDb) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Danger zone fill
    const dangerY = H - (dangerDb / 100) * H;
    ctx.fillStyle = 'rgba(255,59,48,0.08)';
    ctx.fillRect(0, 0, W, dangerY);

    // Caution zone fill
    const cautionY = H - (cautionDb / 100) * H;
    ctx.fillStyle = 'rgba(255,196,0,0.06)';
    ctx.fillRect(0, dangerY, W, cautionY - dangerY);

    if (!history || history.length < 2) return;

    const stepX = W / (history.length - 1);
    const maxDb = 100;

    // Gradient fill under line
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(0,210,211,0.35)');
    grad.addColorStop(1, 'rgba(0,210,211,0.00)');

    ctx.beginPath();
    history.forEach((v, i) => {
        const x = i * stepX;
        const y = H - (Math.min(v, maxDb) / maxDb) * H;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    history.forEach((v, i) => {
        const x = i * stepX;
        const y = H - (Math.min(v, maxDb) / maxDb) * H;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(0,210,211,0.9)';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Threshold lines
    const drawThreshold = (dbVal, color, label) => {
        const y = H - (dbVal / maxDb) * H;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.font = '10px system-ui';
        ctx.fillText(label, 4, y - 3);
    };

    drawThreshold(dangerDb, 'rgba(255,59,48,0.7)', `${dangerDb} dB`);
    drawThreshold(cautionDb, 'rgba(255,196,0,0.7)', `${cautionDb} dB`);
}

// ── Download the exposure log as a JSON file ────────────────
export function downloadJson(filename, jsonString) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
