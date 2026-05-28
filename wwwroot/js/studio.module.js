// ============================================================
// studio.module.js — Live-Tap & Slide-to-Play Audio Engine
// ============================================================

let audioCtx = null;
let schedulerId = null;
let playheadCallback = null;
let gridCallback = null;
let liveTapCallback = null;
let ribbonCallback = null;
let dotNetHelper = null;

const NOTE_INDEX = {
    "C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11
};

// Sequencer state
let isPlaying = false;
let currentStep = 0;
let nextNoteTime = 0.0; 
let playStartTime = 0.0;
const scheduleAheadTime = 0.15; // Schedule ahead (seconds)
const lookahead = 25.0; // Call frequency (ms)

// Reference to current C# state
let audioState = {
    bpm: 96,
    key: "C",
    scale: "Minor",
    grid: [
        new Array(16).fill(false),
        new Array(16).fill(false),
        new Array(16).fill(false),
        new Array(16).fill(false),
        new Array(16).fill(false)
    ],
    melody: new Array(16).fill(261.63),
    bassNotes: new Array(16).fill(65.41), // C2 default
    chords: ["none", "none", "none", "none", "none", "none", "none", "none"],
    activeChordIndex: 0,
    volume: [0.85, 0.75, 0.8, 0.8, 0.75],
    pitch: [0.5, 0.5, 0.5, 0.5, 0.5],
    decay: [0.5, 0.5, 0.5, 0.5, 0.5],
    tonePreset: [0.0, 0.0, 0.0, 0.0, 0.0]
};

// Portamento state for West Coast Whistle
let lastLeadFreq = 0;

// ── initialization ──────────────────────────────────────────
export function initStudio(helper, callback, onGridUpdate) {
    dotNetHelper = helper;
    playheadCallback = callback;
    gridCallback = onGridUpdate;
}

// ── initRibbon ──────────────────────────────────────────────
export function initRibbon(ribbon, helper, callback) {
    if (!ribbon) return;
    ribbonCallback = callback;

    function handleRibbonDrag(clientX) {
        const rect = ribbon.getBoundingClientRect();
        let x = (clientX - rect.left) / rect.width; // 0.0 to 1.0
        x = Math.max(0, Math.min(1, x));

        // Notify Blazor of the ribbon drag percentage
        if (dotNetHelper && ribbonCallback) {
            try {
                dotNetHelper.invokeMethodAsync(ribbonCallback, x);
            } catch (_) {}
        }
    }

    let isDragging = false;

    ribbon.addEventListener('mousedown', (e) => {
        isDragging = true;
        handleRibbonDrag(e.clientX);
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        handleRibbonDrag(e.clientX);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Touch Support
    ribbon.addEventListener('touchstart', (e) => {
        isDragging = true;
        if (e.touches[0]) {
            handleRibbonDrag(e.touches[0].clientX);
        }
    });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        if (e.touches[0]) {
            handleRibbonDrag(e.touches[0].clientX);
            e.preventDefault();
        }
    }, { passive: false });

    window.addEventListener('touchend', () => {
        isDragging = false;
    });
}

// ── startPlay ───────────────────────────────────────────────
export function startPlay(initialState) {
    if (isPlaying) return;

    initAudioContext();
    updateState(initialState);
    
    isPlaying = true;
    currentStep = 0;
    playStartTime = audioCtx.currentTime;
    nextNoteTime = audioCtx.currentTime + 0.05;

    schedulerId = setInterval(schedulerLoop, lookahead);
}

// ── stopPlay ────────────────────────────────────────────────
export function stopPlay() {
    isPlaying = false;
    if (schedulerId) {
        clearInterval(schedulerId);
        schedulerId = null;
    }
}

// ── updateState ─────────────────────────────────────────────
export function updateState(newState) {
    if (!newState) return;
    
    audioState.bpm = newState.bpm;
    audioState.key = newState.key;
    audioState.scale = newState.scale;
    audioState.grid = newState.grid;
    audioState.melody = newState.melody;
    audioState.bassNotes = newState.bassNotes;
    audioState.chords = newState.chords;
    audioState.activeChordIndex = newState.activeChordIndex;
    
    // Sliders
    audioState.volume = newState.volume;
    audioState.pitch = newState.pitch;
    audioState.decay = newState.decay;
    audioState.tonePreset = newState.tonePreset;

    initAudioContext();
}

