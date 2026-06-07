// ============================================================
// studio.module.js — Algorithmic Beat Generator Engine
// ============================================================

let audioCtx = null;
let schedulerId = null;
let playheadCallback = null;
let gridCallback = null;

let isPlaying = false;
let currentStep = 0;
let nextNoteTime = 0.0;
const scheduleAheadTime = 0.15;
const lookahead = 25.0;

const VIBES = [
  { name: "Classic Trap", bpm: 140, style: "trap", defaults: [0.6, 0.5, 0.8, 0.7, 0.5], desc: "Half-time snare, rolling hi-hats, and deep 808 glides." },
  { name: "90s Boom Bap", bpm: 90, style: "boombap", defaults: [0.5, 0.5, 0.4, 0.5, 0.6], desc: "Swinging MPC kicks, grit claps, and jazz horn chops." },
  { name: "UK Drill", bpm: 142, style: "drill", defaults: [0.7, 0.6, 0.9, 0.8, 0.6], desc: "Syncopated snare on 3 and 8, slides, and menacing choirs." },
  { name: "NY Drill", bpm: 144, style: "drill", defaults: [0.7, 0.6, 0.8, 0.8, 0.6], desc: "Punchy pop-sample flips with aggressive sliding 808s." },
  { name: "Chicago Drill", bpm: 135, style: "chicagodrill", defaults: [0.6, 0.4, 0.5, 0.6, 0.5], desc: "Marching band kicks, minor brass bells, and gritty sub-bass." },
  { name: "G-Funk", bpm: 95, style: "gfunk", defaults: [0.5, 0.5, 0.6, 0.8, 0.8], desc: "High-pitched whistle lead, Moog bass, and laidback claps." },
  { name: "Lo-Fi Hip Hop", bpm: 80, style: "lofi", defaults: [0.4, 0.3, 0.3, 0.4, 0.5], desc: "Muffled unquantized rims, tape hiss, and warbly keys." },
  { name: "Jazz Rap", bpm: 92, style: "jazzrap", defaults: [0.5, 0.4, 0.5, 0.7, 0.8], desc: "Swinging upright bass, live horn stabs, and acoustic ride rims." },
  { name: "Neo-Soul Hip Hop", bpm: 88, style: "neosoul", defaults: [0.4, 0.4, 0.4, 0.6, 0.7], desc: "Laidback behind-the-beat grooves, Rhodes, and vocal chords." },
  { name: "Latin Trap", bpm: 130, style: "latintrap", defaults: [0.6, 0.5, 0.7, 0.6, 0.6], desc: "Dembow rhythm meets half-time trap snares and Spanish guitars." },
  { name: "Reggaeton Hip Hop", bpm: 96, style: "reggaeton", defaults: [0.7, 0.7, 0.4, 0.5, 0.6], desc: "Classic Tresillo kick/snare pattern with tropical synth plucks." },
  { name: "Afrobeat Rap", bpm: 105, style: "afrobeat", defaults: [0.6, 0.6, 0.5, 0.6, 0.6], desc: "Polyrhythmic wooden rims, organic shakers, and warm keys." },
  { name: "Phonk", bpm: 120, style: "phonk", defaults: [0.6, 0.6, 0.7, 0.7, 0.8], desc: "Blown-out 808 cowbell melodies and gritty Memphis rap cuts." },
  { name: "Memphis Phonk", bpm: 140, style: "phonk", defaults: [0.7, 0.6, 0.8, 0.8, 0.7], desc: "Hypnotic 16th hats, classic TR-808s, and tape saturation." },
  { name: "Cloud Rap", bpm: 130, style: "cloud", defaults: [0.5, 0.4, 0.6, 0.6, 0.8], desc: "Ethereal pads, heavy reverb, and slow, washing sub-bass." },
  { name: "Emo Rap", bpm: 120, style: "emo", defaults: [0.6, 0.5, 0.6, 0.6, 0.7], desc: "Melancholic acoustic guitar loops with clean trap rolls." },
  { name: "Hyperpop Rap", bpm: 150, style: "hyperpop", defaults: [0.8, 0.7, 0.9, 0.8, 0.9], desc: "Frenetic glitches, bitcrushed 808s, and chiptune synth runs." },
  { name: "Rage", bpm: 145, style: "rage", defaults: [0.7, 0.6, 0.7, 0.8, 0.8], desc: "Massive anthemic saw synths and simple heavy trap drums." },
  { name: "Detroit Scam Rap", bpm: 100, style: "detroit", defaults: [0.6, 0.5, 0.8, 0.7, 0.6], desc: "Chaotic off-kilter kicks, fast keys, and running hi-hats." },
  { name: "West Coast Bounce", bpm: 98, style: "westcoast", defaults: [0.6, 0.5, 0.5, 0.7, 0.7], desc: "Swung claps, bouncing west coast bass, and high whistles." },
  { name: "Bay Area Hyphy", bpm: 105, style: "hyphy", defaults: [0.7, 0.6, 0.6, 0.7, 0.6], desc: "High energy claps, driving subs, and quirky synth blips." },
  { name: "Crunk", bpm: 75, style: "crunk", defaults: [0.8, 0.7, 0.8, 0.8, 0.6], desc: "Booming 808 drops, club-ready orchestral hits, and offbeat hats." },
  { name: "Dirty South", bpm: 145, style: "dirtysouth", defaults: [0.7, 0.6, 0.8, 0.7, 0.6], desc: "Gothic organ loops, marching brass, and heavy TR-808 rolls." },
  { name: "Chopped and Screwed", bpm: 65, style: "chopped", defaults: [0.5, 0.4, 0.4, 0.8, 0.5], desc: "Sluggish, dragging, pitch-shifted analog sub frequencies." },
  { name: "Plugg", bpm: 110, style: "plugg", defaults: [0.5, 0.5, 0.5, 0.6, 0.7], desc: "Dreamy game synths, soft subs, and off-beat Zaytoven claps." },
  { name: "Pluggnb", bpm: 115, style: "pluggnb", defaults: [0.5, 0.5, 0.6, 0.6, 0.8], desc: "Lush R&B electric pianos, smooth glide bass, and soft rims." },
  { name: "R&B Trap", bpm: 120, style: "rnb_trap", defaults: [0.5, 0.5, 0.6, 0.6, 0.7], desc: "Moody filtered vocal pads and soft trap drums." },
  { name: "Jersey Club Rap", bpm: 140, style: "jersey", defaults: [0.8, 0.7, 0.8, 0.7, 0.7], desc: "Iconic 5-kick bounce rhythm with bed squeak sound effects." },
  { name: "Baltimore Club Rap", bpm: 132, style: "baltimore", defaults: [0.8, 0.6, 0.7, 0.6, 0.6], desc: "Heavy breakbeat loops and energetic looped vocal chants." },
  { name: "Grime", bpm: 140, style: "grime", defaults: [0.7, 0.6, 0.7, 0.8, 0.7], desc: "Robotic syncopation, wobbly square bass, and cold synths." },
  { name: "Miami Bass", bpm: 130, style: "miamibass", defaults: [0.8, 0.7, 0.8, 0.8, 0.6], desc: "Frenetic TR-808 claps, electro stabs, and boom bass drops." },
  { name: "New Orleans Bounce", bpm: 100, style: "nobounce", defaults: [0.8, 0.7, 0.5, 0.6, 0.5], desc: "The legendary Triggaman breakbeat loop with call-and-response." },
  { name: "Drumless Boom Bap", bpm: 80, style: "drumless", defaults: [0.0, 0.0, 0.0, 0.5, 0.8], desc: "Pure vinyl loops of 70s soul and jazz without programmed drums." },
  { name: "Hardcore Hip Hop", bpm: 92, style: "hardcore", defaults: [0.7, 0.7, 0.5, 0.7, 0.7], desc: "Distorted bitcrushed drums, metal clanks, and screaming sirens." },
  { name: "Cyberpunk Rap", bpm: 100, style: "cyberpunk", defaults: [0.6, 0.6, 0.6, 0.8, 0.8], desc: "Rolling 16th-note arpeggiated synth bass and gated reverb." },
  { name: "Alternative Hip Hop", bpm: 102, style: "alternative", defaults: [0.6, 0.5, 0.5, 0.6, 0.7], desc: "Dry acoustic loops, slap bass, and quirky futuristic chords." },
  { name: "Conscious Hip Hop", bpm: 90, style: "conscious", defaults: [0.5, 0.5, 0.5, 0.6, 0.7], desc: "Crisp MPC drums, warm horn stabs, and uplifting jazz piano." },
  { name: "Chillhop", bpm: 85, style: "chillhop", defaults: [0.4, 0.3, 0.4, 0.5, 0.6], desc: "Rain foley, low-pass filtered guitar riffs, and soft swing." },
  { name: "Epic / Orchestral Rap", bpm: 88, style: "epic", defaults: [0.7, 0.6, 0.5, 0.7, 0.8], desc: "Cinematic timpani impacts, strings sweeps, and dramatic choirs." },
  { name: "Cinematic Trap", bpm: 140, style: "cinematic_trap", defaults: [0.7, 0.6, 0.7, 0.7, 0.8], desc: "Orchestral staccato violins layered with heavy sub drops." },
  { name: "Horrorcore", bpm: 90, style: "horror", defaults: [0.6, 0.6, 0.5, 0.7, 0.7], desc: "Ominous soundscapes, detuned bells, and creepy music boxes." },
  { name: "Pop Rap", bpm: 100, style: "poprap", defaults: [0.6, 0.5, 0.6, 0.6, 0.7], desc: "Polished, clean, radio-friendly major key chords and bass." },
  { name: "Future Bass Rap", bpm: 150, style: "futurebass", defaults: [0.7, 0.7, 0.8, 0.7, 0.9], desc: "Sidechained supersaw chords and massive pitched synth sweeps." },
  { name: "Dancehall Rap", bpm: 100, style: "dancehall", defaults: [0.7, 0.6, 0.6, 0.6, 0.7], desc: "Swung offbeat shakers and piano keys playing the dem-bow bounce." },
  { name: "Spoken Word", bpm: 85, style: "spoken", defaults: [0.3, 0.3, 0.4, 0.5, 0.6], desc: "Freeform brushes, walking acoustic bass, and sax solos." },
  { name: "Tread", bpm: 160, style: "tread", defaults: [0.8, 0.7, 0.9, 0.8, 0.7], desc: "Manic, blindingly fast hi-hat rolls and aggressive 808 runs." },
  { name: "Glitch Hop Rap", bpm: 108, style: "glitch", defaults: [0.7, 0.7, 0.7, 0.7, 0.8], desc: "Growling mid-bass stutters, chiptunes, and digital glitches." },
  { name: "Old School Breakbeat", bpm: 110, style: "oldschool", defaults: [0.7, 0.6, 0.6, 0.6, 0.6], desc: "Sampled James Brown funk drum breaks and scratching hooks." },
  { name: "Bossa Nova Rap", bpm: 80, style: "bossa", defaults: [0.5, 0.4, 0.5, 0.5, 0.7], desc: "Nylon-string jazz chords and rimshots mimicking bossa clave." },
  { name: "Drill'n'B / Jungle", bpm: 170, style: "jungle", defaults: [0.8, 0.8, 0.9, 0.8, 0.7], desc: "Frantic chopped breakbeats and deep, rolling Reese sub-bass." }
];

