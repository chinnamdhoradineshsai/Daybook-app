/**
 * DAYBOOK — Configuration & Environment Settings
 * Configures the backend API Base URL for local development and production hosting
 * (e.g. Vercel frontend communicating with Render backend).
 */

const DaybookConfig = (() => {
  // Check for injected environment variable, stored custom URL, or relative default
  function getBaseUrl() {
    if (window.DAYBOOK_API_URL) return window.DAYBOOK_API_URL.replace(/\/+$/, "");
    const stored = localStorage.getItem("daybook_custom_api_url");
    if (stored) return stored.replace(/\/+$/, "");
    return ""; // Relative path when frontend and backend share domain
  }

  let currentBaseUrl = getBaseUrl();

  function apiUrl(path) {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${currentBaseUrl}${cleanPath}`;
  }

  function setBaseUrl(url) {
    if (url) {
      currentBaseUrl = url.trim().replace(/\/+$/, "");
      localStorage.setItem("daybook_custom_api_url", currentBaseUrl);
    } else {
      currentBaseUrl = "";
      localStorage.removeItem("daybook_custom_api_url");
    }
    return currentBaseUrl;
  }

  return {
    getBaseUrl: () => currentBaseUrl,
    apiUrl,
    setBaseUrl,
  };
})();

// Automatically transparently route all relative /api calls through DaybookConfig.apiUrl
if (typeof window !== "undefined" && window.fetch) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === "string" && input.startsWith("/api/")) {
      const fullUrl = DaybookConfig.apiUrl(input);
      return nativeFetch(fullUrl, init);
    }
    return nativeFetch(input, init);
  };
}

window.DaybookConfig = DaybookConfig;
