/**
 * Notification Sound Utility
 * Handles playing a noticeable alert sound using Web Audio API.
 */

let audioCtx = null;

const initAudioContext = async () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  return audioCtx;
};

/**
 * Plays a professional notification sound sequence (Triple-Beep)
 * Designed to be audible and distinct.
 */
export const playNotificationSound = async () => {
  try {
    const ctx = await initAudioContext();

    // Define the la-si-la sequence for a "ding-ding-ding" feel
    const notes = [880, 1100, 880];
    const duration = 0.12; // duration of each beep
    const gap = 0.05;       // gap between beeps
    const volume = 0.3;    // Increased volume (0.0 to 1.0)

    const now = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Using 'triangle' for a softer but clear tone than 'square'
      osc.type = 'triangle';
      osc.frequency.value = freq;

      // Envelope to prevent clicking and make it punchy
      gain.gain.setValueAtTime(0, now + (i * (duration + gap)));
      gain.gain.linearRampToValueAtTime(volume, now + (i * (duration + gap)) + 0.01);
      gain.gain.linearRampToValueAtTime(0, now + (i * (duration + gap)) + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + (i * (duration + gap)));
      osc.stop(now + (i * (duration + gap)) + duration);
    });

  } catch (err) {
    console.error('Could not play notification sound:', err);
    // Fallback to HTML5 Audio if available (though usually failed if API fails)
    try {
      const audio = new Audio('/notification-sound.mp3');
      audio.volume = 1.0;
      audio.play().catch(() => {});
    } catch (e) {}
  }
};

/**
 * Ensures the AudioContext is resumed on user interaction.
 * Should be called in a global click listener.
 */
export const resumeAudioContext = async () => {
  try {
    await initAudioContext();
  } catch (e) {
    console.error('Failed to resume audio context', e);
  }
};