let audioState = {
    vibeIndex: 0,
    tempo: 140,
    kickComplexity: 0.5,
    snareComplexity: 0.5,
    hatComplexity: 0.5,
    bassComplexity: 0.5,
    melodyComplexity: 0.5,
    grid: [new Array(16).fill(false), new Array(16).fill(false), new Array(16).fill(false), new Array(16).fill(false), new Array(16).fill(false)],
    bassNotes: new Array(16).fill(0),
    melodyNotes: new Array(16).fill(0)
};

let dotNetHelper = null;

export function initStudio(helper, callback, onGridUpdate) {
    dotNetHelper = helper;
    playheadCallback = callback;
    gridCallback = onGridUpdate;
}

export function startPlay(initialState) {
    if (isPlaying) return;
    initAudioContext();
    updateState(initialState);
    isPlaying = true;
    currentStep = 0;
    nextNoteTime = audioCtx.currentTime + 0.05;
    schedulerId = setInterval(schedulerLoop, lookahead);
}

export function stopPlay() {
    isPlaying = false;
    if (schedulerId) clearInterval(schedulerId);
}

export function updateState(newState) {
    if (!newState) return;
    
    // Map incoming properties (C# is camelCase in JSON serialization usually, or exact PascalCase depending on setup. 
    // Let's handle both or check how they serialize. Usually System.Text.Json uses camelCase if configured, 
    // or PascalCase. Let's write robust mapping for both.)
    if (newState.vibeIndex !== undefined) audioState.vibeIndex = newState.vibeIndex;
    if (newState.VibeIndex !== undefined) audioState.vibeIndex = newState.VibeIndex;
    
    if (newState.tempo !== undefined) audioState.tempo = newState.tempo;
    if (newState.Tempo !== undefined) audioState.tempo = newState.Tempo;
    
    if (newState.kickComplexity !== undefined) audioState.kickComplexity = newState.kickComplexity;
    if (newState.KickComplexity !== undefined) audioState.kickComplexity = newState.KickComplexity;
    
    if (newState.snareComplexity !== undefined) audioState.snareComplexity = newState.snareComplexity;
    if (newState.SnareComplexity !== undefined) audioState.snareComplexity = newState.SnareComplexity;
    
    if (newState.hatComplexity !== undefined) audioState.hatComplexity = newState.hatComplexity;
    if (newState.HatComplexity !== undefined) audioState.hatComplexity = newState.HatComplexity;
    
    if (newState.bassComplexity !== undefined) audioState.bassComplexity = newState.bassComplexity;
    if (newState.BassComplexity !== undefined) audioState.bassComplexity = newState.BassComplexity;
    
    if (newState.melodyComplexity !== undefined) audioState.melodyComplexity = newState.melodyComplexity;
    if (newState.MelodyComplexity !== undefined) audioState.melodyComplexity = newState.MelodyComplexity;

    initAudioContext();
    generatePatterns();
}

