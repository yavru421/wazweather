// ============================================================
// tuner.module.js
// Guitar & Instrument Tuner — Pitch Detection, Tone Generator, Metronome
// ============================================================

// ── State ──────────────────────────────────────────────────
let audioCtx = null;
let analyser = null;
let micStream = null;
let animationFrameId = null;
let dotNetHelper = null;
let callbackName = null;

// Tone generator state
let oscillator = null;
let gainNode = null;

// Metronome state
let metronomeIntervalId = null;
let metronomeAudioCtx = null;

const BUFFER_SIZE = 4096;

// ── isSupported ─────────────────────────────────────────────
export function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
        (window.AudioContext || window.webkitAudioContext));
}

// ── startTuner ──────────────────────────────────────────────
export async function startTuner(helper, callback) {
    if (audioCtx) await stopTuner();

    dotNetHelper = helper;
    callbackName = callback;

    try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass({ sampleRate: 44100 });

        const source = audioCtx.createMediaStreamSource(micStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = BUFFER_SIZE * 2;
        analyser.smoothingTimeConstant = 0.0;
        source.connect(analyser);

        const buffer = new Float32Array(BUFFER_SIZE);
        let lastCallbackTime = 0;
        const CALLBACK_MS = 80;

        const loop = (timestamp) => {
            if (!micStream) return;
            animationFrameId = requestAnimationFrame(loop);
            analyser.getFloatTimeDomainData(buffer);

            if (timestamp - lastCallbackTime >= CALLBACK_MS) {
                lastCallbackTime = timestamp;

                const rms = computeRMS(buffer);
                if (rms < 0.008) {
                    // Too quiet — send silence
                    sendCallback({ frequency: -1, note: '--', cents: 0, octave: 0, rms: rms });
                    return;
                }

                const freq = autoCorrelate(buffer, audioCtx.sampleRate);
                if (freq > 0) {
                    const noteData = frequencyToNote(freq);
                    sendCallback({ frequency: freq, ...noteData, rms: rms });
                } else {
                    sendCallback({ frequency: -1, note: '--', cents: 0, octave: 0, rms: rms });
                }
            }
        };

        animationFrameId = requestAnimationFrame(loop);
        return true;
    } catch (e) {
        console.error('[Tuner] startTuner failed:', e);
        return false;
    }
}

// ── stopTuner ───────────────────────────────────────────────
export function stopTuner() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
    }
    if (audioCtx) {
        try { audioCtx.close(); } catch (_) {}
        audioCtx = null;
    }
    analyser = null;
    dotNetHelper = null;
    callbackName = null;
}

function sendCallback(data) {
    if (dotNetHelper && callbackName) {
        try { dotNetHelper.invokeMethodAsync(callbackName, data); } catch (_) {}
    }
}

// ── computeRMS ──────────────────────────────────────────────
function computeRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    return Math.sqrt(sum / buffer.length);
}

// ── Autocorrelation Pitch Detection ─────────────────────────
function autoCorrelate(buf, sampleRate) {
    const SIZE = buf.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);

    let rms = computeRMS(buf);
    if (rms < 0.008) return -1;

    // Compute autocorrelation
    const corr = new Float32Array(MAX_SAMPLES);
    for (let offset = 0; offset < MAX_SAMPLES; offset++) {
        let sum = 0;
        for (let i = 0; i < MAX_SAMPLES; i++) {
            sum += buf[i] * buf[i + offset];
        }
        corr[offset] = sum;
    }

    // Find first dip, then find peak after dip
    let d = 0;
    while (d < MAX_SAMPLES && corr[d] > corr[d + 1]) d++;

    let maxVal = -Infinity;
    let maxIdx = -1;
    for (let i = d; i < MAX_SAMPLES; i++) {
        if (corr[i] > maxVal) {
            maxVal = corr[i];
            maxIdx = i;
        }
    }
    if (maxIdx === -1) return -1;

    // Parabolic interpolation for sub-sample accuracy
    let x1 = corr[maxIdx - 1] ?? corr[maxIdx];
    let x2 = corr[maxIdx];
    let x3 = corr[maxIdx + 1] ?? corr[maxIdx];
    let a = (x1 + x3 - 2 * x2) / 2;
    let b = (x3 - x1) / 2;
    let shift = a !== 0 ? -b / (2 * a) : 0;

    const period = maxIdx + shift;
    if (period <= 0) return -1;

    const freq = sampleRate / period;

    // Sanity check: only return human-audible range (20Hz–5000Hz)
    if (freq < 20 || freq > 5000) return -1;

    return freq;
}

