/**
 * Boogity boogity boogity! Let's go racing boys!
 *
 * Plays the Darrell Waltrip catchphrase.
 * Hidden easter egg triggered on grand slam submissions.
 */

let audio: HTMLAudioElement | null = null;

export function playBoogity() {
  try {
    // Create audio element if needed, reuse otherwise
    if (!audio) {
      audio = new Audio('/boogity.mp3');
      audio.volume = 1.0;
    }
    // Reset to start if already playing
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Autoplay blocked — ignore silently
    });
  } catch {
    // Audio not supported — ignore
  }
}