function initAudioContext() {
    if (audioCtx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
    window.audioCtx = audioCtx; // Expose globally for Safari synchronous resume

    // iOS Foreground/Background Audio Patch
    if (!window._silentAudioEl) {
        window._silentAudioEl = document.createElement('audio');
        window._silentAudioEl.loop = true;
        window._silentAudioEl.crossOrigin = 'anonymous';
        // A minimal valid base64 silent WAV
        window._silentAudioEl.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'; 
        window._silentAudioEl.play().catch(() => {});
        
        // Ensure iOS doesn't sleep the audio context
        const source = audioCtx.createMediaElementSource(window._silentAudioEl);
        source.connect(audioCtx.destination);
    }
}

function schedulerLoop() {
    while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
        scheduleNote(currentStep, nextNoteTime);
        advanceNote();
    }
}

function advanceNote() {
    const secondsPerStep = (60.0 / audioState.tempo) / 4.0;
    nextNoteTime += secondsPerStep;
    if (dotNetHelper && playheadCallback) {
        const stepToInvoke = currentStep;
        requestAnimationFrame(() => {
            try { dotNetHelper.invokeMethodAsync(playheadCallback, stepToInvoke); } catch (_) {}
        });
    }
    currentStep = (currentStep + 1) % 16;
}

function scheduleNote(step, time) {
    if (audioState.grid[0][step]) playKickSynth(time, step);
    if (audioState.grid[1][step]) playSnareSynth(time, step);
    if (audioState.grid[2][step]) playHiHatSynth(time, step);
    if (audioState.grid[3][step]) playBassSynth(time, step);
    if (audioState.grid[4][step]) playMelodySynth(time, step);
}

