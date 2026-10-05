// Web Audio API Synthesizer & Speech Assistant for instant warehouse feedback

function getAudioCtx() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  return new AudioContext();
}

// 1. Success Beep (New package scanned & packed)
export function playSuccessBeep() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.setValueAtTime(1318.5, ctx.currentTime + 0.08); // E6
    
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

// 2. Warning Beep (Package already scanned / duplicate read)
export function playWarningBeep() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    
    [0, 0.1, 0.2].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime + offset); // D5
      
      gain.gain.setValueAtTime(0.25, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.08);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.08);
    });
  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

// 3. Error Beep (Code not found / invalid)
export function playErrorBeep() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
    osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15); // Drop
    
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn('Audio feedback failed:', e);
  }
}

// 4. Cash Register / New Sale Sound (Cha-ching!)
export function playCashRegisterSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;

    const freqs = [1046.5, 1318.5, 1567.98, 2093.0]; // C6, E6, G6, C7 chord
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + (idx * 0.06);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });

    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'triangle';
    bell.frequency.setValueAtTime(2637, ctx.currentTime + 0.25); // E7 high bell
    bellGain.gain.setValueAtTime(0.3, ctx.currentTime + 0.25);
    bellGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    bell.connect(bellGain);
    bellGain.connect(ctx.destination);
    bell.start(ctx.currentTime + 0.25);
    bell.stop(ctx.currentTime + 0.8);
  } catch (e) {
    console.warn('Sale audio failed:', e);
  }
}

// 5. Spanish Voice Assistant (Text-to-Speech)
export function speakSpanish(text) {
  try {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel(); // Stop any pending utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-AR'; // Argentine Spanish or standard Spanish
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;

    // Look for best Spanish voice available in browser
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(v => v.lang.startsWith('es') || v.name.toLowerCase().includes('spanish'));
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech synthesis failed:', e);
  }
}
