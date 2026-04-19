// ==UserScript==
// @name         Faction War Profile Status Banner
// @namespace    https://github.com/phantium/torn-userscripts
// @version      0.5.1
// @description  Shows a large ONLINE banner on Torn profile pages when the viewed player is online and their faction is currently at war with yours.
// @author       Phantium
// @homepageURL  https://github.com/phantium/torn-userscripts
// @supportURL   https://github.com/phantium/torn-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/phantium/torn-userscripts/main/faction-war-profile-status-banner/faction-war-profile-status-banner.user.js
// @updateURL    https://raw.githubusercontent.com/phantium/torn-userscripts/main/faction-war-profile-status-banner/faction-war-profile-status-banner.user.js
// @match        https://www.torn.com/profiles.php*
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      api.torn.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const STYLE_ID = "tpob-style";
  const BANNER_ID = "tpob-online-banner";
  const SETUP_ID = "tpob-setup-panel";
  const STORAGE_KEY = "tpob-api-key";
  const ONLINE_TEXT = "ONLINE";
  const STATUS_TOKENS = ["online", "idle", "offline"];
  const SCAN_LIMIT = 250;
  const WAR_CACHE_TTL_MS = 10 * 60 * 1000;
  const MIN_API_INTERVAL_MS = 15 * 1000;
  const VIEW_RETRY_DELAY_MS = 400;
  const MAX_VIEW_RETRIES = 12;
  const FACTION_API_URL = "https://api.torn.com/faction/?selections=basic";

  let lastKnownUrl = location.href;
  let syncTimer = null;
  let isSyncRunning = false;
  let lastApiRequestAt = 0;
  let apiErrorMessage = "";
  let warCache = {
    fetchedAt: 0,
    opponents: [],
  };

  function resetCaches() {
    apiErrorMessage = "";
    warCache = {
      fetchedAt: 0,
      opponents: [],
    };
  }

  function scheduleSync(delay = 0, options = {}) {
    if (syncTimer) {
      window.clearTimeout(syncTimer);
    }

    syncTimer = window.setTimeout(() => {
      syncTimer = null;
      if (isSyncRunning) {
        scheduleSync(100, options);
        return;
      }

      isSyncRunning = true;
      Promise.resolve(syncBanner(options))
        .catch((error) => {
          console.warn("[Faction War Profile Status Banner]", error);
        })
        .finally(() => {
          isSyncRunning = false;
        });
    }, delay);
  }

  function normalizeFactionName(value) {
    if (!value) {
      return "";
    }

    return String(value).replace(/\s+/g, " ").trim().toLowerCase();
  }

  function getStoredApiKey() {
    if (typeof GM_getValue === "function") {
      try {
        const stored = GM_getValue(STORAGE_KEY, "");
        if (stored) {
          return String(stored).trim();
        }
      } catch {
        // Fall back to localStorage.
      }
    }

    try {
      return (localStorage.getItem(STORAGE_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function setStoredApiKey(value) {
    const trimmed = value ? value.trim() : "";

    if (trimmed && typeof GM_setValue === "function") {
      try {
        GM_setValue(STORAGE_KEY, trimmed);
      } catch {
        // Fall back to localStorage.
      }
    }

    if (!trimmed && typeof GM_deleteValue === "function") {
      try {
        GM_deleteValue(STORAGE_KEY);
      } catch {
        // Fall back to localStorage.
      }
    }

    try {
      if (trimmed) {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures and keep current session behavior.
    }
  }

  function registerMenuCommands() {
    if (typeof GM_registerMenuCommand !== "function") {
      return;
    }

    GM_registerMenuCommand("Faction War Profile Status Banner: Set API key", () => {
      const current = getStoredApiKey();
      const next = window.prompt(
        [
          "Paste a Torn API key for war checks.",
          "Required selection: faction -> basic.",
          "The key is stored locally in userscript storage and used only for Torn API requests.",
        ].join("\n"),
        current
      );

      if (next === null) {
        return;
      }

      const trimmed = next.trim();
      setStoredApiKey(trimmed);
      resetCaches();
      scheduleSync(0, { forceReloadWar: Boolean(trimmed) });
    });

    GM_registerMenuCommand("Faction War Profile Status Banner: Clear API key", () => {
      setStoredApiKey("");
      resetCaches();
      scheduleSync(0);
    });
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BANNER_ID} {
        display: none;
        margin: 14px 0 18px;
        padding: 16px 22px 14px;
        border: 2px solid rgba(131, 255, 179, 0.72);
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(18, 48, 30, 0.95), rgba(7, 22, 12, 0.96));
        box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(197, 255, 218, 0.12);
        text-align: center;
      }

      #${BANNER_ID}[data-visible="true"] {
        display: block;
      }

      #${BANNER_ID} .tpob-label {
        display: block;
        color: #bfffd0;
        font-size: clamp(30px, 5vw, 58px);
        font-weight: 900;
        line-height: 0.95;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        text-shadow: 0 0 18px rgba(120, 255, 162, 0.24), 0 2px 0 rgba(0, 0, 0, 0.45);
      }

      #${BANNER_ID} .tpob-subtitle {
        display: block;
        margin-top: 8px;
        color: rgba(218, 255, 229, 0.92);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }

      #${SETUP_ID} {
        display: none;
        margin: 14px 0 18px;
        padding: 16px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        background: linear-gradient(180deg, rgba(29, 31, 36, 0.96), rgba(17, 19, 23, 0.96));
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
        color: #e6ebf1;
      }

      #${SETUP_ID}[data-visible="true"] {
        display: block;
      }

      #${SETUP_ID} .tpob-setup-title {
        margin: 0 0 8px;
        font-size: 18px;
        font-weight: 800;
        color: #f7fbff;
      }

      #${SETUP_ID} .tpob-setup-copy {
        margin: 0 0 12px;
        color: #c8d0da;
        font-size: 13px;
        line-height: 1.45;
      }

      #${SETUP_ID} .tpob-setup-meta {
        margin: 0 0 12px;
        color: #9da8b6;
        font-size: 12px;
        line-height: 1.45;
      }

      #${SETUP_ID} .tpob-setup-input {
        width: 100%;
        box-sizing: border-box;
        min-height: 42px;
        padding: 10px 12px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        background: rgba(9, 11, 14, 0.92);
        color: #f2f6fb;
        font-size: 13px;
        outline: none;
      }

      #${SETUP_ID} .tpob-setup-input:focus {
        border-color: rgba(131, 255, 179, 0.55);
        box-shadow: 0 0 0 3px rgba(131, 255, 179, 0.12);
      }

      #${SETUP_ID} .tpob-setup-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 12px;
      }

      #${SETUP_ID} .tpob-setup-button {
        appearance: none;
        border: 0;
        border-radius: 10px;
        padding: 10px 14px;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
      }

      #${SETUP_ID} .tpob-setup-button[data-kind="primary"] {
        background: linear-gradient(180deg, #90f7b3, #57d881);
        color: #102115;
      }

      #${SETUP_ID} .tpob-setup-button[data-kind="secondary"] {
        background: rgba(255, 255, 255, 0.08);
        color: #e6ebf1;
      }

      #${SETUP_ID} .tpob-setup-status {
        margin-top: 10px;
        color: #bfffd0;
        font-size: 12px;
        font-weight: 700;
      }

      #${SETUP_ID} .tpob-setup-status[data-state="error"] {
        color: #ffb3b3;
      }
    `;

    document.head.appendChild(style);
  }

  function getBanner() {
    let banner = document.getElementById(BANNER_ID);
    if (banner) {
      return banner;
    }

    banner = document.createElement("section");
    banner.id = BANNER_ID;
    banner.setAttribute("aria-live", "polite");
    banner.innerHTML = `
      <span class="tpob-label">${ONLINE_TEXT}</span>
      <span class="tpob-subtitle">War target is online right now</span>
    `;
    return banner;
  }

  function getSetupPanel() {
    let panel = document.getElementById(SETUP_ID);
    if (panel) {
      return panel;
    }

    panel = document.createElement("section");
    panel.id = SETUP_ID;
    panel.setAttribute("aria-live", "polite");
    panel.innerHTML = `
      <h5 class="tpob-setup-title">Set API Key For War Check</h5>
      <p class="tpob-setup-copy">
        This add-on needs a Torn API key so it can cache the factions currently at war with yours.
      </p>
      <p class="tpob-setup-meta">
        Required selection: <strong>faction -> basic</strong>. The key is stored locally in userscript storage only.
      </p>
      <input class="tpob-setup-input" type="password" autocomplete="off" spellcheck="false" placeholder="Paste Torn API key" />
      <div class="tpob-setup-actions">
        <button class="tpob-setup-button" data-kind="primary" type="button">Save key</button>
        <button class="tpob-setup-button" data-kind="secondary" type="button">Retry war check</button>
      </div>
      <div class="tpob-setup-status"></div>
    `;

    const input = panel.querySelector(".tpob-setup-input");
    const saveButton = panel.querySelector('.tpob-setup-button[data-kind="primary"]');
    const retryButton = panel.querySelector('.tpob-setup-button[data-kind="secondary"]');
    const status = panel.querySelector(".tpob-setup-status");

    input.value = getStoredApiKey();

    saveButton.addEventListener("click", () => {
      const next = input.value.trim();
      if (!next) {
        status.dataset.state = "error";
        status.textContent = "Paste a key first.";
        return;
      }

      setStoredApiKey(next);
      resetCaches();
      setSetupVisible(false);
      scheduleSync(0, { forceReloadWar: true });
    });

    retryButton.addEventListener("click", () => {
      status.dataset.state = "ok";
      status.textContent = "";
      scheduleSync(0, { forceReloadWar: true });
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        saveButton.click();
      }
    });

    return panel;
  }

  function getMountTarget() {
    const selectors = [
      "#mainContainer .content-title",
      "#mainContainer .content-wrapper",
      "main .content-title",
      "main",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }

    return document.body;
  }

  function mountElement(element) {
    const target = getMountTarget();
    if (!target) {
      return element;
    }

    if (element.parentElement === target) {
      return element;
    }

    if (target.matches(".content-title, h4, h5")) {
      target.insertAdjacentElement("afterend", element);
      return element;
    }

    target.prepend(element);
    return element;
  }

  function setBannerVisible(visible) {
    const banner = mountElement(getBanner());
    banner.dataset.visible = visible ? "true" : "false";
  }

  function setSetupVisible(visible) {
    const existingPanel = document.getElementById(SETUP_ID);
    if (!visible) {
      if (existingPanel) {
        existingPanel.remove();
      }
      return;
    }

    const panel = mountElement(existingPanel || getSetupPanel());
    const input = panel.querySelector(".tpob-setup-input");
    const status = panel.querySelector(".tpob-setup-status");
    panel.dataset.visible = "true";
    panel.hidden = false;
    panel.style.display = "block";

    if (input) {
      input.value = getStoredApiKey();
    }

    if (status) {
      if (apiErrorMessage) {
        status.dataset.state = "error";
        status.textContent = apiErrorMessage;
      } else {
        status.dataset.state = "ok";
        status.textContent = "";
      }
    }
  }

  function collectAttributeText(element) {
    const values = [
      element.getAttribute("title"),
      element.getAttribute("aria-label"),
      element.getAttribute("alt"),
      element.getAttribute("data-status"),
      element.getAttribute("data-state"),
      element.getAttribute("class"),
      element.textContent,
    ];

    return values.filter(Boolean).join(" ");
  }

  function normalizeStatus(rawValue) {
    if (!rawValue) {
      return null;
    }

    const value = String(rawValue).toLowerCase();
    for (const token of STATUS_TOKENS) {
      if (value.includes(token)) {
        return token;
      }
    }

    return null;
  }

  function isLikelyStatusNode(element) {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
      return false;
    }

    const descriptor = collectAttributeText(element).toLowerCase();
    const tag = element.tagName.toLowerCase();
    const hasStatusWord = STATUS_TOKENS.some((token) => descriptor.includes(token));
    const classHints = /status|state|online|offline|idle/.test(descriptor);
    const isIconishTag = ["img", "svg", "span", "i", "b", "ins"].includes(tag);
    const rect = typeof element.getBoundingClientRect === "function" ? element.getBoundingClientRect() : null;
    const isSmallBadge = rect ? rect.width <= 40 && rect.height <= 40 : false;

    return hasStatusWord || classHints || (isIconishTag && isSmallBadge);
  }

  function getCandidateRoots() {
    return [
      document.querySelector("#profileroot"),
      document.querySelector("#mainContainer"),
      document.querySelector("main"),
      document.body,
    ].filter(Boolean);
  }

  function findVisibleStatus() {
    const explicitStatusSelectors = [
      "#profileroot .basic-info li[class*='user-status-16-']",
      "#profileroot li[class*='user-status-16-']",
    ];

    for (const selector of explicitStatusSelectors) {
      const matches = document.querySelectorAll(selector);
      for (const element of matches) {
        const className = element.getAttribute("class") || "";
        const normalized = normalizeStatus(className.replace(/[-_]/g, " "));
        if (normalized) {
          return normalized;
        }
      }
    }

    const selectors = [
      "[title]",
      "[aria-label]",
      "img[alt]",
      "[data-status]",
      "[data-state]",
      "[class*='status']",
      "[class*='online']",
      "[class*='offline']",
      "[class*='idle']",
    ];

    const seen = new Set();

    for (const root of getCandidateRoots()) {
      for (const selector of selectors) {
        const matches = root.querySelectorAll(selector);
        for (const element of matches) {
          if (seen.has(element)) {
            continue;
          }

          seen.add(element);
          if (!isLikelyStatusNode(element)) {
            continue;
          }

          const status = normalizeStatus(collectAttributeText(element));
          if (status) {
            return status;
          }

          if (seen.size >= SCAN_LIMIT) {
            return null;
          }
        }
      }
    }

    return null;
  }

  function readVisibleFactionName() {
    const selectors = [
      "#profileroot .basic-info .user-info-value a[href*='/factions.php?step=profile']",
      "#profileroot .basic-info .user-info-value a[href*='factions.php?step=profile']",
      "#profileroot a.t-blue[href*='/factions.php?step=profile']",
      "#profileroot a.t-blue[href*='factions.php?step=profile']",
      "a[href*='factions.php?step=profile']",
      "a[href*='factions.php'][href*='step=profile']",
      "a[href*='factions.php?ID=']",
    ];

    for (const root of getCandidateRoots()) {
      for (const selector of selectors) {
        const matches = root.querySelectorAll(selector);
        for (const element of matches) {
          const text = normalizeFactionName(element.textContent);
          if (text) {
            return text;
          }
        }
      }
    }

    return "";
  }

  function readProfileViewState() {
    return {
      status: findVisibleStatus(),
      factionName: readVisibleFactionName(),
    };
  }

  function extractNumericId(value) {
    const numeric = Number.parseInt(String(value), 10);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  async function waitForApiWindow() {
    const remaining = MIN_API_INTERVAL_MS - (Date.now() - lastApiRequestAt);
    if (remaining > 0) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, remaining);
      });
    }

    lastApiRequestAt = Date.now();
  }

  function gmRequest(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest is unavailable."));
        return;
      }

      GM_xmlhttpRequest({
        method: "GET",
        url,
        responseType: "json",
        onload: (response) => {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(`API request failed with status ${response.status}.`));
            return;
          }

          resolve(response.response || JSON.parse(response.responseText || "{}"));
        },
        onerror: () => {
          reject(new Error("API request failed."));
        },
        ontimeout: () => {
          reject(new Error("API request timed out."));
        },
      });
    });
  }

  function getObjectEntries(value) {
    if (!value || typeof value !== "object") {
      return [];
    }

    if (Array.isArray(value)) {
      return value;
    }

    return Object.values(value);
  }

  function getWarEndTimestamp(warLike) {
    if (!warLike || typeof warLike !== "object") {
      return null;
    }

    const candidates = [
      warLike.end,
      warLike.ends,
      warLike.end_time,
      warLike.endTime,
      warLike.war && warLike.war.end,
      warLike.war && warLike.war.ends,
      warLike.war && warLike.war.end_time,
      warLike.war && warLike.war.endTime,
    ];

    for (const candidate of candidates) {
      const timestamp = extractNumericId(candidate);
      if (timestamp) {
        return timestamp;
      }
    }

    return null;
  }

  function isWarActive(warLike) {
    const end = getWarEndTimestamp(warLike);
    if (!end) {
      return true;
    }

    return end >= Math.floor(Date.now() / 1000);
  }

  function extractFactionRecords(value, records) {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        extractFactionRecords(item, records);
      }
      return;
    }

    if (value.factions && typeof value.factions === "object") {
      for (const [key, faction] of Object.entries(value.factions)) {
        const id = extractNumericId(key);
        const name = faction && typeof faction === "object" ? faction.name : "";
        const normalizedName = normalizeFactionName(name);
        if (id || normalizedName) {
          records.push({
            id,
            name: String(name || "").trim(),
            normalizedName,
          });
        }
      }
    }

    const directFields = [
      ["faction_id", value.faction_name],
      ["target", value.target_name],
      ["target_faction", value.target_factionname],
      ["enemy_faction", value.enemy_factionname],
      ["opponent_faction", value.opponent_factionname],
      ["attacking_faction", value.attacking_factionname],
      ["defending_faction", value.defending_factionname],
      ["assaulting_faction", value.assaulting_factionname],
      ["attacker_faction", value.attacker_factionname],
      ["defender_faction", value.defender_factionname],
    ];

    for (const [field, nameValue] of directFields) {
      const id = extractNumericId(value[field]);
      const name = String(nameValue || "").trim();
      const normalizedName = normalizeFactionName(name);
      if (id || normalizedName) {
        records.push({ id, name, normalizedName });
      }
    }
  }

  function loadEnemyFactionRecords(apiData) {
    const ownFactionId = extractNumericId(apiData.ID || apiData.id);
    const containers = [
      apiData.ranked_wars,
      apiData.raid_wars,
      apiData.territory_wars,
      apiData.wars,
      apiData.warfare,
    ];

    const byKey = new Map();

    for (const container of containers) {
      for (const warLike of getObjectEntries(container)) {
        if (!isWarActive(warLike)) {
          continue;
        }

        const records = [];
        extractFactionRecords(warLike, records);

        for (const record of records) {
          if (!record.id && !record.normalizedName) {
            continue;
          }

          if (record.id && ownFactionId && record.id === ownFactionId) {
            continue;
          }

          const key = record.id ? `id:${record.id}` : `name:${record.normalizedName}`;
          if (!byKey.has(key)) {
            byKey.set(key, record);
          }
        }
      }
    }

    return Array.from(byKey.values());
  }

  async function loadWarOpponents(forceReload = false) {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      return [];
    }

    const cacheFresh = Date.now() - warCache.fetchedAt < WAR_CACHE_TTL_MS;
    if (!forceReload && cacheFresh) {
      return warCache.opponents;
    }

    await waitForApiWindow();
    const url = `${FACTION_API_URL}&key=${encodeURIComponent(apiKey)}&comment=tpob`;

    try {
      const data = await gmRequest(url);
      if (data && data.error) {
        throw new Error(`Torn API error ${data.error.code}: ${data.error.error}`);
      }

      apiErrorMessage = "";
      warCache = {
        fetchedAt: Date.now(),
        opponents: loadEnemyFactionRecords(data || {}),
      };
    } catch (error) {
      console.warn("[Faction War Profile Status Banner]", error.message);
      apiErrorMessage = `War lookup failed: ${error.message}`;
      warCache = {
        fetchedAt: 0,
        opponents: [],
      };
    }

    return warCache.opponents;
  }

  function renderState(state) {
    setSetupVisible(state.showSetup);
    setBannerVisible(state.showBanner);
  }

  async function syncBanner(options = {}) {
    const apiKey = getStoredApiKey();
    const profileState = readProfileViewState();
    const viewRetryCount = options.viewRetryCount || 0;

    if (!apiKey) {
      renderState({
        showSetup: true,
        showBanner: false,
      });
      return;
    }

    if (document.hidden) {
      renderState({
        showSetup: false,
        showBanner: false,
      });
      return;
    }

    if (profileState.status !== "online") {
      if (!profileState.status && viewRetryCount < MAX_VIEW_RETRIES) {
        scheduleSync(VIEW_RETRY_DELAY_MS, { viewRetryCount: viewRetryCount + 1 });
        return;
      }

      apiErrorMessage = "";
      renderState({
        showSetup: false,
        showBanner: false,
      });
      return;
    }

    if (!profileState.factionName) {
      if (viewRetryCount < MAX_VIEW_RETRIES) {
        scheduleSync(VIEW_RETRY_DELAY_MS, { viewRetryCount: viewRetryCount + 1 });
        return;
      }

      apiErrorMessage = "";
      renderState({
        showSetup: false,
        showBanner: false,
      });
      return;
    }

    const opponents = await loadWarOpponents(Boolean(options.forceReloadWar));
    const isEnemyFaction = opponents.some((opponent) => opponent.normalizedName === profileState.factionName);

    renderState({
      showSetup: Boolean(apiErrorMessage),
      showBanner: isEnemyFaction,
    });
  }

  function handleUrlChange() {
    if (location.href === lastKnownUrl) {
      return;
    }

    lastKnownUrl = location.href;
    scheduleSync(0);
  }

  function patchHistoryMethods() {
    const wrap = (methodName) => {
      const original = history[methodName];
      if (typeof original !== "function") {
        return;
      }

      history[methodName] = function (...args) {
        const result = original.apply(this, args);
        handleUrlChange();
        return result;
      };
    };

    wrap("pushState");
    wrap("replaceState");
  }

  function init() {
    injectStyles();
    registerMenuCommands();
    patchHistoryMethods();
    scheduleSync(0);

    window.addEventListener("load", () => {
      scheduleSync(0);
    }, { once: true });

    window.addEventListener("popstate", () => {
      handleUrlChange();
    });
  }

  init();
})();