// ── Algorithmic Pattern Generator ─────────────────────────────────
function generatePatterns() {
    const vibe = VIBES[audioState.vibeIndex] || VIBES[0];
    const kickC = audioState.kickComplexity;
    const snareC = audioState.snareComplexity;
    const hatC = audioState.hatComplexity;
    const bassC = audioState.bassComplexity;
    const melC = audioState.melodyComplexity;

    // Reset grids
    for (let t = 0; t < 5; t++) {
        audioState.grid[t] = new Array(16).fill(false);
    }
    audioState.bassNotes = new Array(16).fill(0);
    audioState.melodyNotes = new Array(16).fill(0);

    // ─── 1. KICK GENERATION ───
    if (vibe.style !== 'drumless') {
        audioState.grid[0][0] = true;
        
        if (vibe.style === 'reggaeton' || vibe.style === 'dancehall' || vibe.style === 'latintrap') {
            audioState.grid[0][4] = true;
            audioState.grid[0][8] = true;
            audioState.grid[0][12] = true;
            if (kickC > 0.6) audioState.grid[0][14] = true;
        } else if (vibe.style === 'jersey') {
            audioState.grid[0][4] = true;
            audioState.grid[0][6] = true;
            audioState.grid[0][10] = true;
            audioState.grid[0][14] = true;
        } else if (vibe.style === 'drill' || vibe.style === 'chicagodrill') {
            audioState.grid[0][10] = true;
            if (kickC > 0.35) audioState.grid[0][6] = true;
            if (kickC > 0.7) audioState.grid[0][14] = true;
        } else {
            audioState.grid[0][8] = true;
            if (kickC > 0.25) audioState.grid[0][6] = true;
            if (kickC > 0.55) audioState.grid[0][11] = true;
            if (kickC > 0.8) {
                audioState.grid[0][14] = true;
                audioState.grid[0][15] = true;
            }
        }
    }

    // ─── 2. SNARE GENERATION ───
    if (vibe.style !== 'drumless') {
        const isHalfTime = ['trap', 'drill', 'chicagodrill', 'phonk', 'cloud', 'emo', 'hyperpop', 'rage', 'dirtysouth', 'crunk', 'cinematic_trap', 'futurebass', 'tread', 'jungle'].includes(vibe.style);
        
        if (vibe.style === 'reggaeton' || vibe.style === 'dancehall' || vibe.style === 'nobounce') {
            audioState.grid[1][3] = true;
            audioState.grid[1][6] = true;
            audioState.grid[1][11] = true;
            audioState.grid[1][14] = true;
        } else if (vibe.style === 'drill') {
            audioState.grid[1][8] = true;
            if (snareC > 0.5) audioState.grid[1][14] = true;
        } else if (isHalfTime) {
            audioState.grid[1][8] = true;
            if (snareC > 0.45) audioState.grid[1][15] = true;
            if (snareC > 0.75) {
                audioState.grid[1][3] = true;
                audioState.grid[1][12] = true;
            }
        } else {
            audioState.grid[1][4] = true;
            audioState.grid[1][12] = true;
            if (snareC > 0.45) audioState.grid[1][7] = true;
            if (snareC > 0.75) {
                audioState.grid[1][15] = true;
                audioState.grid[1][1] = true;
            }
        }
    }

    // ─── 3. HI-HAT GENERATION ───
    if (vibe.style !== 'drumless') {
        const stepRate = hatC < 0.25 ? 4 : (hatC < 0.7 ? 2 : 1);
        for (let s = 0; s < 16; s += stepRate) {
            audioState.grid[2][s] = true;
        }
        if (hatC > 0.8) {
            audioState.grid[2][6] = true;
            audioState.grid[2][7] = true;
            audioState.grid[2][14] = true;
            audioState.grid[2][15] = true;
        }
    }

    // ─── 4. BASS GENERATION ───
    const bassStepRate = bassC < 0.25 ? 8 : (bassC < 0.65 ? 4 : 2);
    const basePitches = vibe.style === 'gfunk' ? [36, 43, 36, 48, 46, 43, 36, 36] : 
                        ['trap', 'drill', 'phonk', 'rage', 'horror'].includes(vibe.style) ? [36, 39, 41, 43, 36, 36, 36, 36] : 
                        [36, 40, 43, 45, 36, 36, 36, 36];
                        
    for (let s = 0; s < 16; s++) {
        if (s % bassStepRate === 0) {
            if (bassC > 0.1 || s === 0 || s === 8) {
                audioState.grid[3][s] = true;
                const noteIndex = Math.floor(s / bassStepRate) % basePitches.length;
                let pitch = basePitches[noteIndex];
                if (bassC > 0.75 && s % 8 === 4) {
                    pitch += 5;
                }
                audioState.bassNotes[s] = midiToFreq(pitch);
            }
        }
    }

    // ─── 5. MELODY GENERATION ───
    const melStepRate = melC < 0.25 ? 8 : (melC < 0.65 ? 4 : 2);
    const melPitches = vibe.style === 'gfunk' ? [60, 62, 64, 67, 72, 67, 64, 62] :
                       ['trap', 'drill', 'phonk', 'rage', 'horror'].includes(vibe.style) ? [60, 63, 65, 67, 70, 67, 65, 63] :
                       [60, 64, 67, 69, 72, 69, 67, 64];

    for (let s = 0; s < 16; s++) {
        if (s % melStepRate === 0) {
            if (melC > 0.1 || s === 0 || s === 8) {
                audioState.grid[4][s] = true;
                const noteIndex = Math.floor(s / melStepRate) % melPitches.length;
                let pitch = melPitches[noteIndex];
                if (melC > 0.8 && s % 4 === 2) {
                    pitch += 12;
                }
                audioState.melodyNotes[s] = midiToFreq(pitch);
            }
        }
    }

    // Notify Blazor UI
    if (dotNetHelper && gridCallback) {
        requestAnimationFrame(() => {
            try {
                dotNetHelper.invokeMethodAsync(gridCallback, audioState.grid, audioState.melodyNotes);
            } catch (e) {
                console.error("Failed to invoke grid callback:", e);
            }
        });
    }
}

function midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

// ── Spider III DSP TubeTone Stage ────────────────────────────────
function getTubeToneCurve(driveVal) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const k = typeof driveVal === 'number' ? driveVal * 10 : 5;
    for (let i = 0; i < n_samples; ++i) {
        let x = (i * 2) / n_samples - 1;
        // Soft clipping with drive factor
        curve[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

// ── SmartFX DSP Node ─────────────────────────────────────────────
let impulseBuffer = null;
function getReverbImpulse() {
    if (impulseBuffer) return impulseBuffer;
    if (!audioCtx) return null;
    const rate = audioCtx.sampleRate;
    const length = rate * 1.5; 
    impulseBuffer = audioCtx.createBuffer(2, length, rate);
    for (let channel = 0; channel < 2; channel++) {
        let channelData = impulseBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
    }
    return impulseBuffer;
}

// ── Generative Track DSP Creator ──────────────────────────────────
function createTrackDSP(trackIndex, time, saturationAmt) {
    const inputGain = audioCtx.createGain();
    
    // WaveShaper saturation
    const shaper = audioCtx.createWaveShaper();
    shaper.curve = getTubeToneCurve(saturationAmt);
    shaper.oversample = '4x';
    
    // DC Blocker (15Hz highpass to strip structural offsets)
    const dcBlocker = audioCtx.createBiquadFilter();
    dcBlocker.type = 'highpass';
    dcBlocker.frequency.value = 15;

    // Filter
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 20000;
    
    // Reverb send if requested
    const reverbSend = audioCtx.createGain();
    reverbSend.gain.value = 0.0;
    
    // Final Gain
    const outputGain = audioCtx.createGain();
    outputGain.gain.setValueAtTime(0.0001, time);
    
    inputGain.connect(shaper);
    shaper.connect(dcBlocker);
    dcBlocker.connect(filter);
    filter.connect(outputGain);
    outputGain.connect(audioCtx.destination);
    
    // Custom FX Routing based on vibe
    const vibe = VIBES[audioState.vibeIndex] || VIBES[0];
    if (vibe.style === 'cloud' || vibe.style === 'emo') {
        // High reverb send
        reverbSend.gain.setValueAtTime(0.3, time);
        const reverb = audioCtx.createConvolver();
        reverb.buffer = getReverbImpulse();
        outputGain.connect(reverbSend);
        reverbSend.connect(reverb);
        reverb.connect(audioCtx.destination);
    }
    
    return {
        input: inputGain,
        filter: filter,
        output: outputGain
    };
}

// ── Synthesizers ─────────────────────────────────────────────────

function playKickSynth(time, step) {
    const vibe = VIBES[audioState.vibeIndex] || VIBES[0];
    
    // Dynamic Saturation based on style
    let saturation = 0.2;
    if (['phonk', 'hardcore', 'hyperpop', 'rage', 'grime'].includes(vibe.style)) {
        saturation = 0.8; // highly noticeble distortion
    } else if (vibe.style === 'lofi') {
        saturation = 0.05; // clean/warm
    }
    
    const dsp = createTrackDSP(0, time, saturation);
    const osc = audioCtx.createOscillator();
    osc.connect(dsp.input);
    
    // Pitch sweep
    let startFreq = 150;
    let endFreq = 40;
    let decay = 0.12 + (audioState.kickComplexity * 0.2);
    
    if (vibe.style === 'epic') {
        startFreq = 80;
        endFreq = 25;
        decay = 0.4; // Timpani boom
    } else if (['trap', 'drill', 'phonk', 'rage'].includes(vibe.style)) {
        startFreq = 120;
        endFreq = 35;
        decay = 0.25 + (audioState.kickComplexity * 0.35); // Long 808
    }
    
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.08);
    
    dsp.output.gain.linearRampToValueAtTime(0.8, time + 0.005);
    dsp.output.gain.exponentialRampToValueAtTime(0.001, time + decay);
    
    osc.start(time);
    osc.stop(time + decay + 0.1);
}

function playSnareSynth(time, step) {
    const vibe = VIBES[audioState.vibeIndex] || VIBES[0];
    
    let saturation = 0.2;
    if (['phonk', 'hardcore', 'hyperpop'].includes(vibe.style)) {
        saturation = 0.7;
    }
    
    const dsp = createTrackDSP(1, time, saturation);
    
    // Noise buffer
    const bufferSize = audioCtx.sampleRate * 0.3;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    
    // Filter
    if (vibe.style === 'lofi') {
        dsp.filter.type = 'lowpass';
        dsp.filter.frequency.value = 1500; // Muffled rim
    } else {
        dsp.filter.type = 'bandpass';
        dsp.filter.frequency.value = 1000;
    }
    
    noise.connect(dsp.input);
    
    const decay = 0.08 + (audioState.snareComplexity * 0.2);
    
    dsp.output.gain.linearRampToValueAtTime(0.5, time + 0.002);
    dsp.output.gain.exponentialRampToValueAtTime(0.001, time + decay);
    
    noise.start(time);
    noise.stop(time + decay + 0.05);
}

function playHiHatSynth(time, step) {
    const vibe = VIBES[audioState.vibeIndex] || VIBES[0];
    
    const dsp = createTrackDSP(2, time, 0.1);
    
    const bufferSize = audioCtx.sampleRate * 0.1;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    
    // Hi-pass filter for hi-hat sizzle
    dsp.filter.type = 'highpass';
    if (vibe.style === 'lofi') {
        dsp.filter.frequency.value = 6000;
    } else {
        dsp.filter.frequency.value = 9000;
    }
    
    noise.connect(dsp.input);
    
    const decay = 0.02 + (audioState.hatComplexity * 0.08);
    
    dsp.output.gain.linearRampToValueAtTime(0.3, time + 0.001);
    dsp.output.gain.exponentialRampToValueAtTime(0.001, time + decay);
    
    noise.start(time);
    noise.stop(time + decay + 0.05);
}

function playBassSynth(time, step) {
    const vibe = VIBES[audioState.vibeIndex] || VIBES[0];
    
    let saturation = 0.1;
    if (['drill', 'phonk', 'grime', 'jungle'].includes(vibe.style)) {
        saturation = 0.9; // heavy wobbly or sliding Reese bass
    }
    
    const dsp = createTrackDSP(3, time, saturation);
    const osc = audioCtx.createOscillator();
    
    if (['gfunk', 'grime', 'jungle'].includes(vibe.style)) {
        osc.type = 'sawtooth';
        dsp.filter.type = 'lowpass';
        dsp.filter.frequency.value = 400 + (audioState.bassComplexity * 600);
    } else {
        osc.type = 'triangle'; // Sub bass
    }
    
    const freq = audioState.bassNotes[step] || 65.41;
    osc.frequency.setValueAtTime(freq, time);
    
    // Pitch gliding for drill slide effect
    if (vibe.style === 'drill' && step % 4 === 2) {
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, time + 0.15);
    }
    
    osc.connect(dsp.input);
    
    const decay = 0.15 + (audioState.bassComplexity * 0.45);
    
    dsp.output.gain.linearRampToValueAtTime(0.7, time + 0.01);
    dsp.output.gain.exponentialRampToValueAtTime(0.001, time + decay);
    
    osc.start(time);
    osc.stop(time + decay + 0.05);
}