function initAudioContext() {
    if (audioCtx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
}

// ── schedulerLoop ───────────────────────────────────────────
function schedulerLoop() {
    while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
        scheduleNote(currentStep, nextNoteTime);
        advanceNote();
    }
}

// ── advanceNote ─────────────────────────────────────────────
function advanceNote() {
    const secondsPerBeat = 60.0 / audioState.bpm;
    const secondsPerStep = secondsPerBeat / 4.0; // 16th note steps
    nextNoteTime += secondsPerStep;

    // Send playhead index to Blazor
    if (dotNetHelper && playheadCallback) {
        try {
            dotNetHelper.invokeMethodAsync(playheadCallback, currentStep);
        } catch (_) {}
    }

    currentStep = (currentStep + 1) % 16;
}

// ── scheduleNote ────────────────────────────────────────────
function scheduleNote(step, time) {
    // 0: Kick
    if (audioState.grid[0][step]) playKickSynth(time);
    
    // 1: Snare
    if (audioState.grid[1][step]) playSnareSynth(time);

    // 2: Hi-Hat
    if (audioState.grid[2][step]) playHiHatSynth(time);

    // 3: Bass
    if (audioState.grid[3][step]) playBassSynth(audioState.bassNotes[step], time);

    // 4: Lead Synth
    if (audioState.grid[4][step]) playMelodySynth(audioState.melody[step], time);

    // Chord backing on steps 0 and 8 in the background
    if (step === 0 || step === 8) {
        playActiveChordBacking(time);
    }
}

// ── triggerLivePad (Live Tap Trigger) ───────────────────────
export function triggerLivePad(trackIndex) {
    initAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const time = audioCtx.currentTime;

    // Trigger local sound instantly for zero latency
    if (trackIndex === 0) playKickSynth(time);
    else if (trackIndex === 1) playSnareSynth(time);
    else if (trackIndex === 2) playHiHatSynth(time);
    else if (trackIndex === 3) playBassSynth(audioState.bassNotes[currentStep] || 65.41, time);
    else if (trackIndex === 4) playMelodySynth(audioState.melody[currentStep] || 261.63, time);

    // Calculate nearest step index for real-time quantization
    if (isPlaying) {
        const elapsed = time - playStartTime;
        const secondsPerBeat = 60.0 / audioState.bpm;
        const secondsPerStep = secondsPerBeat / 4.0;
        
        // Find nearest integer step index
        const floatStep = elapsed / secondsPerStep;
        const nearestStep = Math.round(floatStep) % 16;

        // Callback Blazor to record step
        if (dotNetHelper && gridCallback) {
            try {
                // Trigger tap update on grid
                dotNetHelper.invokeMethodAsync("OnLiveTapRecorded", trackIndex, nearestStep);
            } catch (_) {}
        }
    }
}

// ── playFrequency (Play Note Instantly) ──────────────────────
export function playFrequency(trackIndex, frequency) {
    initAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const time = audioCtx.currentTime;
    if (trackIndex === 3) {
        playBassSynth(frequency, time);
    } else if (trackIndex === 4) {
        playMelodySynth(frequency, time);
    }
}

// ── Synthesizers ────────────────────────────────────────────

// 1. Kick Drum
function playKickSynth(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const pitchVal = audioState.pitch[0]; // 0.0 to 1.0
    const decayVal = audioState.decay[0]; // 0.0 to 1.0
    const toneVal = audioState.tonePreset[0]; // 0.0 to 1.0

    // Volume
    const trackVolume = audioState.volume[0];
    gain.gain.setValueAtTime(0.001, time);

    // Decay ranges from 0.06s to 0.7s
    const decayTime = 0.06 + (decayVal * 0.64);

    if (toneVal < 0.35) {
        // Omnichord / Vintage (Soft clicky analog sweep)
        osc.frequency.setValueAtTime(110 + (pitchVal * 80), time);
        osc.frequency.exponentialRampToValueAtTime(38, time + (decayTime * 0.8));
        
        gain.gain.linearRampToValueAtTime(trackVolume * 0.8, time + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);
    } 
    else if (toneVal >= 0.35 && toneVal < 0.7) {
        // West Coast 2000 (Punchy Dre-style acoustic click sweep)
        osc.frequency.setValueAtTime(155 + (pitchVal * 100), time);
        osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);
        
        gain.gain.linearRampToValueAtTime(trackVolume, time + 0.001);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);
    } 
    else {
        // 808 Sub Boom (Extremely deep pitch sweep)
        osc.frequency.setValueAtTime(100 + (pitchVal * 50), time);
        osc.frequency.exponentialRampToValueAtTime(32, time + 0.12);
        
        gain.gain.linearRampToValueAtTime(trackVolume * 0.9, time + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, time + Math.max(0.2, decayTime * 1.5)); // extend boom
    }

    osc.start(time);
    osc.stop(time + decayTime + 0.05);
}

