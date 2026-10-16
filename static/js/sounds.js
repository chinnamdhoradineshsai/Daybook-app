/**
 * DAYBOOK — Victory Sounds & Audio Engine
 * Provides rich celebratory audio playback, personal sound library management,
 * native file picker upload with format/size/duration validation, Web Audio synthesizer fallback,
 * IndexedDB audio blob caching for 100% offline playback, and session deduplication.
 */

const SoundManager = (() => {
  // Session tracking to avoid replaying sounds on refresh, repeated sync, or duplicate network responses
  const sessionCelebratedIds = new Set();

  let audioContext = null;
  let activeAudio = null;
  let activeBlobUrl = null;
  let soundsList = [];
  let isMuted = false;
  let currentVolume = 0.7;
  let activeTaskSoundId = "default_victory";
  let activeMilestoneSoundId = "sound_level_up";
  let soundEventMode = "every_task"; // 'every_task' or 'selected_events'
  let lastPlayTime = 0;

  // Initialize Web Audio API context safely on user interaction
  function getAudioContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  }

  // Mobile / browser autoplay unlock on first user gesture
  function unlockAudio() {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch (e) {}
    window.removeEventListener("pointerdown", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
  }

  if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("touchstart", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio, { passive: true });
  }

  // Synthesizes a sparkling ascending celebration chime using pure Web Audio API
  // Safe zero-asset fallback if an audio file fails to load or offline cache is missing
  function playSynthFallback(volume = 0.7) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 triumphant chord
      
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        // Exponential volume decay envelope
        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume * 0.35), now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.55);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.6);
      });
    } catch (err) {
      console.warn("[SoundManager] Synthesizer fallback error:", err);
    }
  }

  // Load user audio preferences and available sounds from API
  async function init() {
    try {
      // 1. Load preferences
      const prefRes = await fetch("/api/preferences");
      if (prefRes.ok) {
        const prefs = await prefRes.json();
        isMuted = prefs.victory_sound_enabled === 0;
        currentVolume = typeof prefs.victory_sound_volume === "number" ? prefs.victory_sound_volume : 0.7;
        activeTaskSoundId = prefs.active_task_sound_id || "default_victory";
        activeMilestoneSoundId = prefs.active_milestone_sound_id || "sound_level_up";
        soundEventMode = prefs.sound_event_mode || "every_task";
      }

      // 2. Load victory sounds list
      await loadSoundsList();

      // 3. Cache sounds locally in IndexedDB if available
      autoCacheActiveSounds();
    } catch (err) {
      console.warn("[SoundManager] Failed to init sounds from network:", err);
      // Try offline cache fallback
      if (window.OfflineStorage && window.OfflineStorage.getPreferences) {
        const cached = await window.OfflineStorage.getPreferences();
        if (cached) {
          isMuted = cached.victory_sound_enabled === 0;
          currentVolume = cached.victory_sound_volume || 0.7;
          activeTaskSoundId = cached.active_task_sound_id || "default_victory";
          activeMilestoneSoundId = cached.active_milestone_sound_id || "sound_level_up";
          soundEventMode = cached.sound_event_mode || "every_task";
        }
      }
    }
  }

  async function loadSoundsList() {
    try {
      const res = await fetch("/api/sounds");
      if (res.ok) {
        soundsList = await res.json();
      }
    } catch (err) {
      console.warn("[SoundManager] Network fetch failed, reading offline cached sounds:", err);
    }
    return soundsList;
  }

  // Caches active celebratory sounds into IndexedDB audio_cache store for offline play
  async function autoCacheActiveSounds() {
    if (!window.OfflineStorage || !window.OfflineStorage.cacheAudioBlob) return;
    for (const sound of soundsList) {
      // Automatically cache default task sound and milestone sound
      if (sound.id === activeTaskSoundId || sound.id === activeMilestoneSoundId || sound.id === "default_victory") {
        downloadAndCacheSound(sound.id).catch(() => {});
      }
    }
  }

  // Downloads audio binary and persists as Blob in IndexedDB
  async function downloadAndCacheSound(soundId) {
    if (!window.OfflineStorage || !window.OfflineStorage.cacheAudioBlob) return false;
    const target = soundsList.find((s) => s.id === soundId);
    if (!target || !target.file_path) return false;

    // Check if already cached
    const isCached = await window.OfflineStorage.isAudioCached(soundId);
    if (isCached) return true;

    try {
      const res = await fetch(target.file_path);
      if (res.ok) {
        const blob = await res.blob();
        await window.OfflineStorage.cacheAudioBlob(soundId, blob, target);
        return true;
      }
    } catch (e) {
      console.warn("[SoundManager] Could not download audio blob for caching:", soundId, e);
    }
    return false;
  }

  // Checks whether a sound is available offline (either cached in IndexedDB or pre-cached)
  async function isSoundOfflineAvailable(soundId) {
    if (window.OfflineStorage && window.OfflineStorage.isAudioCached) {
      const inDB = await window.OfflineStorage.isAudioCached(soundId);
      if (inDB) return true;
    }
    // Built-in starter sounds are also cached by service worker
    if (soundId === "default_victory" || soundId.startsWith("sound_")) return true;
    return false;
  }

  // Core Playback Engine: Plays sound by sound_id or file_path
  async function playSound(soundIdOrPath, customVolume = null) {
    if (isMuted) return;

    // Prevent rapid overlapping sounds jarring the user (80ms debounce)
    const now = Date.now();
    if (now - lastPlayTime < 80) return;
    lastPlayTime = now;

    // Stop previous active audio to prevent overlapping noise
    if (activeAudio) {
      try {
        activeAudio.pause();
        activeAudio.currentTime = 0;
      } catch (e) {}
      activeAudio = null;
    }
    if (activeBlobUrl) {
      try {
        URL.revokeObjectURL(activeBlobUrl);
      } catch (e) {}
      activeBlobUrl = null;
    }

    const volume = customVolume !== null ? customVolume : currentVolume;

    // Find sound object in list
    let targetSound = soundsList.find((s) => s.id === soundIdOrPath || s.file_path === soundIdOrPath);
    let soundId = targetSound ? targetSound.id : soundIdOrPath;
    let audioUrl = targetSound ? targetSound.file_path : soundIdOrPath;

    // 1. Check IndexedDB audio blob cache for offline playback
    if (window.OfflineStorage && window.OfflineStorage.getCachedAudio) {
      try {
        const cached = await window.OfflineStorage.getCachedAudio(soundId);
        if (cached && cached.blob) {
          activeBlobUrl = URL.createObjectURL(cached.blob);
          audioUrl = activeBlobUrl;
        }
      } catch (e) {}
    }

    if (!audioUrl) {
      // Fallback directly to Web Audio synthesized chime
      playSynthFallback(volume);
      return;
    }

    try {
      const audio = new Audio(audioUrl);
      audio.volume = Math.max(0, Math.min(1, volume));
      activeAudio = audio;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("[SoundManager] HTML5 Audio play prevented/failed, falling back to Web Audio synth:", err);
          playSynthFallback(volume);
        });
      }

      audio.onended = () => {
        if (activeBlobUrl) {
          URL.revokeObjectURL(activeBlobUrl);
          activeBlobUrl = null;
        }
      };
    } catch (err) {
      console.warn("[SoundManager] Failed to instantiate audio element:", err);
      playSynthFallback(volume);
    }
  }

  // Public: Play Task Completion Sound (guarded against repeat play on refresh/sync)
  function playTaskVictory(taskId = null) {
    if (isMuted) return;

    // Check user preference for sound event mode
    if (soundEventMode === "selected_events") {
      // User opted to play only for milestone/achievement events, not every task
      return;
    }

    if (taskId) {
      if (sessionCelebratedIds.has(taskId)) {
        // Already celebrated in this session; do not replay!
        return;
      }
      sessionCelebratedIds.add(taskId);
    }

    playSound(activeTaskSoundId);
  }

  // Public: Play Project Milestone Completion Sound
  function playMilestoneVictory(milestoneId = null) {
    if (isMuted) return;

    if (milestoneId) {
      if (sessionCelebratedIds.has(milestoneId)) {
        return;
      }
      sessionCelebratedIds.add(milestoneId);
    }

    const soundToPlay = activeMilestoneSoundId || activeTaskSoundId;
    playSound(soundToPlay);
  }

  // Public: Preview sound without recording task completion (for Settings / Sound Library)
  function previewSound(soundIdOrPath, vol = null) {
    // Temporarily bypass mute for intentional user preview
    const savedMuted = isMuted;
    isMuted = false;
    playSound(soundIdOrPath, vol !== null ? vol : currentVolume);
    isMuted = savedMuted;
  }

  // Preview local file selected via input[type=file] before uploading
  function previewLocalFile(file, onDurationReady = null) {
    if (!file) return null;
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.volume = currentVolume;

    if (onDurationReady) {
      audio.addEventListener("loadedmetadata", () => {
        onDurationReady(audio.duration);
      });
    }

    audio.play().catch((err) => {
      console.warn("[SoundManager] Preview playback failed:", err);
    });

    return {
      audio,
      url,
      stop: () => {
        try {
          audio.pause();
          audio.currentTime = 0;
          URL.revokeObjectURL(url);
        } catch (e) {}
      },
    };
  }

  // Validate Audio File (formats, max size 5MB, duration max 15s)
  function validateAudioFile(file) {
    const ALLOWED_FORMATS = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "audio/x-wav",
      "audio/mp4",
      "audio/x-m4a",
      "audio/m4a",
      "audio/webm",
      "audio/aac",
    ];
    const ALLOWED_EXTS = [".mp3", ".wav", ".ogg", ".m4a", ".webm"];
    const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

    if (!file) {
      return { valid: false, error: "Please choose an audio file from your device." };
    }

    const name = (file.name || "").toLowerCase();
    const hasValidExt = ALLOWED_EXTS.some((ext) => name.endsWith(ext));
    const hasValidMime = file.type ? ALLOWED_FORMATS.includes(file.type) : true;

    if (!hasValidExt && !hasValidMime) {
      return {
        valid: false,
        error: "Unsupported file format. Please choose an MP3, WAV, OGG, M4A, or WEBM audio file.",
      };
    }

    if (file.size > MAX_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `File is too large (${sizeMb} MB). Maximum audio file size is 5 MB.`,
      };
    }

    return { valid: true };
  }

  // Upload Custom Audio File to Backend (or queue if offline)
  async function uploadSound(file, title, eventTrigger = "task_complete", isDefault = false, duration = 0) {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check if offline
    if (!navigator.onLine) {
      // Convert file to base64 and queue in IndexedDB
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result;
            const tempSoundId = "offline_" + Date.now();
            const payload = {
              title: title || file.name.replace(/\.[^/.]+$/, ""),
              event_trigger: eventTrigger,
              is_default: isDefault,
              duration: duration,
              audio_data: base64Data,
              filename: file.name,
            };

            if (window.OfflineStorage) {
              await window.OfflineStorage.enqueueAction("UPLOAD_SOUND", payload);
              // Also cache blob locally right away
              await window.OfflineStorage.cacheAudioBlob(tempSoundId, file, {
                id: tempSoundId,
                title: payload.title,
                file_format: file.name.split(".").pop() || "mp3",
                duration: duration,
              });
            }

            resolve({
              id: tempSoundId,
              title: payload.title,
              is_offline_pending: true,
            });
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = () => reject(new Error("Failed to read audio file"));
        reader.readAsDataURL(file);
      });
    }

    const formData = new FormData();
    formData.append("audio", file);
    formData.append("title", title || file.name.replace(/\.[^/.]+$/, ""));
    formData.append("event_trigger", eventTrigger);
    formData.append("is_default", isDefault ? "true" : "false");
    if (duration > 0) formData.append("duration", duration.toString());

    const res = await fetch("/api/sounds", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to upload audio file.");
    }

    const result = await res.json();
    const newSound = result.sound || result;

    await loadSoundsList();

    // Cache the blob locally immediately so it's instantly available offline
    if (window.OfflineStorage && window.OfflineStorage.cacheAudioBlob) {
      window.OfflineStorage.cacheAudioBlob(newSound.id, file, newSound).catch(() => {});
    }

    if (isDefault) {
      if (eventTrigger === "milestone_complete") {
        activeMilestoneSoundId = newSound.id;
      } else {
        activeTaskSoundId = newSound.id;
      }
    }

    return result;
  }

  // Replace audio file for an existing sound entry
  async function replaceSound(soundId, file, duration = 0) {
    const validation = validateAudioFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const formData = new FormData();
    formData.append("audio", file);
    if (duration > 0) formData.append("duration", duration.toString());

    const res = await fetch(`/api/sounds/${soundId}/replace`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to replace audio file.");
    }

    const updated = await res.json();
    await loadSoundsList();

    // Update local cache
    if (window.OfflineStorage && window.OfflineStorage.cacheAudioBlob) {
      window.OfflineStorage.cacheAudioBlob(soundId, file, updated).catch(() => {});
    }

    return updated;
  }

  // Update/Rename a sound
  async function updateSound(soundId, data) {
    const res = await fetch(`/api/sounds/${soundId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update sound");
    const updated = await res.json();
    await loadSoundsList();
    return updated;
  }

  // Delete a sound
  async function deleteSound(soundId) {
    const res = await fetch(`/api/sounds/${soundId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete sound");

    // Remove from local cache
    if (window.OfflineStorage && window.OfflineStorage.removeCachedAudio) {
      window.OfflineStorage.removeCachedAudio(soundId);
    }

    await loadSoundsList();
    if (activeTaskSoundId === soundId) activeTaskSoundId = "default_victory";
    if (activeMilestoneSoundId === soundId) activeMilestoneSoundId = null;
    return true;
  }

  // Save Audio Preferences (Mute, Volume, Active Task Sound, Active Milestone Sound, Event Mode)
  async function savePreferences(prefsUpdate) {
    if (prefsUpdate.victory_sound_enabled !== undefined) {
      isMuted = prefsUpdate.victory_sound_enabled === 0;
    }
    if (prefsUpdate.victory_sound_volume !== undefined) {
      currentVolume = Number(prefsUpdate.victory_sound_volume);
    }
    if (prefsUpdate.active_task_sound_id !== undefined) {
      activeTaskSoundId = prefsUpdate.active_task_sound_id;
    }
    if (prefsUpdate.active_milestone_sound_id !== undefined) {
      activeMilestoneSoundId = prefsUpdate.active_milestone_sound_id;
    }
    if (prefsUpdate.sound_event_mode !== undefined) {
      soundEventMode = prefsUpdate.sound_event_mode;
    }

    const payload = {
      victory_sound_enabled: isMuted ? 0 : 1,
      victory_sound_volume: currentVolume,
      active_task_sound_id: activeTaskSoundId,
      active_milestone_sound_id: activeMilestoneSoundId,
      sound_event_mode: soundEventMode,
    };

    try {
      await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn("[SoundManager] Error saving audio preferences, enqueuing offline:", err);
      if (window.OfflineStorage && window.OfflineStorage.enqueueAction) {
        window.OfflineStorage.enqueueAction("UPDATE_PREFERENCES", payload);
      }
    }
  }

  return {
    init,
    loadSoundsList,
    playSound,
    playTaskVictory,
    playMilestoneVictory,
    previewSound,
    previewLocalFile,
    validateAudioFile,
    uploadSound,
    replaceSound,
    updateSound,
    deleteSound,
    savePreferences,
    downloadAndCacheSound,
    isSoundOfflineAvailable,
    getSounds: () => soundsList,
    isMuted: () => isMuted,
    setMuted: (muted) => {
      isMuted = muted;
      savePreferences({ victory_sound_enabled: muted ? 0 : 1 });
    },
    getVolume: () => currentVolume,
    setVolume: (vol) => {
      currentVolume = Math.max(0, Math.min(1, vol));
      savePreferences({ victory_sound_volume: currentVolume });
    },
    getActiveTaskSoundId: () => activeTaskSoundId,
    setActiveTaskSoundId: (id) => {
      activeTaskSoundId = id;
      savePreferences({ active_task_sound_id: id });
    },
    getActiveMilestoneSoundId: () => activeMilestoneSoundId,
    setActiveMilestoneSoundId: (id) => {
      activeMilestoneSoundId = id;
      savePreferences({ active_milestone_sound_id: id });
    },
    getSoundEventMode: () => soundEventMode,
    setSoundEventMode: (mode) => {
      soundEventMode = mode;
      savePreferences({ sound_event_mode: mode });
    },
  };
})();

window.SoundManager = SoundManager;