function playMelodySynth(time, step) {
    const vibe = VIBES[audioState.vibeIndex] || VIBES[0];
    
    const dsp = createTrackDSP(4, time, 0.15);
    const osc = audioCtx.createOscillator();
    
    if (vibe.style === 'gfunk') {
        osc.type = 'sine'; // G-Funk whistle
    } else if (vibe.style === 'rage' || vibe.style === 'hyperpop') {
        osc.type = 'sawtooth'; // Buzzy lead
        dsp.filter.type = 'peaking';
        dsp.filter.frequency.value = 2000;
    } else if (vibe.style === 'lofi' || vibe.style === 'neosoul') {
        osc.type = 'triangle'; // Smooth EP Rhodes
        dsp.filter.type = 'lowpass';
        dsp.filter.frequency.value = 1000;
    } else {
        osc.type = 'sine'; // Bell-like plucked sine
    }
    
    const freq = audioState.melodyNotes[step] || 261.63;
    osc.frequency.setValueAtTime(freq, time);
    
    // Slide for G-funk whistle
    if (vibe.style === 'gfunk') {
        osc.frequency.linearRampToValueAtTime(freq * 1.2, time + 0.1);
    }
    
    osc.connect(dsp.input);
    
    const decay = 0.1 + (audioState.melodyComplexity * 0.35);
    
    dsp.output.gain.linearRampToValueAtTime(0.4, time + 0.005);
    dsp.output.gain.exponentialRampToValueAtTime(0.001, time + decay);
    
    osc.start(time);
    osc.stop(time + decay + 0.05);
}

// Live triggering (Optional helper)
export function triggerLivePad(trackIndex) {
    initAudioContext();
    const time = audioCtx.currentTime;
    if (trackIndex === 0) playKickSynth(time, 0);
    else if (trackIndex === 1) playSnareSynth(time, 0);
    else if (trackIndex === 2) playHiHatSynth(time, 0);
    else if (trackIndex === 3) playBassSynth(time, 0);
    else if (trackIndex === 4) playMelodySynth(time, 0);
}

// Live play frequencies
export function playFrequency(trackIndex, frequency) {
    initAudioContext();
    const time = audioCtx.currentTime;
    const dsp = createTrackDSP(trackIndex, time, 0.2);
    const osc = audioCtx.createOscillator();
    osc.frequency.value = frequency;
    osc.connect(dsp.input);
    dsp.output.gain.linearRampToValueAtTime(0.4, time + 0.005);
    dsp.output.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.start(time);
    osc.stop(time + 0.35);
}