// 2. Snare / Rim / Clap
function playSnareSynth(time) {
    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = createNoiseBuffer();

    const noiseFilter = audioCtx.createBiquadFilter();
    const noiseGain = audioCtx.createGain();

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    const pitchVal = audioState.pitch[1];
    const decayVal = audioState.decay[1];
    const toneVal = audioState.tonePreset[1];
    const trackVolume = audioState.volume[1];

    const decayTime = 0.04 + (decayVal * 0.35);

    // Osc body
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);

    if (toneVal < 0.35) {
        // Vintage Rim (Omnichord rimshot - high pitch, short noise envelope)
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1600 + (pitchVal * 1200), time);
        noiseFilter.Q.setValueAtTime(2.0, time);

        noiseGain.gain.setValueAtTime(trackVolume * 0.3, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + decayTime * 0.6);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(280 + (pitchVal * 200), time);
        oscGain.gain.setValueAtTime(trackVolume * 0.6, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    } 
    else if (toneVal >= 0.35 && toneVal < 0.7) {
        // West Coast Snappy Snare (Dr. Dre rim/snare blend - bright highpass)
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(1000 + (pitchVal * 800), time);

        noiseGain.gain.setValueAtTime(trackVolume * 0.45, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180 + (pitchVal * 90), time);
        osc.frequency.exponentialRampToValueAtTime(130, time + 0.06);
        oscGain.gain.setValueAtTime(trackVolume * 0.5, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    } 
    else {
        // 808 Snare (Dirty analog noise burst)
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1100 + (pitchVal * 600), time);
        noiseFilter.Q.setValueAtTime(1.0, time);

        noiseGain.gain.setValueAtTime(trackVolume * 0.6, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + decayTime * 1.2);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160 + (pitchVal * 60), time);
        oscGain.gain.setValueAtTime(trackVolume * 0.3, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    }

    noiseNode.start(time);
    noiseNode.stop(time + decayTime + 0.05);

    osc.start(time);
    osc.stop(time + decayTime + 0.05);
}

// 3. Hi-Hat
function playHiHatSynth(time) {
    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = createNoiseBuffer();

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';

    const gain = audioCtx.createGain();
    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    const pitchVal = audioState.pitch[2];
    const decayVal = audioState.decay[2];
    const toneVal = audioState.tonePreset[2];
    const trackVolume = audioState.volume[2];

    const decayTime = 0.02 + (decayVal * 0.18);
    const cutoff = 5000 + (pitchVal * 7000); // 5kHz to 12kHz
    filter.frequency.setValueAtTime(cutoff, time);

    if (toneVal < 0.35) {
        // Dusty Analog (Omnichord ticking - short and slightly filtered)
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(cutoff * 0.8, time);
        filter.Q.setValueAtTime(3.0, time);
        
        gain.gain.setValueAtTime(trackVolume * 0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime * 0.7);
    } 
    else if (toneVal >= 0.35 && toneVal < 0.7) {
        // West Coast Crisp (Clean bright acoustic sizzle)
        gain.gain.setValueAtTime(trackVolume * 0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);
    } 
    else {
        // Closed Trap (Short high-pitched click)
        gain.gain.setValueAtTime(trackVolume * 0.22, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
    }

    noiseNode.start(time);
    noiseNode.stop(time + decayTime + 0.05);
}

// 4. Bass Line
function playBassSynth(frequency, time) {
    if (!frequency || frequency <= 0) return;

    const osc = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    const pitchVal = audioState.pitch[3];
    const decayVal = audioState.decay[3];
    const toneVal = audioState.tonePreset[3];
    const trackVolume = audioState.volume[3];

    const decayTime = 0.15 + (decayVal * 1.1);
    
    // Scale base frequency slightly with pitch slider
    const finalFreq = frequency * Math.pow(2, (pitchVal - 0.5));

    osc.frequency.setValueAtTime(finalFreq, time);

    if (toneVal < 0.35) {
        // Deep Sub-Bass (Clean pure sine)
        osc.type = 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(120, time);
        
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(trackVolume * 0.85, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);
    } 
    else if (toneVal >= 0.35 && toneVal < 0.7) {
        // Resonant Dub Slide (Triangle wave + sweep LFO filter slide - Clint Eastwood bass)
        osc.type = 'triangle';
        filter.type = 'lowpass';
        
        // Sweep filter from low to mid
        filter.frequency.setValueAtTime(100, time);
        filter.frequency.exponentialRampToValueAtTime(320, time + 0.18);
        filter.frequency.exponentialRampToValueAtTime(140, time + decayTime);
        filter.Q.setValueAtTime(4.0, time);

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(trackVolume * 0.7, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);
    } 
    else {
        // Acid Sawtooth (Squelchy filtered saw)
        osc.type = 'sawtooth';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, time);
        filter.frequency.exponentialRampToValueAtTime(200, time + 0.12);
        filter.Q.setValueAtTime(6.0, time);

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(trackVolume * 0.35, time + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);
    }

    osc.start(time);
    osc.stop(time + decayTime + 0.05);
}

