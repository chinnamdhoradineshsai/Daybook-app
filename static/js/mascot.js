/**
 * DAYBOOK — Animated Bear Mascot Celebration Engine
 * Section 21: Expressive, vector-animated motivational companion
 */

const Mascot = (() => {
  // Config & State
  let isEnabled = true;
  let isMuted = true;
  let activeCelebrationTimeout = null;

  // Encouraging dialogue pool
  const MESSAGES = {
    standard: [
      "Good job! You did it! 🐻",
      "Yay! Another task completed! ✨",
      "Look at you! You're making progress! 🚀",
      "Awesome work! Keep going! 💪",
      "One step closer to your goal! 🎯",
      "You're doing great today! 🌟",
      "High five! That was a win! 🐾",
      "Woohoo! We got it done! 🎉",
    ],
    first_completed: [
      "First task finished! Fantastic start to the day! 🌟",
      "First win in the books! Momentum is building! 🚀",
    ],
    five_completed: [
      "5 tasks crushed today! You're on FIRE! 🔥🚀",
      "High five! 5 tasks completed already! 🐾🎉",
    ],
    all_completed: [
      "WOOHOO! All scheduled tasks are complete! 🏆🎉🥳",
      "Victory! You cleared your whole task list today! 👑🐻",
    ],
  };

  /**
   * Generates the celebratory Bear Mascot SVG
   */
  function getBearSvg(isHappySquint = true) {
    return `
      <svg class="mascot-bear-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Shadow -->
        <ellipse cx="60" cy="112" rx="38" ry="6" fill="rgba(0,0,0,0.12)" class="mascot-shadow" />

        <!-- Ears -->
        <g class="mascot-ears">
          <circle cx="34" cy="36" r="14" fill="#a06034" />
          <circle cx="34" cy="36" r="8" fill="#fbb6ce" />
          <circle cx="86" cy="36" r="14" fill="#a06034" />
          <circle cx="86" cy="36" r="8" fill="#fbb6ce" />
        </g>

        <!-- Bear Body -->
        <ellipse cx="60" cy="80" rx="34" ry="30" fill="#b47040" />
        <!-- Tummy -->
        <ellipse cx="60" cy="84" rx="20" ry="18" fill="#fef3c7" />

        <!-- Bear Head -->
        <circle cx="60" cy="54" r="32" fill="#b47040" />

        <!-- Rosy Cheeks -->
        <ellipse cx="40" cy="62" rx="6" ry="4" fill="#fca5a5" opacity="0.85" class="mascot-blush" />
        <ellipse cx="80" cy="62" rx="6" ry="4" fill="#fca5a5" opacity="0.85" class="mascot-blush" />

        <!-- Snout / Muzzle -->
        <ellipse cx="60" cy="63" rx="14" ry="10" fill="#fef3c7" />
        <!-- Nose -->
        <ellipse cx="60" cy="59" rx="5" ry="3.5" fill="#292524" />
        <!-- Smile -->
        <path d="M55 64 Q60 69 65 64" stroke="#292524" stroke-width="2" stroke-linecap="round" fill="none" />

        <!-- Eyes (Happy Squint vs Open Eyes) -->
        ${
          isHappySquint
            ? `
          <!-- Happy Curved Arcs -->
          <path d="M43 50 Q48 45 53 50" stroke="#292524" stroke-width="2.6" stroke-linecap="round" fill="none" class="mascot-eye-left" />
          <path d="M67 50 Q72 45 77 50" stroke="#292524" stroke-width="2.6" stroke-linecap="round" fill="none" class="mascot-eye-right" />
        `
            : `
          <!-- Open Blinking Eyes -->
          <circle cx="48" cy="49" r="3.2" fill="#292524" class="mascot-eye-left" />
          <circle cx="72" cy="49" r="3.2" fill="#292524" class="mascot-eye-right" />
          <circle cx="47" cy="47.5" r="1.2" fill="#ffffff" />
          <circle cx="71" cy="47.5" r="1.2" fill="#ffffff" />
        `
        }

        <!-- Paws / Arms -->
        <!-- Left waving paw -->
        <g class="mascot-paw-wave">
          <ellipse cx="30" cy="74" rx="8" ry="11" fill="#a06034" transform="rotate(-30 30 74)" />
          <circle cx="28" cy="69" r="4" fill="#fbb6ce" />
        </g>
        <!-- Right cheer paw -->
        <g class="mascot-paw-cheer">
          <ellipse cx="90" cy="74" rx="8" ry="11" fill="#a06034" transform="rotate(30 90 74)" />
          <circle cx="92" cy="69" r="4" fill="#fbb6ce" />
        </g>
      </svg>
    `;
  }

  /**
   * Web Audio API subtle celebration chime (silent by default)
   */
  function playChime() {
    if (isMuted) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.18); // G5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Spawns confetti particle burst around mascot
   */
  function spawnConfetti(container) {
    // Respect user reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const colors = ["#ff6b6b", "#4f46e5", "#10b981", "#fbbf24", "#ec4899", "#8b5cf6"];
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement("div");
      p.className = "mascot-confetti-particle";
      p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      p.style.left = `${45 + (Math.random() * 40 - 20)}%`;
      p.style.top = `${60 + (Math.random() * 20 - 10)}%`;

      // Random trajectories
      const dx = (Math.random() - 0.5) * 160;
      const dy = -(Math.random() * 100 + 40);
      const rot = Math.random() * 720;
      p.style.setProperty("--dx", `${dx}px`);
      p.style.setProperty("--dy", `${dy}px`);
      p.style.setProperty("--rot", `${rot}deg`);

      container.appendChild(p);

      setTimeout(() => {
        if (p.parentNode) p.parentNode.removeChild(p);
      }, 1200);
    }
  }

  /**
   * Triggers the mascot celebration overlay
   */
  function celebrate(milestone = "standard", customMessage = null) {
    if (!isEnabled) return;

    // Remove existing celebration if active
    dismiss();

    // Select cheerful dialogue
    let textList = MESSAGES[milestone] || MESSAGES.standard;
    let message = customMessage || textList[Math.floor(Math.random() * textList.length)];

    // Create Mascot DOM Stage
    const stage = document.createElement("div");
    stage.id = "mascot-celebration-stage";
    stage.className = "mascot-stage";
    stage.setAttribute("role", "status");
    stage.setAttribute("aria-live", "polite");

    stage.innerHTML = `
      <div class="mascot-character-wrapper">
        <!-- Floating Speech Bubble -->
        <div class="mascot-speech-bubble">
          <span class="mascot-speech-text">${message}</span>
          <div class="mascot-speech-tail"></div>
        </div>

        <!-- Animated Bear Graphic -->
        <div class="mascot-bear-body">
          ${getBearSvg(true)}
        </div>

        <!-- Sparkles / Stars -->
        <div class="mascot-sparkle s1">✨</div>
        <div class="mascot-sparkle s2">⭐</div>
        <div class="mascot-sparkle s3">✨</div>
      </div>
    `;

    // Tap to dismiss anytime
    stage.addEventListener("click", () => {
      dismiss();
    });

    document.body.appendChild(stage);

    // Audio chime & confetti
    playChime();
    spawnConfetti(stage);

    // Auto-dismiss smoothly after 3.2 seconds
    activeCelebrationTimeout = setTimeout(() => {
      dismiss();
    }, 3200);
  }

  /**
   * Smoothly dismisses the mascot celebration
   */
  function dismiss() {
    if (activeCelebrationTimeout) {
      clearTimeout(activeCelebrationTimeout);
      activeCelebrationTimeout = null;
    }

    const stage = document.getElementById("mascot-celebration-stage");
    if (stage) {
      stage.classList.add("mascot-exit");
      setTimeout(() => {
        if (stage.parentNode) stage.parentNode.removeChild(stage);
      }, 350);
    }
  }

  /**
   * Public settings configuration
   */
  function setEnabled(enabled) {
    isEnabled = Boolean(enabled);
  }

  function setMuted(muted) {
    isMuted = Boolean(muted);
  }

  return {
    celebrate,
    dismiss,
    setEnabled,
    setMuted,
  };
})();

window.Mascot = Mascot;
