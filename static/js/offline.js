/**
 * DAYBOOK — Offline & IndexedDB Storage Engine
 * Handles offline persistence for custom companion photos, user preferences,
 * and background synchronization queue when network is restored.
 */

const OfflineStorage = (() => {
  const DB_NAME = "DaybookOfflineDB";
  const DB_VERSION = 3;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Companion custom photos
        if (!db.objectStoreNames.contains("companion_assets")) {
          db.createObjectStore("companion_assets", { keyPath: "key" });
        }
        // Custom background photo and settings
        if (!db.objectStoreNames.contains("background_assets")) {
          db.createObjectStore("background_assets", { keyPath: "key" });
        }
        // Preferences & settings
        if (!db.objectStoreNames.contains("preferences")) {
          db.createObjectStore("preferences", { keyPath: "key" });
        }
        // Offline actions sync queue
        if (!db.objectStoreNames.contains("sync_queue")) {
          db.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
        }
        // Quick Capture inbox cache
        if (!db.objectStoreNames.contains("inbox_items")) {
          db.createObjectStore("inbox_items", { keyPath: "id" });
        }
        // Victory audio cache
        if (!db.objectStoreNames.contains("audio_cache")) {
          db.createObjectStore("audio_cache", { keyPath: "id" });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => {
        console.warn("[OfflineStorage] IndexedDB unavailable, fallback to localStorage:", e);
        reject(e);
      };
    });
    return dbPromise;
  }

  // --- Companion Photo in IndexedDB ---
  async function saveCustomPhoto(dataUrl) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("companion_assets", "readwrite");
        const store = tx.objectStore("companion_assets");
        store.put({
          key: "custom_photo",
          dataUrl,
          updatedAt: new Date().toISOString(),
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      // Fallback
      try {
        localStorage.setItem("daybook_offline_custom_photo", dataUrl);
      } catch (err) {}
      return false;
    }
  }

  async function getCustomPhoto() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction("companion_assets", "readonly");
        const store = tx.objectStore("companion_assets");
        const req = store.get("custom_photo");
        req.onsuccess = () => resolve(req.result ? req.result.dataUrl : null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return localStorage.getItem("daybook_offline_custom_photo") || null;
    }
  }

  async function removeCustomPhoto() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction("companion_assets", "readwrite");
        const store = tx.objectStore("companion_assets");
        store.delete("custom_photo");
        tx.oncomplete = () => {
          localStorage.removeItem("daybook_offline_custom_photo");
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      localStorage.removeItem("daybook_offline_custom_photo");
      return false;
    }
  }

  // --- Offline Preferences Cache ---
  async function savePreferences(prefs) {
    try {
      const db = await openDB();
      const tx = db.transaction("preferences", "readwrite");
      tx.objectStore("preferences").put({ key: "user_prefs", data: prefs, updatedAt: Date.now() });
    } catch (e) {
      try {
        localStorage.setItem("daybook_preferences_cache", JSON.stringify(prefs));
      } catch (err) {}
    }
  }

  async function getPreferences() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction("preferences", "readonly");
        const req = tx.objectStore("preferences").get("user_prefs");
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      const cached = localStorage.getItem("daybook_preferences_cache");
      return cached ? JSON.parse(cached) : null;
    }
  }

  // --- Offline Sync Queue ---
  async function enqueueAction(type, payload) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("sync_queue", "readwrite");
        tx.objectStore("sync_queue").add({
          type,
          payload,
          createdAt: new Date().toISOString(),
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      return false;
    }
  }

  async function getSyncQueue() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction("sync_queue", "readonly");
        const req = tx.objectStore("sync_queue").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  }

  async function removeQueueItem(id) {
    try {
      const db = await openDB();
      const tx = db.transaction("sync_queue", "readwrite");
      tx.objectStore("sync_queue").delete(id);
    } catch (e) {}
  }

  async function processSyncQueue(apiBaseUrl = "") {
    if (!navigator.onLine) return;
    const items = await getSyncQueue();
    if (!items.length) return;

    for (const item of items) {
      try {
        if (item.type === "UPLOAD_COMPANION_PHOTO") {
          await fetch(`${apiBaseUrl}/api/companion/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ photo_data: item.payload }),
          });
        } else if (item.type === "UPDATE_PREFERENCES") {
          await fetch(`${apiBaseUrl}/api/preferences`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload),
          });
        } else if (item.type === "CREATE_INBOX_ITEM") {
          await fetch(`${apiBaseUrl}/api/inbox`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload),
          });
        } else if (item.type === "CONVERT_INBOX_ITEM") {
          await fetch(`${apiBaseUrl}/api/inbox/${item.payload.itemId}/convert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload),
          });
        } else if (item.type === "UPLOAD_SOUND") {
          await fetch(`${apiBaseUrl}/api/sounds`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload),
          });
          if (window.SoundManager && window.SoundManager.loadSoundsList) {
            window.SoundManager.loadSoundsList();
          }
        } else if (item.type === "UPDATE_SOUND") {
          await fetch(`${apiBaseUrl}/api/sounds/${item.payload.soundId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload.data),
          });
        } else if (item.type === "DELETE_SOUND") {
          await fetch(`${apiBaseUrl}/api/sounds/${item.payload.soundId}`, {
            method: "DELETE",
          });
        }
        await removeQueueItem(item.id);
      } catch (err) {
        console.warn("[OfflineStorage] Failed to sync queue item:", item.type, err);
        break; // retry on next reconnection
      }
    }

    if (window.showToast) {
      window.showToast("Cloud sync complete! Changes uploaded.");
    }
  }

  // --- Inbox Items Local Cache ---
  async function saveInboxItemLocally(item) {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction("inbox_items", "readwrite");
        tx.objectStore("inbox_items").put(item);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }

  async function getLocalInboxItems() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction("inbox_items", "readonly");
        const req = tx.objectStore("inbox_items").getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  }

  async function removeLocalInboxItem(id) {
    try {
      const db = await openDB();
      const tx = db.transaction("inbox_items", "readwrite");
      tx.objectStore("inbox_items").delete(id);
    } catch (e) {}
  }

  // --- Victory Sounds IndexedDB Audio Cache ---
  async function cacheAudioBlob(soundId, blob, meta = {}) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("audio_cache", "readwrite");
        const store = tx.objectStore("audio_cache");
        store.put({
          id: soundId,
          blob,
          meta,
          cachedAt: Date.now(),
        });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => {
          if (tx.error && tx.error.name === "QuotaExceededError") {
            console.warn("[OfflineStorage] Storage quota exceeded while caching audio");
          }
          reject(tx.error);
        };
      });
    } catch (e) {
      console.warn("[OfflineStorage] cacheAudioBlob error:", e);
      return false;
    }
  }

  async function getCachedAudio(soundId) {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction("audio_cache", "readonly");
        const req = tx.objectStore("audio_cache").get(soundId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  async function isAudioCached(soundId) {
    try {
      const cached = await getCachedAudio(soundId);
      return !!(cached && cached.blob);
    } catch (e) {
      return false;
    }
  }

  async function getAllCachedAudioIds() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction("audio_cache", "readonly");
        const req = tx.objectStore("audio_cache").getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch (e) {
      return [];
    }
  }

  async function removeCachedAudio(soundId) {
    try {
      const db = await openDB();
      const tx = db.transaction("audio_cache", "readwrite");
      tx.objectStore("audio_cache").delete(soundId);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function clearUserAudioCache() {
    try {
      const db = await openDB();
      const tx = db.transaction("audio_cache", "readwrite");
      tx.objectStore("audio_cache").clear();
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- Custom Background Photo in IndexedDB ---
  async function saveCustomBackground(dataUrl, metadata = {}) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("background_assets", "readwrite");
        const store = tx.objectStore("background_assets");
        store.put({
          key: "custom_bg",
          dataUrl,
          metadata,
          updatedAt: new Date().toISOString(),
        });
        tx.oncomplete = () => {
          try {
            // Also keep tiny metadata in localStorage for instant sync before IndexedDB opens
            localStorage.setItem("daybook_custom_bg_meta", JSON.stringify(metadata));
          } catch (err) {}
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      try {
        localStorage.setItem("daybook_custom_bg_fallback", dataUrl);
        localStorage.setItem("daybook_custom_bg_meta", JSON.stringify(metadata));
      } catch (err) {}
      return false;
    }
  }

  async function getCustomBackground() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction("background_assets", "readonly");
        const store = tx.objectStore("background_assets");
        const req = store.get("custom_bg");
        req.onsuccess = () => {
          if (req.result && req.result.dataUrl) {
            resolve({ dataUrl: req.result.dataUrl, metadata: req.result.metadata || {} });
          } else {
            const fallback = localStorage.getItem("daybook_custom_bg_fallback");
            let meta = {};
            try { meta = JSON.parse(localStorage.getItem("daybook_custom_bg_meta") || "{}"); } catch (e) {}
            resolve(fallback ? { dataUrl: fallback, metadata: meta } : null);
          }
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      const fallback = localStorage.getItem("daybook_custom_bg_fallback");
      let meta = {};
      try { meta = JSON.parse(localStorage.getItem("daybook_custom_bg_meta") || "{}"); } catch (e) {}
      return fallback ? { dataUrl: fallback, metadata: meta } : null;
    }
  }

  async function removeCustomBackground() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction("background_assets", "readwrite");
        const store = tx.objectStore("background_assets");
        store.delete("custom_bg");
        tx.oncomplete = () => {
          localStorage.removeItem("daybook_custom_bg_fallback");
          localStorage.removeItem("daybook_custom_bg_meta");
          resolve(true);
        };
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      localStorage.removeItem("daybook_custom_bg_fallback");
      localStorage.removeItem("daybook_custom_bg_meta");
      return false;
    }
  }

  async function clearUserBackground() {
    try {
      const db = await openDB();
      const tx = db.transaction("background_assets", "readwrite");
      tx.objectStore("background_assets").clear();
      localStorage.removeItem("daybook_custom_bg_fallback");
      localStorage.removeItem("daybook_custom_bg_meta");
      return true;
    } catch (e) {
      localStorage.removeItem("daybook_custom_bg_fallback");
      localStorage.removeItem("daybook_custom_bg_meta");
      return false;
    }
  }

  // Auto-listen to network connectivity events
  function initNetworkWatchers(apiBaseUrl = "") {
    window.addEventListener("online", () => {
      if (window.showToast) window.showToast("Connection restored. Syncing changes... 🔄");
      processSyncQueue(apiBaseUrl);
    });
    window.addEventListener("offline", () => {
      if (window.showToast) window.showToast("You are offline. Working in offline mode. 📴");
    });
  }

  return {
    openDB,
    saveCustomPhoto,
    getCustomPhoto,
    removeCustomPhoto,
    saveCustomBackground,
    getCustomBackground,
    removeCustomBackground,
    clearUserBackground,
    savePreferences,
    getPreferences,
    enqueueAction,
    getSyncQueue,
    processSyncQueue,
    initNetworkWatchers,
    saveInboxItemLocally,
    getLocalInboxItems,
    removeLocalInboxItem,
    cacheAudioBlob,
    getCachedAudio,
    isAudioCached,
    getAllCachedAudioIds,
    removeCachedAudio,
    clearUserAudioCache,
  };
})();

window.OfflineStorage = OfflineStorage;