// 5. Lead Synth
function playMelodySynth(frequency, time) {
    if (!frequency || frequency <= 0) return;

    const osc = audioCtx.createOscillator();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    const pitchVal = audioState.pitch[4];
    const decayVal = audioState.decay[4];
    const toneVal = audioState.tonePreset[4];
    const trackVolume = audioState.volume[4];

    const decayTime = 0.1 + (decayVal * 0.9);
    
    // Scale base frequency slightly with pitch slider
    const finalFreq = frequency * Math.pow(2, (pitchVal - 0.5));

    if (toneVal < 0.35) {
        // West Coast Whistle (High pitched sine beep with slide/portamento - Dre style)
        osc.type = 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, time);

        // Apply glide from last note if active
        if (lastLeadFreq > 0) {
            osc.frequency.setValueAtTime(lastLeadFreq, time);
            osc.frequency.exponentialRampToValueAtTime(finalFreq, time + 0.08); // 80ms portamento glide
        } else {
            osc.frequency.setValueAtTime(finalFreq, time);
        }
        lastLeadFreq = finalFreq;

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(trackVolume * 0.45, time + 0.015); // slow soft attack
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);
    } 
    else if (toneVal >= 0.35 && toneVal < 0.7) {
        // Melodica / Reed (Dual detuned triangles with bandpass sweep - Clint Eastwood lead)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(finalFreq, time);

        const oscSub = audioCtx.createOscillator();
        const oscSubGain = audioCtx.createGain();
        oscSub.type = 'triangle';
        oscSub.frequency.setValueAtTime(finalFreq * 0.994, time); // slightly detuned
        
        oscSub.connect(oscSubGain);
        oscSubGain.connect(filter);
        oscSubGain.gain.setValueAtTime(0.7, time);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, time);
        filter.frequency.exponentialRampToValueAtTime(1400, time + 0.1);
        filter.frequency.exponentialRampToValueAtTime(900, time + decayTime);
        filter.Q.setValueAtTime(2.0, time);

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(trackVolume * 0.45, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

        oscSub.start(time);
        oscSub.stop(time + decayTime + 0.05);
        lastLeadFreq = finalFreq;
    } 
    else {
        // Plucked Flute (Sine wave with quick lowpass sweep)
        osc.type = 'sine';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, time);
        filter.frequency.exponentialRampToValueAtTime(300, time + 0.06);

        osc.frequency.setValueAtTime(finalFreq, time);
        lastLeadFreq = finalFreq;

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(trackVolume * 0.6, time + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime * 0.7);
    }

    osc.start(time);
    osc.stop(time + decayTime + 0.05);
}

