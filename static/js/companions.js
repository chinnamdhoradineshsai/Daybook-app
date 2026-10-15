/**
 * DAYBOOK — Animal Companion Gallery Engine
 * Feature: 11 Original Vector Animal Companions + Custom Gallery Photo Upload
 * 
 * Companions:
 * 1. Bear       🐻 - Warm, loyal, encouraging
 * 2. Cat        🐱 - Playful, cozy, high-fives
 * 3. Rabbit     🐰 - Energetic, bouncy, cheerful
 * 4. Penguin    🐧 - Dapper, polite, celebratory waddles
 * 5. Fox        🦊 - Clever, spirited, curious
 * 6. Panda      🐼 - Gentle, peaceful, mindful
 * 7. Dog        🐶 - Enthusiastic, best buddy, loyal
 * 8. Frog        🐸 - Joyful leaps, optimistic
 * 9. Capybara   🦫 - Maximum chill, zen focus, calm
 * 10. Owl       🦉 - Wise, attentive, milestone guide
 * 11. Dinosaur  🦕 - Mighty, fun, ambitious goals
 */

const CompanionManager = (() => {
  // Companion Definitions
  const COMPANIONS = [
    {
      id: "bear",
      name: "Barnaby the Bear",
      emoji: "🐻",
      tagline: "Warm, steady & encouraging",
      renderSvg: (happy = true) => `
        <svg viewBox="0 0 120 120" fill="none" class="companion-svg">
          <ellipse cx="60" cy="112" rx="36" ry="6" fill="rgba(0,0,0,0.12)" />
          <circle cx="34" cy="36" r="14" fill="#a06034" /><circle cx="34" cy="36" r="8" fill="#fbb6ce" />
          <circle cx="86" cy="36" r="14" fill="#a06034" /><circle cx="86" cy="36" r="8" fill="#fbb6ce" />
          <ellipse cx="60" cy="80" rx="34" ry="30" fill="#b47040" />
          <ellipse cx="60" cy="84" rx="20" ry="18" fill="#fef3c7" />
          <circle cx="60" cy="54" r="32" fill="#b47040" />
          <ellipse cx="40" cy="62" rx="6" ry="4" fill="#fca5a5" opacity="0.85" />
          <ellipse cx="80" cy="62" rx="6" ry="4" fill="#fca5a5" opacity="0.85" />
          <ellipse cx="60" cy="63" rx="14" ry="10" fill="#fef3c7" />
          <ellipse cx="60" cy="59" rx="5" ry="3.5" fill="#292524" />
          <path d="M55 64 Q60 69 65 64" stroke="#292524" stroke-width="2" stroke-linecap="round" fill="none" />
          ${happy ? `
            <path d="M43 50 Q48 45 53 50" stroke="#292524" stroke-width="2.6" stroke-linecap="round" fill="none" />
            <path d="M67 50 Q72 45 77 50" stroke="#292524" stroke-width="2.6" stroke-linecap="round" fill="none" />
          ` : `
            <circle cx="48" cy="49" r="3.2" fill="#292524" /><circle cx="72" cy="49" r="3.2" fill="#292524" />
          `}
          <g class="companion-paw-l"><ellipse cx="30" cy="74" rx="8" ry="11" fill="#a06034" transform="rotate(-30 30 74)" /></g>
          <g class="companion-paw-r"><ellipse cx="90" cy="74" rx="8" ry="11" fill="#a06034" transform="rotate(30 90 74)" /></g>
        </svg>
      `,
    },
    {
      id: "cat",
      name: "Mochi the Cat",
      emoji: "🐱",
      tagline: "Curious, agile & cheerful",
      renderSvg: (happy = true) => `
        <svg viewBox="0 0 120 120" fill="none" class="companion-svg">
          <ellipse cx="60" cy="112" rx="36" ry="6" fill="rgba(0,0,0,0.12)" />
          <!-- Ears -->
          <polygon points="30,46 44,18 56,44" fill="#f97316" /><polygon points="34,44 44,24 52,42" fill="#fbcfe8" />
          <polygon points="90,46 76,18 64,44" fill="#f97316" /><polygon points="86,44 76,24 68,42" fill="#fbcfe8" />
          <ellipse cx="60" cy="80" rx="32" ry="28" fill="#fb923c" />
          <circle cx="60" cy="56" r="30" fill="#fb923c" />
          <!-- Cheeks -->
          <ellipse cx="42" cy="64" rx="5" ry="3.5" fill="#fca5a5" />
          <ellipse cx="78" cy="64" rx="5" ry="3.5" fill="#fca5a5" />
          <!-- Whiskers -->
          <line x1="28" y1="62" x2="40" y2="64" stroke="#7c2d12" stroke-width="1.8" stroke-linecap="round" />
          <line x1="28" y1="68" x2="40" y2="67" stroke="#7c2d12" stroke-width="1.8" stroke-linecap="round" />
          <line x1="92" y1="62" x2="80" y2="64" stroke="#7c2d12" stroke-width="1.8" stroke-linecap="round" />
          <line x1="92" y1="68" x2="80" y2="67" stroke="#7c2d12" stroke-width="1.8" stroke-linecap="round" />
          <!-- Nose & Mouth -->
          <polygon points="57,60 63,60 60,64" fill="#be185d" />
          <path d="M55 65 Q60 69 65 65" stroke="#7c2d12" stroke-width="1.8" stroke-linecap="round" fill="none" />
          ${happy ? `
            <path d="M44 52 Q49 47 54 52" stroke="#7c2d12" stroke-width="2.6" stroke-linecap="round" fill="none" />
            <path d="M66 52 Q71 47 76 52" stroke="#7c2d12" stroke-width="2.6" stroke-linecap="round" fill="none" />
          ` : `
            <ellipse cx="49" cy="52" rx="4" ry="4" fill="#1e293b" /><ellipse cx="71" cy="52" rx="4" ry="4" fill="#1e293b" />
          `}
          <g class="companion-paw-l"><ellipse cx="32" cy="74" rx="7" ry="10" fill="#ea580c" transform="rotate(-25 32 74)" /></g>
          <g class="companion-paw-r"><ellipse cx="88" cy="74" rx="7" ry="10" fill="#ea580c" transform="rotate(25 88 74)" /></g>
        </svg>
      `,
    },
    {
      id: "rabbit",
      name: "Pippin the Rabbit",
      emoji: "🐰",
      tagline: "Bouncy, quick & full of energy",
      renderSvg: (happy = true) => `
        <svg viewBox="0 0 120 120" fill="none" class="companion-svg">
          <ellipse cx="60" cy="112" rx="36" ry="6" fill="rgba(0,0,0,0.12)" />
          <!-- Long Upright Ears -->
          <ellipse cx="44" cy="24" rx="8" ry="22" fill="#f1f5f9" /><ellipse cx="44" cy="24" rx="4.5" ry="16" fill="#fbcfe8" />
          <ellipse cx="76" cy="24" rx="8" ry="22" fill="#f1f5f9" /><ellipse cx="76" cy="24" rx="4.5" ry="16" fill="#fbcfe8" />
          <ellipse cx="60" cy="80" rx="32" ry="28" fill="#e2e8f0" />
          <circle cx="60" cy="58" r="28" fill="#f1f5f9" />
          <ellipse cx="42" cy="65" rx="5" ry="3.5" fill="#fca5a5" />
          <ellipse cx="78" cy="65" rx="5" ry="3.5" fill="#fca5a5" />
          <!-- Snout -->
          <ellipse cx="60" cy="64" rx="3.5" ry="2.5" fill="#f43f5e" />
          <path d="M57 66 Q60 69 63 66" stroke="#475569" stroke-width="1.8" stroke-linecap="round" fill="none" />
          ${happy ? `
            <path d="M45 54 Q49 50 53 54" stroke="#334155" stroke-width="2.6" stroke-linecap="round" fill="none" />
            <path d="M67 54 Q71 50 75 54" stroke="#334155" stroke-width="2.6" stroke-linecap="round" fill="none" />
          ` : `
            <circle cx="49" cy="54" r="3.2" fill="#334155" /><circle cx="71" cy="54" r="3.2" fill="#334155" />
          `}
          <g class="companion-paw-l"><ellipse cx="32" cy="74" rx="7" ry="9" fill="#e2e8f0" /></g>
          <g class="companion-paw-r"><ellipse cx="88" cy="74" rx="7" ry="9" fill="#e2e8f0" /></g>
        </svg>
      `,
    },
    {
      id: "penguin",
      name: "Percy the Penguin",
      emoji: "🐧",
      tagline: "Dapper, polite & celebratory",
      renderSvg: (happy = true) => `
        <svg viewBox="0 0 120 120" fill="none" class="companion-svg">
          <ellipse cx="60" cy="112" rx="36" ry="6" fill="rgba(0,0,0,0.12)" />
          <ellipse cx="60" cy="76" rx="34" ry="32" fill="#1e293b" />
          <!-- White Belly -->
          <ellipse cx="60" cy="78" rx="22" ry="26" fill="#f8fafc" />
          <!-- Head -->
          <circle cx="60" cy="48" r="26" fill="#1e293b" />
          <!-- Cheeks -->
          <ellipse cx="44" cy="54" rx="4.5" ry="3" fill="#fca5a5" />
          <ellipse cx="76" cy="54" rx="4.5" ry="3" fill="#fca5a5" />
          <!-- Orange Beak -->
          <polygon points="54,54 66,54 60,62" fill="#f97316" />
          <!-- Red Bowtie -->
          <polygon points="54,72 66,72 60,76" fill="#ef4444" />
          <polygon points="54,80 66,80 60,76" fill="#ef4444" />
          <circle cx="60" cy="76" r="2.5" fill="#b91c1c" />
          ${happy ? `
            <path d="M46 45 Q50 41 54 45" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round" fill="none" />
            <path d="M66 45 Q70 41 74 45" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round" fill="none" />
          ` : `
            <circle cx="50" cy="45" r="3" fill="#f8fafc" /><circle cx="70" cy="45" r="3" fill="#f8fafc" />
          `}
          <!-- Flippers -->
          <g class="companion-paw-l"><ellipse cx="26" cy="74" rx="7" ry="16" fill="#0f172a" transform="rotate(25 26 74)" /></g>
          <g class="companion-paw-r"><ellipse cx="94" cy="74" rx="7" ry="16" fill="#0f172a" transform="rotate(-25 94 74)" /></g>
          <!-- Feet -->
          <ellipse cx="48" cy="106" rx="9" ry="4" fill="#f97316" />
          <ellipse cx="72" cy="106" rx="9" ry="4" fill="#f97316" />
        </svg>
      `,
    },
    {
      id: "fox",
      name: "Rusty the Fox",
      emoji: "🦊",
      tagline: "Spirited, clever & alert",
      renderSvg: (happy = true) => `
        <svg viewBox="0 0 120 120" fill="none" class="companion-svg">
          <ellipse cx="60" cy="112" rx="36" ry="6" fill="rgba(0,0,0,0.12)" />
          <!-- Fox Ears -->
          <polygon points="26,44 42,14 56,42" fill="#ea580c" /><polygon points="32,40 42,22 50,38" fill="#1e293b" />
          <polygon points="94,44 78,14 64,42" fill="#ea580c" /><polygon points="88,40 78,22 70,38" fill="#1e293b" />
          <ellipse cx="60" cy="80" rx="32" ry="28" fill="#f97316" />
          <circle cx="60" cy="56" r="30" fill="#f97316" />
          <!-- White Muzzle Mask -->
          <path d="M34 58 Q60 84 86 58 Q60 52 34 58 Z" fill="#ffffff" />
          <circle cx="60" cy="65" r="4" fill="#1e293b" />
          <ellipse cx="42" cy="62" rx="5" ry="3" fill="#fca5a5" />
          <ellipse cx="78" cy="62" rx="5" ry="3" fill="#fca5a5" />
          ${happy ? `
            <path d="M44 49 Q49 44 54 49" stroke="#1e293b" stroke-width="2.6" stroke-linecap="round" fill="none" />
            <path d="M66 49 Q71 44 76 49" stroke="#1e293b" stroke-width="2.6" stroke-linecap="round" fill="none" />
          ` : `
            <circle cx="49" cy="49" r="3.4" fill="#1e293b" /><circle cx="71" cy="49" r="3.4" fill="#1e293b" />
          `}
          <g class="companion-paw-l"><ellipse cx="32" cy="76" rx="7" ry="10" fill="#c2410c" transform="rotate(-25 32 76)" /></g>
          <g class="companion-paw-r"><ellipse cx="88" cy="76" rx="7" ry="10" fill="#c2410c" transform="rotate(25 88 76)" /></g>
        </svg>
      `,
    },
    {
      id: "panda",
      name: "Bao the Panda",
      emoji: "🐼",
      tagline: "Gentle, mindful & peaceful",
      renderSvg: (happy = true) => `
        <svg viewBox="0 0 120 120" fill="none" class="companion-svg">
          <ellipse cx="60" cy="112" rx="36" ry="6" fill="rgba(0,0,0,0.12)" />
          <circle cx="34" cy="36" r="14" fill="#1e293b" />
          <circle cx="86" cy="36" r="14" fill="#1e293b" />
          <ellipse cx="60" cy="80" rx="34" ry="30" fill="#f8fafc" />
          <circle cx="60" cy="54" r="32" fill="#ffffff" />
          <!-- Black Eye Patches -->
          <ellipse cx="45" cy="51" rx="8" ry="10" fill="#1e293b" transform="rotate(-15 45 51)" />
          <ellipse cx="75" cy="51" rx="8" ry="10" fill="#1e293b" transform="rotate(15 75 51)" />
          <ellipse cx="40" cy="63" rx="5" ry="3.5" fill="#fca5a5" />
          <ellipse cx="80" cy="63" rx="5" ry="3.5" fill="#fca5a5" />
          <ellipse cx="60" cy="61" rx="5" ry="3.5" fill="#1e293b" />
          <path d="M56 66 Q60 69 64 66" stroke="#1e293b" stroke-width="2" stroke-linecap="round" fill="none" />
          ${happy ? `
            <path d="M42 49 Q46 45 50 49" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" fill="none" />
            <path d="M70 49 Q74 45 78 49" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" fill="none" />
          ` : `
            <circle cx="46" cy="49" r="2.8" fill="#ffffff" /><circle cx="74" cy="49" r="2.8" fill="#ffffff" />
          `}
          <!-- Dark Arms -->
          <g class="companion-paw-l"><ellipse cx="30" cy="76" rx="8" ry="12" fill="#1e293b" transform="rotate(-25 30 76)" /></g>
          <g class="companion-paw-r"><ellipse cx="90" cy="76" rx="8" ry="12" fill="#1e293b" transform="rotate(25 90 76)" /></g>
        </svg>
      `,
    },
    {
      id: "dog",
      name: "Buddy the Pup",
      emoji: "🐶",
      tagline: "Loyal, enthusiastic & friendly",
      renderSvg: (happy = true) => `
        <svg viewBox="0 0 120 120" fill="none" class="companion-svg">
          <ellipse cx="60" cy="112" rx="36" ry="6" fill="rgba(0,0,0,0.12)" />
          <!-- Floppy Ears -->
          <ellipse cx="28" cy="52" rx="10" ry="20" fill="#b45309" transform="rotate(15 28 52)" />
          <ellipse cx="92" cy="52" rx="10" ry="20" fill="#b45309" transform="rotate(-15 92 52)" />
          <ellipse cx="60" cy="80" rx="32" ry="28" fill="#f59e0b" />
          <circle cx="60" cy="54" r="30" fill="#fde68a" />
          <ellipse cx="42" cy="62" rx="5" ry="3.5" fill="#fca5a5" />
          <ellipse cx="78" cy="62" rx="5" ry="3.5" fill="#fca5a5" />
          <ellipse cx="60" cy="58" rx="5.5" ry="4" fill="#1e293b" />
          <!-- Happy Tongue -->
          <path d="M57 65 Q60 74 63 65" fill="#ef4444" />
          ${happy ? `
            <path d="M44 48 Q49 43 54 48" stroke="#1e293b" stroke-width="2.6" stroke-linecap="round" fill="none" />
            <path d="M66 48 Q71 43 76 48" stroke="#1e293b" stroke-width="2.6" stroke-linecap="round" fill="none" />
          ` : `
            <circle cx="49" cy="48" r="3.2" fill="#1e293b" /><circle cx="71" cy="48" r="3.2" fill="#1e293b" />
          `}
          <g class="companion-paw-l"><ellipse cx="32" cy="74" rx="7" ry="10" fill="#d97706" transform="rotate(-25 32 74)" /></g>
          <g class="companion-paw-r"><ellipse cx="88" cy="74" rx="7" ry="10" fill="#d97706" transform="rotate(25 88 74)" /></g>
        </svg>
      `,
    },
    {
      id: "frog",
      name: "Hoppy the Frog",
      emoji: "🐸",
      tagline: "Joyful, vibrant & positive",
      renderSvg: (happy = true) => `
        <svg viewBox="0 0 120 120" fill="none" class="companion-svg">
          <ellipse cx="60" cy="112" rx="36" ry="6" fill="rgba(0,0,0,0.12)" />
          <!-- Big Eye Tufts -->
          <circle cx="40" cy="38" r="14" fill="#22c55e" /><circle cx="40" cy="38" r="9" fill="#ffffff" />
          <circle cx="80" cy="38" r="14" fill="#22c55e" /><circle cx="80" cy="38" r="9" fill="#ffffff" />
          <circle cx="40" cy="38" r="5" fill="#1e293b" /><circle cx="80" cy="38" r="5" fill="#1e293b" />
          <ellipse cx="60" cy="76" rx="34" ry="28" fill="#16a34a" />
          <ellipse cx="60" cy="56" r="28" rx="32" ry="24" fill="#22c55e" />
          <ellipse cx="38" cy="62" rx="5" ry="3.5" fill="#fca5a5" />
          <ellipse cx="82" cy="62" rx="5" ry="3.5" fill="#fca5a5" />
          <!-- Huge Wide Smile -->
          <path d="M42 58 Q60 76 78 58" stroke="#14532d" stroke-width="2.6" stroke-linecap="round" fill="none" />
          <g class="companion-paw-l"><ellipse cx="28" cy="74" rx="7" ry="9" fill="#15803d" /></g>
          <g class="companion-paw-r"><ellipse cx="92" cy="74" rx="7" ry="9" fill="#15803d" /></g>
        </svg>
      `,
    },
    {
      id: "capybara",
      name: "Zen the Capybara",
      emoji: "🦫",
      tagline: "Maximum chill, zen & peaceful",
      renderSvg: (happy = true) => `
        <svg viewBox="0 0 120 120" fill="none" class="companion-svg">
          <ellipse cx="60" cy="112" rx="36" ry="6" fill="rgba(0,0,0,0.12)" />
          <!-- Tiny Orange on Head -->
          <circle cx="60" cy="24" r="9" fill="#f97316" /><ellipse cx="60" cy="14" rx="3" ry="1.5" fill="#22c55e" />
          <!-- Round Ears -->
          <circle cx="34" cy="42" r="8" fill="#78350f" /><circle cx="86" cy="42" r="8" fill="#78350f" />
          <ellipse cx="60" cy="80" rx="36" ry="28" fill="#92400e" />
          <!-- Blocky Cute Capy Head -->
          <rect x="36" y="34" width="48" height="42" rx="18" fill="#b45309" />
          <!-- Chill Squint Eyes -->
          <line x1="42" y1="46" x2="52" y2="46" stroke="#451a03" stroke-width="2.8" stroke-linecap="round" />
          <line x1="68" y1="46" x2="78" y2="46" stroke="#451a03" stroke-width="2.8" stroke-linecap="round" />
          <!-- Broad Snout -->
          <rect x="48" y="56" width="24" height="18" rx="8" fill="#78350f" />
          <ellipse cx="55" cy="62" rx="2" ry="3" fill="#1e293b" /><ellipse cx="65" cy="62" rx="2" ry="3" fill="#1e293b" />
          <path d="M56 68 Q60 71 64 68" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" fill="none" />
          <g class="companion-paw-l"><ellipse cx="34" cy="82" rx="7" ry="10" fill="#78350f" /></g>
          <g class="companion-paw-r"><ellipse cx="86" cy="82" rx="7" ry="10" fill="#78350f" /></g>
        </svg>
      `,
    },
    {
      id: "owl",
      name: "Ollie the Owl",
      emoji: "🦉",
      tagline: "Wise, thoughtful & focused",
      renderSvg: (happy = true) => `
        <svg viewBox="0 0 120 120" fill="none" class="companion-svg">
          <ellipse cx="60" cy="112" rx="36" ry="6" fill="rgba(0,0,0,0.12)" />
          <!-- Feather Tuft Ears -->
          <polygon points="36,36 48,16 54,38" fill="#475569" />
          <polygon points="84,36 72,16 66,38" fill="#475569" />
          <ellipse cx="60" cy="78" rx="32" ry="28" fill="#64748b" />
          <circle cx="60" cy="52" r="28" fill="#94a3b8" />
          <!-- Huge Wise Owl Eyes -->
          <circle cx="46" cy="48" r="12" fill="#ffffff" /><circle cx="46" cy="48" r="7" fill="#f59e0b" /><circle cx="46" cy="48" r="3.5" fill="#0f172a" />
          <circle cx="74" cy="48" r="12" fill="#ffffff" /><circle cx="74" cy="48" r="7" fill="#f59e0b" /><circle cx="74" cy="48" r="3.5" fill="#0f172a" />
          <!-- Beak -->
          <polygon points="57,54 63,54 60,61" fill="#ea580c" />
          <ellipse cx="38" cy="58" rx="4" ry="2.5" fill="#fca5a5" />
          <ellipse cx="82" cy="58" rx="4" ry="2.5" fill="#fca5a5" />
          <!-- Wings -->
          <g class="companion-paw-l"><ellipse cx="30" cy="74" rx="7" ry="14" fill="#475569" transform="rotate(20 30 74)" /></g>
          <g class="companion-paw-r"><ellipse cx="90" cy="74" rx="7" ry="14" fill="#475569" transform="rotate(-20 90 74)" /></g>
        </svg>
      `,
    },
    {
      id: "dinosaur",
      name: "Rex the Dino",
      emoji: "🦕",
      tagline: "Playful, energetic & mighty",
      renderSvg: (happy = true) => `
        <svg viewBox="0 0 120 120" fill="none" class="companion-svg">
          <ellipse cx="60" cy="112" rx="36" ry="6" fill="rgba(0,0,0,0.12)" />
          <!-- Soft Back Spikes -->
          <circle cx="34" cy="30" r="6" fill="#10b981" />
          <circle cx="46" cy="22" r="7" fill="#10b981" />
          <circle cx="60" cy="18" r="8" fill="#10b981" />
          <ellipse cx="60" cy="80" rx="34" ry="28" fill="#059669" />
          <!-- Rounded Dino Head -->
          <ellipse cx="60" cy="52" rx="30" ry="26" fill="#10b981" />
          <ellipse cx="42" cy="58" rx="5" ry="3.5" fill="#fca5a5" />
          <ellipse cx="78" cy="58" rx="5" ry="3.5" fill="#fca5a5" />
          <circle cx="56" cy="58" r="2" fill="#047857" /><circle cx="64" cy="58" r="2" fill="#047857" />
          <path d="M52 64 Q60 70 68 64" stroke="#064e3b" stroke-width="2.2" stroke-linecap="round" fill="none" />
          ${happy ? `
            <path d="M44 46 Q49 41 54 46" stroke="#064e3b" stroke-width="2.6" stroke-linecap="round" fill="none" />
            <path d="M66 46 Q71 41 76 46" stroke="#064e3b" stroke-width="2.6" stroke-linecap="round" fill="none" />
          ` : `
            <circle cx="49" cy="46" r="3.4" fill="#064e3b" /><circle cx="71" cy="46" r="3.4" fill="#064e3b" />
          `}
          <!-- Little Dino Arms -->
          <g class="companion-paw-l"><ellipse cx="34" cy="74" rx="6" ry="8" fill="#047857" /></g>
          <g class="companion-paw-r"><ellipse cx="86" cy="74" rx="6" ry="8" fill="#047857" /></g>
        </svg>
      `,
    },
  ];

  // State & Preferences
  const DEFAULTS = {
    selectedId: "bear",
    customName: "",
    size: "regular", // 'compact', 'regular', 'large'
    customPhotoData: null,
    enabled: true,
    sound: false,
  };

  let state = { ...DEFAULTS };
  let activeCelebrationTimer = null;

  // Encouragement pool
  const MESSAGES = {
    standard: [
      "Great job! You crushed it! 🎉",
      "Another task completed! ✨",
      "Look at you! Pure momentum! 🚀",
      "Awesome work! Keep moving forward! 💪",
      "High five! That was a solid win! 🐾",
      "One step closer to your goals! 🎯",
    ],
    first_completed: [
      "First win of the day! Great start! 🌟",
      "Off to a great start today! Keep going! 🚀",
    ],
    five_completed: [
      "5 tasks done today! You're unstoppable! 🔥",
      "5 wins in the bag! Super productive! 🏆",
    ],
    all_completed: [
      "WOOHOO! All tasks cleared for today! 🥳🎉👑",
      "Victory! You cleared your whole list! Incredible! 🌟",
    ],
  };

  /**
   * Spawns confetti particles around celebration stage
   */
  function spawnConfetti(container) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const colors = ["#ff6b6b", "#4f46e5", "#10b981", "#fbbf24", "#ec4899", "#8b5cf6"];
    const count = 22;

    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "mascot-confetti-particle";
      p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      p.style.left = `${45 + (Math.random() * 30 - 15)}%`;
      p.style.top = `${60 + (Math.random() * 20 - 10)}%`;

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

  // Track celebrated tasks in sessionStorage to prevent duplicate celebrations on refresh or repeated synchronization
  const celebratedTaskIds = new Set(
    JSON.parse(sessionStorage.getItem("daybook_celebrated_tasks") || "[]")
  );

  /**
   * Spawns confetti particles around celebration stage
   */
  function spawnConfetti(container) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const colors = ["#ff6b6b", "#4f46e5", "#10b981", "#fbbf24", "#ec4899", "#8b5cf6"];
    const count = 22;

    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "mascot-confetti-particle";
      p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      p.style.left = `${45 + (Math.random() * 30 - 15)}%`;
      p.style.top = `${60 + (Math.random() * 20 - 10)}%`;

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
   * Triggers motivational celebration with a specific companion (or active one)
   */
  function celebrate(milestone = "standard", customText = null, overrideCompanionId = null) {
    if (!state.enabled && !overrideCompanionId) return;

    dismiss();

    const pool = MESSAGES[milestone] || MESSAGES.standard;
    const msg = customText || pool[Math.floor(Math.random() * pool.length)];

    const stage = document.createElement("div");
    stage.id = "companion-celebration-stage";
    stage.className = `mascot-stage size-${state.size}`;
    stage.setAttribute("role", "status");
    stage.setAttribute("aria-live", "polite");

    const targetId = overrideCompanionId || state.selectedId;

    // Companion Graphic (SVG or Custom Uploaded Photo)
    let graphicHtml = "";
    if (targetId === "custom" && state.customPhotoData) {
      graphicHtml = `
        <div class="companion-custom-frame">
          <img src="${state.customPhotoData}" alt="Companion" class="companion-custom-img">
        </div>
      `;
    } else {
      const companion = COMPANIONS.find((c) => c.id === targetId) || COMPANIONS[0];
      graphicHtml = companion.renderSvg(true);
    }

    const displayName = state.customName || 
      (targetId === "custom" ? "Custom Companion" : (COMPANIONS.find(c => c.id === targetId)?.name || "Companion"));

    stage.innerHTML = `
      <div class="mascot-character-wrapper">
        <div class="mascot-speech-bubble">
          <span class="companion-speaker-tag">${displayName}</span>
          <span class="mascot-speech-text">${msg}</span>
          <div class="mascot-speech-tail"></div>
        </div>
        <div class="mascot-bear-body">
          ${graphicHtml}
        </div>
        <div class="mascot-sparkle s1">✨</div>
        <div class="mascot-sparkle s2">⭐</div>
        <div class="mascot-sparkle s3">✨</div>
      </div>
    `;

    stage.addEventListener("click", () => dismiss());
    document.body.appendChild(stage);

    spawnConfetti(stage);

    activeCelebrationTimer = setTimeout(() => {
      dismiss();
    }, 3400);
  }

  /**
   * Prevents duplicate celebration caused by page refreshes or repeated sync
   */
  function celebrateTaskCompletion(taskId, milestone = "standard") {
    if (!state.enabled) return;
    if (taskId) {
      const strId = String(taskId);
      if (celebratedTaskIds.has(strId)) {
        return; // Already celebrated! Prevent duplicate popup
      }
      celebratedTaskIds.add(strId);
      try {
        sessionStorage.setItem("daybook_celebrated_tasks", JSON.stringify([...celebratedTaskIds]));
      } catch (e) {}
    }
    celebrate(milestone);
  }

  function dismiss() {
    if (activeCelebrationTimer) {
      clearTimeout(activeCelebrationTimer);
      activeCelebrationTimer = null;
    }
    const stage = document.getElementById("companion-celebration-stage");
    if (stage) {
      stage.classList.add("mascot-exit");
      setTimeout(() => {
        if (stage.parentNode) stage.parentNode.removeChild(stage);
      }, 300);
    }
  }

  /**
   * Sets companion selection and persists locally and remotely
   */
  async function selectCompanion(id) {
    if (id === "disabled") {
      state.enabled = false;
      saveState();
      syncPreferencesToServer();
      renderGalleryUI();
      if (window.showToast) window.showToast("Mascot celebrations disabled");
      return;
    }

    state.enabled = true;
    state.selectedId = id;
    saveState();
    syncPreferencesToServer();
    renderGalleryUI();
    const comp = COMPANIONS.find((c) => c.id === id);
    celebrate("standard", `Hello! I'm ${comp ? comp.name : "ready"}! Let's get things done! ✨`);
  }

  /**
   * Crops and applies custom uploaded photo
   */
  async function setCustomPhoto(dataUrl) {
    state.customPhotoData = dataUrl;
    state.selectedId = "custom";
    state.enabled = true;
    saveState();

    // Persist to IndexedDB for offline resilience
    if (window.OfflineStorage) {
      await window.OfflineStorage.saveCustomPhoto(dataUrl);
    }

    // Upload to server or queue if offline
    syncCustomPhotoToServer(dataUrl);

    renderGalleryUI();
    celebrate("standard", `Photo uploaded! Looking sharp! 📸`);
  }

  async function removeCustomPhoto() {
    state.customPhotoData = null;
    if (state.selectedId === "custom") state.selectedId = "bear";
    saveState();

    if (window.OfflineStorage) {
      await window.OfflineStorage.removeCustomPhoto();
    }

    try {
      const apiUrl = window.DaybookConfig ? window.DaybookConfig.apiUrl("/api/companion/photo") : "/api/companion/photo";
      fetch(apiUrl, { method: "DELETE" }).catch(() => {});
    } catch (e) {}

    syncPreferencesToServer();
    renderGalleryUI();
  }

  function saveState() {
    localStorage.setItem("daybook_companion", JSON.stringify(state));
  }

  async function loadState() {
    const cached = localStorage.getItem("daybook_companion");
    if (cached) {
      try {
        state = { ...DEFAULTS, ...JSON.parse(cached) };
      } catch (e) {}
    }

    // Try loading custom photo from IndexedDB if active
    if (window.OfflineStorage && (!state.customPhotoData || state.selectedId === "custom")) {
      try {
        const idbPhoto = await window.OfflineStorage.getCustomPhoto();
        if (idbPhoto) {
          state.customPhotoData = idbPhoto;
        }
      } catch (e) {}
    }
  }

  async function syncPreferencesToServer() {
    const payload = {
      companion_id: state.enabled ? state.selectedId : "disabled",
      companion_name: state.customName || "",
      companion_size: state.size || "regular",
      companion_enabled: state.enabled ? 1 : 0,
      mascot_enabled: state.enabled ? 1 : 0,
    };

    try {
      const apiUrl = window.DaybookConfig ? window.DaybookConfig.apiUrl("/api/preferences") : "/api/preferences";
      if (navigator.onLine) {
        await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else if (window.OfflineStorage) {
        window.OfflineStorage.enqueueAction("UPDATE_PREFERENCES", payload);
      }
    } catch (err) {
      if (window.OfflineStorage) {
        window.OfflineStorage.enqueueAction("UPDATE_PREFERENCES", payload);
      }
    }
  }

  async function syncCustomPhotoToServer(dataUrl) {
    try {
      const apiUrl = window.DaybookConfig ? window.DaybookConfig.apiUrl("/api/companion/upload") : "/api/companion/upload";
      if (navigator.onLine) {
        await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo_data: dataUrl }),
        });
      } else if (window.OfflineStorage) {
        window.OfflineStorage.enqueueAction("UPLOAD_COMPANION_PHOTO", dataUrl);
      }
    } catch (err) {
      if (window.OfflineStorage) {
        window.OfflineStorage.enqueueAction("UPLOAD_COMPANION_PHOTO", dataUrl);
      }
    }
  }

  /**
   * Renders the Companion Gallery in Settings with accessible controls and preview buttons
   */
  function renderGalleryUI() {
    const container = document.getElementById("companion-gallery-grid");
    if (!container) return;

    let html = COMPANIONS.map((c) => {
      const isSelected = state.enabled && state.selectedId === c.id;
      return `
        <div class="companion-card ${isSelected ? "selected" : ""}" 
             data-companion-id="${c.id}" 
             tabindex="0" 
             role="button" 
             aria-pressed="${isSelected}"
             aria-label="${c.name} - ${c.tagline}">
          <div class="companion-preview-box">
            ${c.renderSvg(false)}
            ${isSelected ? `<span class="companion-check-badge">✓</span>` : ""}
          </div>
          <span class="companion-card-name">${c.name}</span>
          <span class="companion-card-tagline">${c.tagline}</span>
          <button type="button" class="companion-preview-btn" data-preview-id="${c.id}" title="Preview celebration animation">
            Preview ✨
          </button>
        </div>
      `;
    }).join("");

    // Custom Photo Card
    const isCustomSelected = state.enabled && state.selectedId === "custom";
    html += `
      <div class="companion-card ${isCustomSelected ? "selected" : ""}" 
           data-companion-id="custom" 
           tabindex="0" 
           role="button" 
           aria-pressed="${isCustomSelected}"
           aria-label="Custom Gallery Photo">
        <div class="companion-preview-box custom-photo-box">
          ${
            state.customPhotoData
              ? `<img src="${state.customPhotoData}" class="custom-photo-thumb" alt="Custom">`
              : `<span class="custom-photo-placeholder">📷</span>`
          }
          ${isCustomSelected ? `<span class="companion-check-badge">✓</span>` : ""}
        </div>
        <span class="companion-card-name">Custom Photo</span>
        <span class="companion-card-tagline">${state.customPhotoData ? "Gallery Photo Active" : "Upload from phone"}</span>
        ${
          state.customPhotoData
            ? `<button type="button" class="companion-preview-btn" data-preview-id="custom">Preview ✨</button>`
            : ""
        }
      </div>
    `;

    // Disabled / None Card
    const isDisabledSelected = !state.enabled;
    html += `
      <div class="companion-card ${isDisabledSelected ? "selected" : ""}" 
           data-companion-id="disabled" 
           tabindex="0" 
           role="button" 
           aria-pressed="${isDisabledSelected}"
           aria-label="Disable Animal Companion">
        <div class="companion-preview-box">
          <span style="font-size: 1.8rem;">🚫</span>
          ${isDisabledSelected ? `<span class="companion-check-badge">✓</span>` : ""}
        </div>
        <span class="companion-card-name">None (Disabled)</span>
        <span class="companion-card-tagline">Clean workspace without mascot</span>
      </div>
    `;

    container.innerHTML = html;

    // Bind card selection clicks & keyboard
    container.querySelectorAll(".companion-card").forEach((card) => {
      const handleSelect = (e) => {
        // Prevent preview button click from triggering card selection
        if (e.target.closest(".companion-preview-btn")) return;
        const id = card.dataset.companionId;
        if (id === "custom" && !state.customPhotoData) {
          document.getElementById("companion-photo-input")?.click();
        } else {
          selectCompanion(id);
        }
      };

      card.addEventListener("click", handleSelect);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect(e);
        }
      });
    });

    // Bind preview buttons
    container.querySelectorAll(".companion-preview-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const prevId = btn.dataset.previewId;
        celebrate("standard", null, prevId);
      });
    });

    // Sync input fields
    const nameInput = document.getElementById("companion-nickname-input");
    if (nameInput) nameInput.value = state.customName || "";

    const sizeBtns = document.querySelectorAll("[data-companion-size]");
    sizeBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.companionSize === state.size);
    });

    const removeBtn = document.getElementById("btn-remove-custom-photo");
    if (removeBtn) {
      removeBtn.style.display = state.customPhotoData ? "inline-flex" : "none";
    }

    const disableBtn = document.getElementById("btn-toggle-companion-disable");
    if (disableBtn) {
      disableBtn.textContent = state.enabled ? "Disable Mascot" : "Enable Mascot";
      disableBtn.classList.toggle("btn-danger-soft", state.enabled);
    }
  }

  /**
   * Initializes Crop & Reposition Modal
   */
  function initCropModal() {
    const modal = document.getElementById("companion-crop-modal");
    const sourceImg = document.getElementById("crop-source-image");
    const zoomSlider = document.getElementById("crop-zoom-slider");
    const panXSlider = document.getElementById("crop-panx-slider");
    const panYSlider = document.getElementById("crop-pany-slider");
    const btnCancel = document.getElementById("btn-cancel-crop");
    const btnClose = document.getElementById("btn-close-crop-modal");
    const btnApply = document.getElementById("btn-apply-crop");

    if (!modal || !sourceImg) return;

    let originalDataUrl = null;

    function updatePreviewTransform() {
      const zoom = zoomSlider ? zoomSlider.value : 1;
      const px = panXSlider ? panXSlider.value : 0;
      const py = panYSlider ? panYSlider.value : 0;
      sourceImg.style.transform = `scale(${zoom}) translate(${px}px, ${py}px)`;
    }

    if (zoomSlider) zoomSlider.addEventListener("input", updatePreviewTransform);
    if (panXSlider) panXSlider.addEventListener("input", updatePreviewTransform);
    if (panYSlider) panYSlider.addEventListener("input", updatePreviewTransform);

    function closeModal() {
      modal.classList.remove("active");
      const fileInput = document.getElementById("companion-photo-input");
      if (fileInput) fileInput.value = "";
    }

    if (btnCancel) btnCancel.addEventListener("click", closeModal);
    if (btnClose) btnClose.addEventListener("click", closeModal);

    // Crop via offscreen canvas
    if (btnApply) {
      btnApply.addEventListener("click", () => {
        if (!originalDataUrl) return;

        const canvas = document.createElement("canvas");
        const size = 240;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");

        const img = new Image();
        img.onload = () => {
          // Circular clip
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          const zoom = parseFloat(zoomSlider ? zoomSlider.value : 1);
          const panX = parseFloat(panXSlider ? panXSlider.value : 0);
          const panY = parseFloat(panYSlider ? panYSlider.value : 0);

          // Center draw
          const scale = Math.max(size / img.width, size / img.height) * zoom;
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const drawX = (size - drawW) / 2 + panX;
          const drawY = (size - drawH) / 2 + panY;

          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          const croppedDataUrl = canvas.toDataURL("image/png");
          setCustomPhoto(croppedDataUrl);
          closeModal();
          if (window.showToast) window.showToast("Custom companion photo updated! 📸");
        };
        img.src = originalDataUrl;
      });
    }

    // Opens modal with selected image
    window.openCompanionCropModal = (dataUrl) => {
      originalDataUrl = dataUrl;
      sourceImg.src = dataUrl;
      if (zoomSlider) zoomSlider.value = 1;
      if (panXSlider) panXSlider.value = 0;
      if (panYSlider) panYSlider.value = 0;
      updatePreviewTransform();
      modal.classList.add("active");
    };
  }

  async function init() {
    await loadState();
    renderGalleryUI();
    initCropModal();

    // Photo file picker listener
    const photoInput = document.getElementById("companion-photo-input");
    if (photoInput) {
      photoInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (!validTypes.includes(file.type)) {
          if (window.showToast) window.showToast("Please choose a valid image (PNG, JPG, WebP)");
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          if (window.showToast) window.showToast("Image size must be under 5MB");
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          if (window.openCompanionCropModal) {
            window.openCompanionCropModal(event.target.result);
          } else {
            setCustomPhoto(event.target.result);
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // Remove photo button
    const removeBtn = document.getElementById("btn-remove-custom-photo");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        removeCustomPhoto();
        if (window.showToast) window.showToast("Custom photo removed");
      });
    }

    // Toggle disable button
    const disableBtn = document.getElementById("btn-toggle-companion-disable");
    if (disableBtn) {
      disableBtn.addEventListener("click", () => {
        state.enabled = !state.enabled;
        saveState();
        syncPreferencesToServer();
        renderGalleryUI();
        if (window.showToast) {
          window.showToast(state.enabled ? "Companion enabled! ✨" : "Companion disabled 🚫");
        }
      });
    }

    // Nickname input listener (debounced)
    const nameInput = document.getElementById("companion-nickname-input");
    if (nameInput) {
      nameInput.addEventListener("input", (e) => {
        state.customName = e.target.value.trim();
        saveState();
        syncPreferencesToServer();
      });
    }

    // Size buttons
    document.querySelectorAll("[data-companion-size]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.size = btn.dataset.companionSize;
        saveState();
        syncPreferencesToServer();
        renderGalleryUI();
      });
    });

    // Test celebration trigger
    const testBtn = document.getElementById("btn-test-companion");
    if (testBtn) {
      testBtn.addEventListener("click", () => {
        celebrate("standard", "Testing companion celebration! Looking awesome! 🎉");
      });
    }

    // Backward compatibility with window.Mascot
    window.Mascot = {
      celebrate: (milestone, msg) => celebrate(milestone, msg),
      celebrateTaskCompletion: (taskId, milestone) => celebrateTaskCompletion(taskId, milestone),
      dismiss: () => dismiss(),
      setEnabled: (val) => { state.enabled = Boolean(val); saveState(); syncPreferencesToServer(); renderGalleryUI(); },
      setMuted: (val) => { state.sound = !Boolean(val); saveState(); },
    };
  }

  return {
    init,
    celebrate,
    celebrateTaskCompletion,
    dismiss,
    selectCompanion,
    setCustomPhoto,
    removeCustomPhoto,
    COMPANIONS,
  };
})();

window.CompanionManager = CompanionManager;

