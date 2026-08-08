/**
 * SQUARES - Audio Engine (Web Audio API Synthesizer)
 * Generates custom sound effects dynamically without external audio files.
 */

let audioCtx = null;
let isMuted = false;

export function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
}

export function setMuted(muted) {
    isMuted = muted;
}

export function getMuted() {
    return isMuted;
}

export function toggleMuted() {
    isMuted = !isMuted;
    return isMuted;
}

export function synthSound(freqs, durations, type = "sine", gainSequence = []) {
    if (isMuted) return;
    initAudio();
    
    try {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = type;
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        
        // Frequency schedule
        if (freqs.length === 1) {
            osc.frequency.setValueAtTime(freqs[0], now);
        } else {
            osc.frequency.setValueAtTime(freqs[0], now);
            let currentT = now;
            for (let i = 1; i < freqs.length; i++) {
                currentT += durations[i - 1];
                osc.frequency.exponentialRampToValueAtTime(freqs[i], currentT);
            }
        }
        
        // Gain schedule
        if (gainSequence.length > 0) {
            gainNode.gain.setValueAtTime(gainSequence[0], now);
            let currentT = now;
            for (let i = 1; i < gainSequence.length; i++) {
                currentT += durations[i - 1];
                gainNode.gain.linearRampToValueAtTime(gainSequence[i], currentT);
            }
        } else {
            gainNode.gain.setValueAtTime(0.15, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + durations.reduce((a, b) => a + b, 0));
        }
        
        osc.start(now);
        osc.stop(now + durations.reduce((a, b) => a + b, 0));
    } catch (e) {
        console.error("Audio synth error:", e);
    }
}

export function playRollTick() {
    synthSound([180, 80], [0.06], "triangle", [0.08, 0.001]);
}

export function playPlaceBlockSound() {
    synthSound([220, 55], [0.1, 0.25], "sawtooth", [0.2, 0.1, 0.001]);
}

export function playHoverTick() {
    synthSound([1200], [0.015], "sine", [0.03, 0.001]);
}

export function playErrorTone() {
    synthSound([150, 90], [0.15], "triangle", [0.12, 0.001]);
}

export function playWallSound() {
    synthSound([140, 60, 45], [0.05, 0.2], "triangle", [0.25, 0.1, 0.001]);
}

export function playBreachSound() {
    synthSound([1500, 150], [0.05, 0.35], "sawtooth", [0.25, 0.15, 0.001]);
}

export function playVictoryFanfare() {
    const tempo = 0.12;
    initAudio();
    const playNote = (freq, delay, dur) => {
        setTimeout(() => {
            if (isMuted) return;
            synthSound([freq], [dur], "sine", [0.12, 0.001]);
        }, delay * 1000);
    };
    
    playNote(261.63, 0, 0.35); // C4
    playNote(329.63, tempo, 0.35); // E4
    playNote(392.00, tempo * 2, 0.35); // G4
    playNote(523.25, tempo * 3, 0.6); // C5
}