// 6. Polyphonic Chord Synthesizer
export function playActiveChordBacking(time) {
    initAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const chordString = audioState.chords[audioState.activeChordIndex];
    const freqs = getChordFrequencies(chordString);
    if (freqs.length === 0) return;

    // Use Chords presets based on active sequencer settings
    // If style is synthwave, play synth pads. If lofi, play warm Rhodes organ.
    const chordTone = audioState.tonePreset[2]; // bind chord sound to Track 2 (hats/perc) tone preset fader

    freqs.forEach(freq => {
        const osc = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.frequency.setValueAtTime(freq, time);

        if (chordTone < 0.35) {
            // Warm Organ Pad (Gorillaz Omnichord style)
            osc.type = 'triangle';
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(500, time);
            filter.frequency.exponentialRampToValueAtTime(220, time + 1.1);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.12, time + 0.08); // slow swell
            gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
        } 
        else if (chordTone >= 0.35 && chordTone < 0.7) {
            // Staccato Pluck (Dr. Dre guitar plucks)
            osc.type = 'triangle';
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2000, time);
            filter.frequency.exponentialRampToValueAtTime(800, time + 0.12);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.18, time + 0.002); // instant pluck
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14); // very short decay
        } 
        else {
            // Rhodes Electric Piano
            osc.type = 'sine';
            const oscSub = audioCtx.createOscillator();
            const subGain = audioCtx.createGain();
            oscSub.type = 'triangle';
            oscSub.frequency.setValueAtTime(freq * 2.0, time); // harmonic overtone
            oscSub.connect(subGain);
            subGain.connect(filter);
            subGain.gain.setValueAtTime(0.35, time);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000, time);

            gain.gain.setValueAtTime(0.001, time);
            gain.gain.linearRampToValueAtTime(0.14, time + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.9);

            oscSub.start(time);
            oscSub.stop(time + 0.95);
        }

        osc.start(time);
        osc.stop(time + 1.25);
    });
}

// ── Chord & Pitch Frequency Helpers ──────────────────────────

function getNoteFrequency(noteName, octave) {
    const semitones = NOTE_INDEX[noteName] + (octave + 1) * 12;
    return 440 * Math.pow(2, (semitones - 69) / 12);
}

function getChordFrequencies(chordName) {
    if (!chordName || chordName === "none" || chordName === "--") return [];
    
    let match = chordName.match(/^([A-G]#?|D[b-g]?|E[b-g]?|G[b-g]?|A[b-g]?|B[b-g]?)/);
    if (!match) return [];
    let root = match[1];
    let rest = chordName.slice(root.length);
    
    let octaveMatch = rest.match(/^(\d)/);
    let octave = 3; 
    if (octaveMatch) {
        octave = parseInt(octaveMatch[1]);
        rest = rest.slice(octaveMatch[1].length);
    }
    
    const rootIndex = NOTE_INDEX[root] + (octave + 1) * 12;
    
    let intervals = [0, 4, 7]; 
    if (rest.startsWith("min7") || rest.startsWith("m7")) {
        intervals = [0, 3, 7, 10]; 
    } else if (rest.startsWith("maj7") || rest.startsWith("M7")) {
        intervals = [0, 4, 7, 11]; 
    } else if (rest.startsWith("7")) {
        intervals = [0, 4, 7, 10]; 
    } else if (rest.startsWith("min9") || rest.startsWith("m9")) {
        intervals = [0, 3, 7, 10, 14]; 
    } else if (rest.startsWith("maj9") || rest.startsWith("M9")) {
        intervals = [0, 4, 7, 11, 14]; 
    } else if (rest.startsWith("min") || rest.startsWith("m")) {
        intervals = [0, 3, 7]; 
    } else if (rest.startsWith("sus4")) {
        intervals = [0, 5, 7];
    } else if (rest.startsWith("sus2")) {
        intervals = [0, 2, 7];
    } else if (rest.startsWith("dim")) {
        intervals = [0, 3, 6];
    }
    
    return intervals.map(offset => {
        const targetSemitones = rootIndex + offset;
        return 440 * Math.pow(2, (targetSemitones - 69) / 12);
    });
}

let cachedNoiseBuffer = null;
function createNoiseBuffer() {
    if (cachedNoiseBuffer) return cachedNoiseBuffer;
    if (!audioCtx) return null;
    const sampleRate = 44100;
    const bufferSize = sampleRate * 1.0; 
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
    cachedNoiseBuffer = noiseBuffer;
    return noiseBuffer;
}