// ── frequencyToNote ─────────────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function frequencyToNote(freq, a4 = 440) {
    const semitones = 12 * Math.log2(freq / a4);
    const midiNote = Math.round(semitones) + 69;
    const cents = Math.round((semitones - (midiNote - 69)) * 100);
    const octave = Math.floor(midiNote / 12) - 1;
    const noteIndex = ((midiNote % 12) + 12) % 12;
    return {
        note: NOTE_NAMES[noteIndex],
        octave,
        cents,
        targetFrequency: a4 * Math.pow(2, (midiNote - 69) / 12)
    };
}

// ── Tone Generator ───────────────────────────────────────────
export function playTone(freq, waveform = 'sine', volumeDb = -12) {
    stopTone();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!metronomeAudioCtx || metronomeAudioCtx.state === 'closed') {
        metronomeAudioCtx = new AudioContextClass();
    }
    gainNode = metronomeAudioCtx.createGain();
    gainNode.gain.setValueAtTime(dbToLinear(volumeDb), metronomeAudioCtx.currentTime);
    gainNode.connect(metronomeAudioCtx.destination);

    oscillator = metronomeAudioCtx.createOscillator();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(freq, metronomeAudioCtx.currentTime);
    oscillator.connect(gainNode);
    oscillator.start();
}

export function stopTone() {
    if (oscillator) {
        try { oscillator.stop(); oscillator.disconnect(); } catch (_) {}
        oscillator = null;
    }
    if (gainNode) {
        try { gainNode.disconnect(); } catch (_) {}
        gainNode = null;
    }
}

function dbToLinear(db) {
    return Math.pow(10, db / 20);
}

// ── Metronome ────────────────────────────────────────────────
let _metronomeBeat = 0;
let _metronomeBeatsPerMeasure = 4;
let _metronomeHelper = null;
let _metronomeBeatCallback = null;

export function startMetronome(bpm, beatsPerMeasure, helper, beatCallback) {
    stopMetronome();
    _metronomeBeats = 0;
    _metronomeBeatsPerMeasure = beatsPerMeasure;
    _metronomeHelper = helper;
    _metronomeBeatCallback = beatCallback;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!metronomeAudioCtx || metronomeAudioCtx.state === 'closed') {
        metronomeAudioCtx = new AudioContextClass();
    }

    const intervalMs = (60 / bpm) * 1000;

    const tick = () => {
        _metronomeBeat = (_metronomeBeat || 0);
        const isAccent = _metronomeBeat % _metronomeBeatsPerMeasure === 0;
        playClick(isAccent);
        _metronomeBeat = (_metronomeBeat + 1) % _metronomeBeatsPerMeasure;

        if (_metronomeHelper && _metronomeBeatCallback) {
            try {
                _metronomeHelper.invokeMethodAsync(_metronomeBeatCallback, _metronomeBeat, isAccent);
            } catch (_) {}
        }
    };

    tick(); // immediate first tick
    metronomeIntervalId = setInterval(tick, intervalMs);
}

export function stopMetronome() {
    if (metronomeIntervalId) {
        clearInterval(metronomeIntervalId);
        metronomeIntervalId = null;
    }
    _metronomeBeat = 0;
    _metronomeHelper = null;
    _metronomeBeatCallback = null;
}

function playClick(accent) {
    if (!metronomeAudioCtx || metronomeAudioCtx.state === 'closed') {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        metronomeAudioCtx = new AudioContextClass();
    }
    const now = metronomeAudioCtx.currentTime;
    const osc = metronomeAudioCtx.createOscillator();
    const g = metronomeAudioCtx.createGain();
    osc.connect(g);
    g.connect(metronomeAudioCtx.destination);

    osc.frequency.setValueAtTime(accent ? 1200 : 880, now);
    g.gain.setValueAtTime(accent ? 0.9 : 0.5, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.start(now);
    osc.stop(now + 0.06);
}
