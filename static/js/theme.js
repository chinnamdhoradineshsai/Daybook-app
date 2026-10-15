/**
 * DAYBOOK — Appearance & Theme Customization Engine
 * Section 19: Full Design System Customization & Live Preview
 * Feature: Custom Photo Background and Dynamic Theme
 */

const ThemeManager = (() => {
  // Default tokens - Charcoal Dark Mode with Vibrant Purple Accent
  const DEFAULTS = {
    themeMode: "dark", // 'dark', 'light', 'system'
    accentColor: "#8b5cf6",
    fontSize: "normal", // 'compact', 'normal', 'large'
    layoutDensity: "comfortable", // 'comfortable', 'compact'
    cardRadius: "rounded", // 'rounded', 'subtle'
    mascotEnabled: true,
    mascotSound: true,
    // Custom Photo Background tokens
    customBgEnabled: false,
    customBgFit: "cover", // 'cover' or 'contain'
    customBgPosition: "center", // 'center', 'top', 'bottom', 'left', 'right'
    customBgOverlayMode: "dark", // 'dark', 'light', 'auto'
    customBgOverlayOpacity: 0.45, // 0.0 to 0.90
    customBgBlur: 0, // 0 to 25px
    customBgDynamicAccent: true, // boolean
    customBgAccentColor: null, // extracted complementary hex
    customBgImageUrl: null, // file URL or cached dataUrl
  };

  // Preset color options
  const PRESET_ACCENTS = [
    { name: "Violet", hex: "#8b5cf6" },
    { name: "Indigo", hex: "#4f46e5" },
    { name: "Emerald", hex: "#10b981" },
    { name: "Coral", hex: "#f43f5e" },
    { name: "Ocean", hex: "#06b6d4" },
    { name: "Amber", hex: "#f59e0b" },
  ];

  // Current state & background caches
  let currentPrefs = { ...DEFAULTS };
  let stagedBg = null; // Staged photo/settings awaiting user "Apply"
  let cachedBgDataUrl = null; // Active background image dataUrl or URL
  let imageAnalysis = null; // { dominantAccent, isDarkImage, luminance }

  /**
   * Helper: Calculates darker/lighter hex for hover & subtle states
   */
  function adjustColor(hex, lum) {
    hex = String(hex).replace(/[^0-9a-f]/gi, "");
    if (hex.length < 6) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    lum = lum || 0;
    let rgb = "#", c, i;
    for (i = 0; i < 3; i++) {
      c = parseInt(hex.substr(i * 2, 2), 16);
      c = Math.round(Math.min(Math.max(0, c + c * lum), 255)).toString(16);
      rgb += ("00" + c).substr(c.length);
    }
    return rgb;
  }

  /**
   * Extracts dominant vibrant accent color and calculates luminance
   */
  function analyzeImage(img) {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width = 64;
      canvas.height = 64;
      ctx.drawImage(img, 0, 0, 64, 64);
      const imgData = ctx.getImageData(0, 0, 64, 64).data;

      let totalR = 0, totalG = 0, totalB = 0, count = 0;
      let bestR = 139, bestG = 92, bestB = 246; // fallback violet
      let maxScore = -1;

      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        const a = imgData[i + 3];
        if (a < 128) continue;

        totalR += r;
        totalG += g;
        totalB += b;
        count++;

        // Convert to HSL for scoring
        const rNorm = r / 255, gNorm = g / 255, bNorm = b / 255;
        const max = Math.max(rNorm, gNorm, bNorm);
        const min = Math.min(rNorm, gNorm, bNorm);
        const l = (max + min) / 2;
        let s = 0;
        if (max !== min) {
          s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
        }

        // We want a punchy, vibrant accent: avoid dull grays (s < 0.25) and near black/white
        if (s > 0.25 && l > 0.28 && l < 0.82) {
          const score = s * 2.5 + (1 - Math.abs(l - 0.55));
          if (score > maxScore) {
            maxScore = score;
            bestR = r;
            bestG = g;
            bestB = b;
          }
        }
      }

      const avgR = count ? totalR / count : 128;
      const avgG = count ? totalG / count : 128;
      const avgB = count ? totalB / count : 128;
      const luminance = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;

      const toHex = (c) => {
        const hex = Math.round(c).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      };
      const dominantAccent = `#${toHex(bestR)}${toHex(bestG)}${toHex(bestB)}`;

      return {
        dominantAccent,
        isDarkImage: luminance < 0.5,
        luminance,
      };
    } catch (e) {
      console.warn("[ThemeManager] Image analysis failed, using fallback:", e);
      return {
        dominantAccent: "#8b5cf6",
        isDarkImage: true,
        luminance: 0.35,
      };
    }
  }

  /**
   * Resizes large images using canvas to prevent browser lag and save storage
   */
  function processAndOptimizeImage(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/i)) {
        return reject(new Error("Unsupported image format. Please select a JPEG, PNG, or WebP photo."));
      }
      if (file.size > 15 * 1024 * 1024) {
        return reject(new Error("Image size exceeds 15MB limit. Please choose a smaller photo."));
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Selected file appears to be corrupted or not a valid image."));
        img.onload = () => {
          // Max dimensions: 1920x1080
          const MAX_DIM = 1920;
          let w = img.width;
          let h = img.height;
          if (w > MAX_DIM || h > MAX_DIM) {
            if (w > h) {
              h = Math.round((h * MAX_DIM) / w);
              w = MAX_DIM;
            } else {
              w = Math.round((w * MAX_DIM) / h);
              h = MAX_DIM;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);

          let dataUrl = canvas.toDataURL("image/webp", 0.88);
          if (!dataUrl || dataUrl.startsWith("data:,")) {
            dataUrl = canvas.toDataURL("image/jpeg", 0.88);
          }

          const analysis = analyzeImage(img);

          resolve({
            dataUrl,
            width: w,
            height: h,
            analysis,
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Applies CSS custom properties live to document root
   */
  function applyTokens() {
    const root = document.documentElement;

    // 1. Theme Mode (Light / Dark / System)
    let effectiveTheme = currentPrefs.themeMode;
    if (effectiveTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      effectiveTheme = prefersDark ? "dark" : "light";
    }
    root.setAttribute("data-theme", effectiveTheme);

    // 2. Custom Background State & Backdrop Layer
    const hasActiveBg = Boolean(currentPrefs.customBgEnabled && (cachedBgDataUrl || currentPrefs.customBgImageUrl));
    const bgBackdrop = document.getElementById("custom-bg-backdrop");
    const bgImage = document.getElementById("custom-bg-image");
    const bgScrim = document.getElementById("custom-bg-scrim");

    if (hasActiveBg) {
      root.setAttribute("data-custom-bg", "true");
      const activeUrl = cachedBgDataUrl || currentPrefs.customBgImageUrl;

      if (bgBackdrop) bgBackdrop.style.display = "block";
      if (bgImage) {
        bgImage.style.backgroundImage = `url("${activeUrl}")`;
        bgImage.style.backgroundSize = currentPrefs.customBgFit || "cover";
        bgImage.style.backgroundPosition = currentPrefs.customBgPosition || "center";
        bgImage.style.filter = `blur(${currentPrefs.customBgBlur || 0}px)`;
      }

      // Compute scrim color based on overlay mode and opacity
      const opacity = currentPrefs.customBgOverlayOpacity ?? 0.45;
      let scrimColor = `rgba(10, 11, 15, ${opacity})`;

      if (currentPrefs.customBgOverlayMode === "light") {
        scrimColor = `rgba(246, 248, 252, ${opacity})`;
      } else if (currentPrefs.customBgOverlayMode === "auto") {
        const isDark = imageAnalysis ? imageAnalysis.isDarkImage : effectiveTheme === "dark";
        scrimColor = isDark ? `rgba(10, 11, 15, ${opacity})` : `rgba(246, 248, 252, ${opacity})`;
      } else {
        // dark mode overlay
        scrimColor = `rgba(10, 11, 15, ${opacity})`;
      }

      if (bgScrim) {
        bgScrim.style.background = scrimColor;
      }
      root.style.setProperty("--custom-bg-scrim-color", scrimColor);
    } else {
      root.removeAttribute("data-custom-bg");
      if (bgBackdrop) bgBackdrop.style.display = "none";
    }

    // 3. Accent Color (Custom Photo Dynamic Accent vs User Selected)
    let accent = currentPrefs.accentColor || DEFAULTS.accentColor;
    if (hasActiveBg && currentPrefs.customBgDynamicAccent && currentPrefs.customBgAccentColor) {
      accent = currentPrefs.customBgAccentColor;
    }

    const accentHover = adjustColor(accent, -0.15);
    const accentBorder = adjustColor(accent, 0.4);

    root.style.setProperty("--accent-primary", accent);
    root.style.setProperty("--accent-hover", accentHover);
    root.style.setProperty("--accent-border", accentBorder);

    // Subtle background tint depending on light/dark mode
    if (effectiveTheme === "dark") {
      root.style.setProperty("--accent-subtle", `${accent}28`); // 16% opacity
    } else {
      root.style.setProperty("--accent-subtle", `${accent}16`); // 9% opacity
    }

    // 4. Font Size Scale
    const fontSizes = {
      compact: "14px",
      normal: "15px",
      large: "16.5px",
    };
    root.style.setProperty("--font-size-base", fontSizes[currentPrefs.fontSize] || "15px");

    // 5. Layout Density
    const densities = {
      comfortable: "18px",
      compact: "12px",
    };
    root.style.setProperty("--spacing-density", densities[currentPrefs.layoutDensity] || "18px");
    root.setAttribute("data-density", currentPrefs.layoutDensity);

    // 6. Card Radius
    const radii = {
      rounded: "18px",
      subtle: "8px",
    };
    root.style.setProperty("--radius-lg", radii[currentPrefs.cardRadius] || "18px");
    root.setAttribute("data-radius", currentPrefs.cardRadius);

    // 7. Sync Mascot Settings
    if (window.Mascot) {
      window.Mascot.setEnabled(currentPrefs.mascotEnabled);
      window.Mascot.setMuted(!currentPrefs.mascotSound);
    }

    // Update Live Preview UI in Settings if mounted
    updatePreviewUI();
    updateBgPreviewMockup();
  }

  /**
   * Updates Live Preview Mockup in Settings -> Custom Background
   */
  function updateBgPreviewMockup() {
    const previewImage = document.getElementById("bg-preview-image");
    const previewScrim = document.getElementById("bg-preview-scrim");
    const statusBadge = document.getElementById("bg-preview-status-badge");
    const accentChip = document.getElementById("bg-preview-accent-chip");
    const pendingActions = document.getElementById("bg-pending-actions");
    const restoreBtn = document.getElementById("btn-restore-default-bg");
    const controlsWrap = document.getElementById("custom-bg-controls");
    const uploadBtnText = document.getElementById("btn-upload-text");

    const effective = stagedBg || (currentPrefs.customBgEnabled && (cachedBgDataUrl || currentPrefs.customBgImageUrl) ? currentPrefs : null);
    const imageUrl = stagedBg ? stagedBg.dataUrl : (cachedBgDataUrl || currentPrefs.customBgImageUrl);

    if (effective && imageUrl) {
      if (controlsWrap) controlsWrap.style.display = "block";
      if (restoreBtn) restoreBtn.style.display = "inline-flex";
      if (uploadBtnText) uploadBtnText.textContent = "Change Photo";

      if (previewImage) {
        previewImage.style.backgroundImage = `url("${imageUrl}")`;
        previewImage.style.backgroundSize = effective.customBgFit || "cover";
        previewImage.style.backgroundPosition = effective.customBgPosition || "center";
        previewImage.style.filter = `blur(${effective.customBgBlur || 0}px)`;
        previewImage.style.display = "block";
      }

      const opacity = effective.customBgOverlayOpacity ?? 0.45;
      let scrimColor = `rgba(10, 11, 15, ${opacity})`;
      if (effective.customBgOverlayMode === "light") {
        scrimColor = `rgba(246, 248, 252, ${opacity})`;
      } else if (effective.customBgOverlayMode === "auto") {
        const isDark = imageAnalysis ? imageAnalysis.isDarkImage : true;
        scrimColor = isDark ? `rgba(10, 11, 15, ${opacity})` : `rgba(246, 248, 252, ${opacity})`;
      }

      if (previewScrim) {
        previewScrim.style.background = scrimColor;
        previewScrim.style.display = "block";
      }

      if (statusBadge) {
        statusBadge.textContent = stagedBg ? "Previewing (Unsaved)" : "Custom Background Active";
        statusBadge.style.color = stagedBg ? "var(--accent-primary)" : "var(--color-success, #10b981)";
      }

      // Sync active accent swatch in mockup
      const activeAccent = (effective.customBgDynamicAccent && effective.customBgAccentColor) ? effective.customBgAccentColor : currentPrefs.accentColor;
      if (accentChip) {
        accentChip.style.background = `${activeAccent}33`;
        accentChip.style.color = activeAccent;
        accentChip.style.borderColor = activeAccent;
      }

      // Sync dynamic accent swatch preview
      const extractedSwatch = document.getElementById("bg-extracted-swatch");
      if (extractedSwatch && effective.customBgAccentColor) {
        extractedSwatch.style.setProperty("--swatch-color", effective.customBgAccentColor);
        extractedSwatch.title = `Dominant color: ${effective.customBgAccentColor}`;
      }
    } else {
      // Default theme mockup
      if (controlsWrap) controlsWrap.style.display = "none";
      if (restoreBtn) restoreBtn.style.display = "none";
      if (uploadBtnText) uploadBtnText.textContent = "Choose Photo";

      if (previewImage) {
        previewImage.style.backgroundImage = "none";
        previewImage.style.display = "none";
      }
      if (previewScrim) {
        previewScrim.style.display = "none";
      }
      if (statusBadge) {
        statusBadge.textContent = "Default Theme";
        statusBadge.style.color = "var(--text-secondary)";
      }
      if (accentChip) {
        accentChip.style.background = "var(--accent-subtle)";
        accentChip.style.color = "var(--accent-primary)";
        accentChip.style.borderColor = "var(--border-subtle)";
      }
    }

    if (pendingActions) {
      pendingActions.style.display = stagedBg ? "inline-flex" : "none";
    }
  }

  /**
   * Updates Settings UI controls to reflect state
   */
  function updatePreviewUI() {
    // Sync theme buttons
    document.querySelectorAll(".theme-mode-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === currentPrefs.themeMode);
    });

    // Sync accent swatches
    const effectiveAccent = (currentPrefs.customBgEnabled && currentPrefs.customBgDynamicAccent && currentPrefs.customBgAccentColor)
      ? currentPrefs.customBgAccentColor
      : currentPrefs.accentColor;

    document.querySelectorAll(".accent-swatch").forEach((swatch) => {
      if (swatch.id === "bg-extracted-swatch") return;
      swatch.classList.toggle("active", swatch.dataset.color.toLowerCase() === effectiveAccent.toLowerCase());
    });

    const customColorInput = document.getElementById("pref-custom-accent");
    if (customColorInput) {
      customColorInput.value = effectiveAccent;
    }

    // Sync font buttons
    document.querySelectorAll(".font-size-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.size === currentPrefs.fontSize);
    });

    // Sync density buttons
    document.querySelectorAll(".density-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.density === currentPrefs.layoutDensity);
    });

    // Sync radius buttons
    document.querySelectorAll(".radius-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.radius === currentPrefs.cardRadius);
    });

    // Mascot toggles
    const mascotToggle = document.getElementById("pref-mascot-toggle");
    if (mascotToggle) mascotToggle.checked = Boolean(currentPrefs.mascotEnabled);

    const soundToggle = document.getElementById("pref-sound-toggle");
    if (soundToggle) soundToggle.checked = Boolean(currentPrefs.mascotSound);

    // Sync Custom Background Controls
    const activeFit = stagedBg ? stagedBg.customBgFit : currentPrefs.customBgFit;
    document.querySelectorAll(".bg-fit-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.fit === activeFit);
    });

    const activePos = stagedBg ? stagedBg.customBgPosition : currentPrefs.customBgPosition;
    document.querySelectorAll(".bg-pos-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.pos === activePos);
    });

    const activeOverlay = stagedBg ? stagedBg.customBgOverlayMode : currentPrefs.customBgOverlayMode;
    document.querySelectorAll(".bg-overlay-mode-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.overlay === activeOverlay);
    });

    const activeOpacity = Math.round(((stagedBg ? stagedBg.customBgOverlayOpacity : currentPrefs.customBgOverlayOpacity) ?? 0.45) * 100);
    const opacitySlider = document.getElementById("bg-opacity-slider");
    const opacityBadge = document.getElementById("bg-opacity-value-badge");
    if (opacitySlider) opacitySlider.value = activeOpacity;
    if (opacityBadge) opacityBadge.textContent = `${activeOpacity}%`;

    const activeBlur = stagedBg ? stagedBg.customBgBlur : currentPrefs.customBgBlur;
    const blurSlider = document.getElementById("bg-blur-slider");
    const blurBadge = document.getElementById("bg-blur-value-badge");
    if (blurSlider) blurSlider.value = activeBlur ?? 0;
    if (blurBadge) blurBadge.textContent = `${activeBlur ?? 0}px`;

    const activeDynAccent = stagedBg ? stagedBg.customBgDynamicAccent : currentPrefs.customBgDynamicAccent;
    const dynAccentToggle = document.getElementById("bg-dynamic-accent-toggle");
    if (dynAccentToggle) dynAccentToggle.checked = Boolean(activeDynAccent);
  }

  /**
   * Saves preferences locally and sends to backend API
   */
  async function savePreferences() {
    try {
      localStorage.setItem("daybook_appearance", JSON.stringify(currentPrefs));
    } catch (e) {
      console.warn("Could not write appearance to localStorage:", e);
    }

    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme_mode: currentPrefs.themeMode,
          accent_color: currentPrefs.accentColor,
          font_size: currentPrefs.fontSize,
          layout_density: currentPrefs.layoutDensity,
          card_radius: currentPrefs.cardRadius,
          mascot_enabled: currentPrefs.mascotEnabled ? 1 : 0,
          mascot_sound: currentPrefs.mascotSound ? 1 : 0,
          custom_bg_enabled: currentPrefs.customBgEnabled ? 1 : 0,
          custom_bg_fit: currentPrefs.customBgFit,
          custom_bg_position: currentPrefs.customBgPosition,
          custom_bg_overlay_mode: currentPrefs.customBgOverlayMode,
          custom_bg_overlay_opacity: currentPrefs.customBgOverlayOpacity,
          custom_bg_blur: currentPrefs.customBgBlur,
          custom_bg_dynamic_accent: currentPrefs.customBgDynamicAccent ? 1 : 0,
          custom_bg_accent_color: currentPrefs.customBgAccentColor,
          custom_bg_image_url: currentPrefs.customBgImageUrl,
        }),
      });
    } catch (e) {
      console.warn("Could not sync appearance to backend:", e.message);
    }
  }

  /**
   * Public setter for individual preference
   */
  function setPreference(key, value) {
    currentPrefs[key] = value;
    applyTokens();
    savePreferences();
  }

  /**
   * Resets all appearance settings to defaults
   */
  async function resetToDefaults() {
    currentPrefs = { ...DEFAULTS };
    cachedBgDataUrl = null;
    stagedBg = null;
    imageAnalysis = null;

    if (window.OfflineStorage) {
      await window.OfflineStorage.removeCustomBackground();
    }
    try {
      await fetch("/api/background/photo", { method: "DELETE" });
    } catch (e) {}

    applyTokens();
    savePreferences();
    if (window.showToast) {
      window.showToast("Appearance reset to defaults 🔄");
    }
  }

  /**
   * Initializes theme manager on app startup
   */
  async function init() {
    // 1. Load from localStorage first (instant render)
    const cached = localStorage.getItem("daybook_appearance");
    if (cached) {
      try {
        currentPrefs = { ...DEFAULTS, ...JSON.parse(cached) };
      } catch (e) {}
    }

    // 2. Fetch wallpaper from IndexedDB for zero-latency offline rendering
    if (window.OfflineStorage) {
      try {
        const bgRecord = await window.OfflineStorage.getCustomBackground();
        if (bgRecord && bgRecord.dataUrl) {
          cachedBgDataUrl = bgRecord.dataUrl;
          if (bgRecord.metadata && bgRecord.metadata.analysis) {
            imageAnalysis = bgRecord.metadata.analysis;
          }
        }
      } catch (e) {
        console.warn("[ThemeManager] Could not load background from IndexedDB:", e);
      }
    }

    applyTokens();

    // 3. Fetch remote preferences from Flask API if available
    try {
      const res = await fetch("/api/preferences");
      if (res.ok) {
        const remote = await res.json();
        currentPrefs.themeMode = remote.theme_mode || currentPrefs.themeMode;
        currentPrefs.accentColor = remote.accent_color || currentPrefs.accentColor;
        currentPrefs.fontSize = remote.font_size || currentPrefs.fontSize;
        currentPrefs.layoutDensity = remote.layout_density || currentPrefs.layoutDensity;
        currentPrefs.cardRadius = remote.card_radius || currentPrefs.cardRadius;
        currentPrefs.mascotEnabled = Boolean(remote.mascot_enabled);
        currentPrefs.mascotSound = Boolean(remote.mascot_sound);

        currentPrefs.customBgEnabled = Boolean(remote.custom_bg_enabled);
        currentPrefs.customBgFit = remote.custom_bg_fit || currentPrefs.customBgFit;
        currentPrefs.customBgPosition = remote.custom_bg_position || currentPrefs.customBgPosition;
        currentPrefs.customBgOverlayMode = remote.custom_bg_overlay_mode || currentPrefs.customBgOverlayMode;
        currentPrefs.customBgOverlayOpacity = remote.custom_bg_overlay_opacity ?? currentPrefs.customBgOverlayOpacity;
        currentPrefs.customBgBlur = remote.custom_bg_blur ?? currentPrefs.customBgBlur;
        currentPrefs.customBgDynamicAccent = Boolean(remote.custom_bg_dynamic_accent ?? 1);
        currentPrefs.customBgAccentColor = remote.custom_bg_accent_color || currentPrefs.customBgAccentColor;
        currentPrefs.customBgImageUrl = remote.custom_bg_image_url || currentPrefs.customBgImageUrl;

        // If remote has an image URL and we have no local dataUrl, use remote URL
        if (currentPrefs.customBgEnabled && currentPrefs.customBgImageUrl && !cachedBgDataUrl) {
          cachedBgDataUrl = currentPrefs.customBgImageUrl;
        }

        applyTokens();
      }
    } catch (e) {
      // offline continues
    }

    // 4. Listen to system dark mode changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (currentPrefs.themeMode === "system") {
        applyTokens();
      }
    });

    // 5. Bind Settings Event Listeners
    bindSettingsControls();
  }

  function bindSettingsControls() {
    // Top bar quick theme toggle
    const topThemeBtn = document.getElementById("btn-theme-toggle");
    if (topThemeBtn) {
      topThemeBtn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || currentPrefs.themeMode;
        const nextTheme = current === "dark" ? "light" : "dark";
        setPreference("themeMode", nextTheme);
      });
    }

    // Theme Mode Buttons
    document.querySelectorAll(".theme-mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setPreference("themeMode", btn.dataset.mode);
      });
    });

    // Accent Color Swatches
    document.querySelectorAll(".accent-swatch").forEach((swatch) => {
      if (swatch.id === "bg-extracted-swatch") return;
      swatch.addEventListener("click", () => {
        // If user manually clicks an accent swatch, disable automatic dynamic accent
        currentPrefs.customBgDynamicAccent = false;
        setPreference("accentColor", swatch.dataset.color);
      });
    });

    // Custom Color Picker
    const customPicker = document.getElementById("pref-custom-accent");
    if (customPicker) {
      customPicker.addEventListener("input", (e) => {
        currentPrefs.customBgDynamicAccent = false;
        setPreference("accentColor", e.target.value);
      });
    }

    // Font Size Buttons
    document.querySelectorAll(".font-size-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setPreference("fontSize", btn.dataset.size);
      });
    });

    // Layout Density Buttons
    document.querySelectorAll(".density-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setPreference("layoutDensity", btn.dataset.density);
      });
    });

    // Card Radius Buttons
    document.querySelectorAll(".radius-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        setPreference("cardRadius", btn.dataset.radius);
      });
    });

    // Mascot toggles
    const mascotToggle = document.getElementById("pref-mascot-toggle");
    if (mascotToggle) {
      mascotToggle.addEventListener("change", (e) => {
        setPreference("mascotEnabled", e.target.checked);
      });
    }

    const soundToggle = document.getElementById("pref-sound-toggle");
    if (soundToggle) {
      soundToggle.addEventListener("change", (e) => {
        setPreference("mascotSound", e.target.checked);
      });
    }

    // Reset button
    const resetBtn = document.getElementById("btn-reset-appearance");
    if (resetBtn) {
      resetBtn.addEventListener("click", resetToDefaults);
    }

    // ==========================================
    // CUSTOM PHOTO BACKGROUND CONTROLS
    // ==========================================
    const bgFileInput = document.getElementById("bg-file-input");
    const triggerUploadBtn = document.getElementById("btn-trigger-upload-bg");
    const applyBgBtn = document.getElementById("btn-apply-bg");
    const cancelBgBtn = document.getElementById("btn-cancel-bg");
    const restoreDefaultBgBtn = document.getElementById("btn-restore-default-bg");

    // Open file picker
    if (triggerUploadBtn && bgFileInput) {
      triggerUploadBtn.addEventListener("click", () => {
        bgFileInput.value = "";
        bgFileInput.click();
      });
    }

    // On file selected: stage a lightweight object URL preview.
    // Do NOT decode large phone photos into canvas here; that was causing tab crashes.
    if (bgFileInput) {
      bgFileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type || !file.type.startsWith("image/")) {
          if (window.showToast) window.showToast("Please choose a JPG, PNG, or WebP image.");
          return;
        }
        if (file.size > 20 * 1024 * 1024) {
          if (window.showToast) window.showToast("Background image must be smaller than 20 MB.");
          return;
        }

        if (stagedBg && stagedBg.previewObjectUrl) {
          try { URL.revokeObjectURL(stagedBg.previewObjectUrl); } catch (_) {}
        }
        const previewObjectUrl = URL.createObjectURL(file);
        imageAnalysis = null;
        stagedBg = {
          file,
          dataUrl: previewObjectUrl,
          previewObjectUrl,
          customBgFit: currentPrefs.customBgFit || "cover",
          customBgPosition: currentPrefs.customBgPosition || "center",
          customBgOverlayMode: currentPrefs.customBgOverlayMode || "dark",
          customBgOverlayOpacity: currentPrefs.customBgOverlayOpacity ?? 0.45,
          customBgBlur: currentPrefs.customBgBlur ?? 0,
          customBgDynamicAccent: currentPrefs.customBgDynamicAccent ?? true,
          customBgAccentColor: currentPrefs.customBgAccentColor || currentPrefs.accentColor,
        };
        updateBgPreviewMockup();
        updatePreviewUI();
        if (window.showToast) window.showToast("Preview ready. Click 'Apply' to upload it. ✨");
      });
    }

    // Apply staged wallpaper
    if (applyBgBtn) {
      applyBgBtn.addEventListener("click", async () => {
        if (!stagedBg && !cachedBgDataUrl && !currentPrefs.customBgImageUrl) return;

        const effective = stagedBg || currentPrefs;
        if (stagedBg && stagedBg.file) {
          if (applyBgBtn.disabled) return;
          applyBgBtn.disabled = true;
          const oldText = applyBgBtn.textContent;
          applyBgBtn.textContent = "Uploading...";
          try {
            const formData = new FormData();
            formData.append("image", stagedBg.file, stagedBg.file.name);
            const uploadRes = await fetch("/api/background/upload", { method: "POST", body: formData });
            let resData = {};
            try { resData = await uploadRes.json(); } catch (_) {}
            if (!uploadRes.ok || !(resData.image_url || resData.imageUrl)) {
              throw new Error(resData.error || `Background upload failed (${uploadRes.status})`);
            }
            const serverUrl = resData.image_url || resData.imageUrl;
            if (stagedBg.previewObjectUrl) {
              try { URL.revokeObjectURL(stagedBg.previewObjectUrl); } catch (_) {}
            }
            cachedBgDataUrl = serverUrl;
            currentPrefs.customBgImageUrl = serverUrl;
          } catch (err) {
            console.error("Background upload failed:", err);
            if (window.showToast) window.showToast(err.message || "Background upload failed.");
            applyBgBtn.disabled = false;
            applyBgBtn.textContent = oldText;
            return;
          } finally {
            applyBgBtn.disabled = false;
            applyBgBtn.textContent = oldText;
          }
        }

        currentPrefs.customBgEnabled = true;
        currentPrefs.customBgFit = effective.customBgFit;
        currentPrefs.customBgPosition = effective.customBgPosition;
        currentPrefs.customBgOverlayMode = effective.customBgOverlayMode;
        currentPrefs.customBgOverlayOpacity = effective.customBgOverlayOpacity;
        currentPrefs.customBgBlur = effective.customBgBlur;
        currentPrefs.customBgDynamicAccent = effective.customBgDynamicAccent;
        if (effective.customBgAccentColor) currentPrefs.customBgAccentColor = effective.customBgAccentColor;

        stagedBg = null;
        applyTokens();
        savePreferences();
        if (window.showToast) window.showToast("Custom background applied! ✨");
      });
    }

    // Cancel staged changes
    if (cancelBgBtn) {
      cancelBgBtn.addEventListener("click", () => {
        stagedBg = null;
        updateBgPreviewMockup();
        updatePreviewUI();
        if (window.showToast) window.showToast("Changes discarded.");
      });
    }

    // Restore default background
    if (restoreDefaultBgBtn) {
      restoreDefaultBgBtn.addEventListener("click", async () => {
        currentPrefs.customBgEnabled = false;
        currentPrefs.customBgImageUrl = null;
        cachedBgDataUrl = null;
        stagedBg = null;
        imageAnalysis = null;

        if (window.OfflineStorage) {
          await window.OfflineStorage.removeCustomBackground();
        }
        try {
          await fetch("/api/background/photo", { method: "DELETE" });
        } catch (e) {}

        applyTokens();
        savePreferences();
        if (window.showToast) window.showToast("Default background restored 🔄");
      });
    }

    // Fitting buttons
    document.querySelectorAll(".bg-fit-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.fit;
        if (stagedBg) {
          stagedBg.customBgFit = val;
        } else if (currentPrefs.customBgEnabled) {
          currentPrefs.customBgFit = val;
          applyTokens();
          savePreferences();
        }
        updatePreviewUI();
        updateBgPreviewMockup();
      });
    });

    // Position buttons
    document.querySelectorAll(".bg-pos-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.pos;
        if (stagedBg) {
          stagedBg.customBgPosition = val;
        } else if (currentPrefs.customBgEnabled) {
          currentPrefs.customBgPosition = val;
          applyTokens();
          savePreferences();
        }
        updatePreviewUI();
        updateBgPreviewMockup();
      });
    });

    // Overlay Mode buttons
    document.querySelectorAll(".bg-overlay-mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.overlay;
        if (stagedBg) {
          stagedBg.customBgOverlayMode = val;
        } else if (currentPrefs.customBgEnabled) {
          currentPrefs.customBgOverlayMode = val;
          applyTokens();
          savePreferences();
        }
        updatePreviewUI();
        updateBgPreviewMockup();
      });
    });

    // Opacity slider
    const opacitySlider = document.getElementById("bg-opacity-slider");
    if (opacitySlider) {
      opacitySlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value) / 100;
        const badge = document.getElementById("bg-opacity-value-badge");
        if (badge) badge.textContent = `${e.target.value}%`;

        if (stagedBg) {
          stagedBg.customBgOverlayOpacity = val;
          updateBgPreviewMockup();
        } else if (currentPrefs.customBgEnabled) {
          currentPrefs.customBgOverlayOpacity = val;
          applyTokens();
        }
      });
      opacitySlider.addEventListener("change", () => {
        if (!stagedBg && currentPrefs.customBgEnabled) {
          savePreferences();
        }
      });
    }

    // Blur slider
    const blurSlider = document.getElementById("bg-blur-slider");
    if (blurSlider) {
      blurSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        const badge = document.getElementById("bg-blur-value-badge");
        if (badge) badge.textContent = `${val}px`;

        if (stagedBg) {
          stagedBg.customBgBlur = val;
          updateBgPreviewMockup();
        } else if (currentPrefs.customBgEnabled) {
          currentPrefs.customBgBlur = val;
          applyTokens();
        }
      });
      blurSlider.addEventListener("change", () => {
        if (!stagedBg && currentPrefs.customBgEnabled) {
          savePreferences();
        }
      });
    }

    // Dynamic Accent Toggle
    const dynAccentToggle = document.getElementById("bg-dynamic-accent-toggle");
    if (dynAccentToggle) {
      dynAccentToggle.addEventListener("change", (e) => {
        const checked = e.target.checked;
        if (stagedBg) {
          stagedBg.customBgDynamicAccent = checked;
        } else if (currentPrefs.customBgEnabled) {
          currentPrefs.customBgDynamicAccent = checked;
          applyTokens();
          savePreferences();
        }
        updatePreviewUI();
        updateBgPreviewMockup();
      });
    }
  }

  return {
    init,
    setPreference,
    resetToDefaults,
    getPreferences: () => ({ ...currentPrefs }),
    processAndOptimizeImage,
    analyzeImage,
    PRESET_ACCENTS,
  };
})();

window.ThemeManager = ThemeManager;
