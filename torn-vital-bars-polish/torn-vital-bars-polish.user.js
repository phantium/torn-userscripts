// ==UserScript==
// @name         Torn Vital Bars Polish
// @namespace    https://github.com/phantium/torn-userscripts
// @version      0.5.3
// @description  Refines Torn's visible sidebar with native-feeling density and cleaner vital bars.
// @author       Phantium
// @homepageURL  https://github.com/phantium/torn-userscripts
// @supportURL   https://github.com/phantium/torn-userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/phantium/torn-userscripts/main/torn-vital-bars-polish/torn-vital-bars-polish.user.js
// @updateURL    https://raw.githubusercontent.com/phantium/torn-userscripts/main/torn-vital-bars-polish/torn-vital-bars-polish.user.js
// @match        https://www.torn.com/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const STYLE_ID = "tvbp-style";
  const ROOT_ID = "sidebarroot";
  const VITALS_SCOPE = ".user-information___VBSOk .content___GVtZ_";
  const TVBP_ATTR = "data-tvbp-bar";
  const MAX_VISIBLE_TICKS = 9;
  const TICKS_STORAGE_KEY = "tvbp-show-ticks";
  const BAR_MATCH_SELECTOR = ".bar___Bv5Ho.bar-desktop___p5Cas, .chain-bar___vjdPL.bar-desktop___F8PEF";
  const BAR_SELECTOR = [
    `${VITALS_SCOPE} .bar___Bv5Ho.bar-desktop___p5Cas`,
    `${VITALS_SCOPE} .chain-bar___vjdPL.bar-desktop___F8PEF`,
  ].join(", ");
  const BAR_PARTS = {
    label: ".bar-name___cHBD8, .bar-name___EcY8p",
    value: ".bar-value___NTdce, .bar-value___uxnah",
    timer: ".bar-descr___muXn5, .bar-timeleft___B9RGV",
    progress: ".progress-line___FhcBg, .progress-line___NJ6XG",
    progressTimer: ".progress-line-timer___uV1ZZ",
    ticks: ".tick-list___GeD3y li, .tick-list___McObN li",
  };
  const barPartCache = new WeakMap();

  const LABEL_CONFIG = {
    energy: {
      accent: "#79ef96",
      glow: "rgba(102, 229, 135, 0.22)",
      tone: "linear-gradient(90deg, #7ae291 0%, #53bc6b 55%, #37824d 100%)",
      lowThreshold: 0.2,
    },
    nerve: {
      accent: "#ffb26e",
      glow: "rgba(255, 156, 93, 0.2)",
      tone: "linear-gradient(90deg, #fab378 0%, #e1844b 55%, #bb5a31 100%)",
      lowThreshold: 0.2,
    },
    happy: {
      accent: "#ffe47d",
      glow: "rgba(255, 223, 105, 0.18)",
      tone: "linear-gradient(90deg, #f3dc72 0%, #d9bf4f 55%, #ac9334 100%)",
      lowThreshold: 0.3,
    },
    life: {
      accent: "#9db8ff",
      glow: "rgba(127, 160, 255, 0.2)",
      tone: "linear-gradient(90deg, #97b1fa 0%, #708de1 55%, #526abc 100%)",
      lowThreshold: 0.25,
    },
    chain: {
      accent: "#d7dde7",
      glow: "rgba(196, 205, 221, 0.1)",
      tone: "linear-gradient(90deg, #b2bac5 0%, #8e97a3 58%, #656d78 100%)",
      lowThreshold: 0.18,
    },
  };

  function getTickVisibility() {
    try {
      return localStorage.getItem(TICKS_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setTickVisibility(enabled) {
    try {
      localStorage.setItem(TICKS_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
      // Ignore storage failures and keep current session behavior.
    }
  }

  function applyTickVisibility() {
    const root = document.getElementById(ROOT_ID);
    if (!root) {
      return;
    }

    root.dataset.tvbpShowTicks = getTickVisibility() ? "true" : "false";
  }

  function registerMenuCommands() {
    if (typeof GM_registerMenuCommand !== "function") {
      return;
    }

    const ticksEnabled = getTickVisibility();
    GM_registerMenuCommand(
      ticksEnabled ? "Torn Vital Bars Polish: Hide ticks" : "Torn Vital Bars Polish: Show ticks",
      () => {
        setTickVisibility(!ticksEnabled);
        window.location.reload();
      }
    );
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        --tvbp-shell: rgba(255, 255, 255, 0.012);
        --tvbp-shell-strong: rgba(255, 255, 255, 0.018);
        --tvbp-border: rgba(255, 255, 255, 0.03);
        --tvbp-text: #f2f5f8;
        --tvbp-muted: #b7bfca;
        --tvbp-track: rgba(8, 12, 17, 0.8);
        --tvbp-shadow: 0 6px 14px rgba(0, 0, 0, 0.12);
      }

      #${ROOT_ID}[data-tvbp-show-ticks="false"] [${TVBP_ATTR}="true"] .tick-list___GeD3y,
      #${ROOT_ID}[data-tvbp-show-ticks="false"] [${TVBP_ATTR}="true"] .tick-list___McObN,
      #${ROOT_ID}[data-tvbp-show-ticks="false"] [${TVBP_ATTR}="true"] > div:last-child {
        display: none !important;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 1px;
        padding: 2px 0 3px;
        margin: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        text-decoration: none;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"]:hover {
        background: transparent;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"]:focus-visible {
        outline: 1px solid color-mix(in srgb, var(--tvbp-accent, #ffffff) 45%, transparent);
        outline-offset: 1px;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .bar-stats____l994,
      #${ROOT_ID} [${TVBP_ATTR}="true"] .bar-stats___E_LqA {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        align-items: baseline;
        gap: 3px;
        margin: 0;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .bar-name___cHBD8,
      #${ROOT_ID} [${TVBP_ATTR}="true"] .bar-name___EcY8p {
        margin: 0;
        color: var(--tvbp-accent, #ffffff);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0;
        line-height: 1.1;
        text-transform: none;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .bar-value___NTdce,
      #${ROOT_ID} [${TVBP_ATTR}="true"] .bar-value___uxnah {
        margin: 0;
        color: var(--tvbp-text);
        font-size: 9px;
        font-weight: 800;
        line-height: 1.1;
        letter-spacing: 0;
        font-variant-numeric: tabular-nums;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .bar-descr___muXn5,
      #${ROOT_ID} [${TVBP_ATTR}="true"] .bar-timeleft___B9RGV {
        margin: 0;
        justify-self: end;
        padding: 1px 5px;
        border-radius: 999px;
        color: rgba(212, 220, 230, 0.92);
        background: rgba(255, 255, 255, 0.035);
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.025);
        font-size: 9px;
        font-weight: 700;
        line-height: 1;
        font-variant-numeric: tabular-nums;
        min-width: 26px;
        text-align: right;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-ready="true"] .bar-descr___muXn5,
      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-ready="true"] .bar-timeleft___B9RGV {
        color: color-mix(in srgb, var(--tvbp-accent, #eaf0f7) 78%, #ffffff 22%);
        background: color-mix(in srgb, var(--tvbp-accent, #eaf0f7) 12%, rgba(255, 255, 255, 0.03) 88%);
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tvbp-accent, #eaf0f7) 16%, rgba(255, 255, 255, 0.02) 84%);
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .progress___z5tk3,
      #${ROOT_ID} [${TVBP_ATTR}="true"] .progress___onlYW {
        position: relative;
        overflow: hidden;
        display: block;
        height: 7px;
        padding: 0;
        line-height: 0;
        border-radius: 999px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.18)),
          rgba(10, 13, 18, 0.72);
        box-shadow:
          inset 0 1px 1px rgba(0, 0, 0, 0.32),
          inset 0 0 0 1px rgba(255, 255, 255, 0.025),
          0 1px 0 rgba(255, 255, 255, 0.02);
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .progress-line-wrap___Alp6b {
        position: absolute;
        inset: 0;
        height: 100%;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .progress-line-timer___uV1ZZ {
        position: absolute;
        inset: 0 auto 0 0;
        display: block;
        height: 100%;
        min-height: 0;
        border-radius: inherit;
        opacity: 0.1;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02));
        box-shadow: none;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .progress-line___FhcBg,
      #${ROOT_ID} [${TVBP_ATTR}="true"] .progress-line___NJ6XG {
        position: absolute;
        inset: 0 auto 0 0;
        display: block;
        height: 100%;
        min-height: 0;
        border-radius: inherit;
        background: var(--tvbp-tone, linear-gradient(90deg, #6ed884, #3c9958));
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .progress-line___FhcBg::after,
      #${ROOT_ID} [${TVBP_ATTR}="true"] .progress-line___NJ6XG::after {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
          linear-gradient(90deg, rgba(255, 255, 255, 0.02), transparent 24%);
        pointer-events: none;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-low="true"] {
        box-shadow: none;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-ready="true"] .progress-line___FhcBg,
      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-ready="true"] .progress-line___NJ6XG {
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-key="energy"][data-tvbp-ready="true"] .progress___z5tk3,
      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-key="energy"][data-tvbp-ready="true"] .progress___onlYW,
      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-key="nerve"][data-tvbp-ready="true"] .progress___z5tk3,
      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-key="nerve"][data-tvbp-ready="true"] .progress___onlYW {
        transform-origin: center;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-key="energy"][data-tvbp-ready="true"] .bar-descr___muXn5,
      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-key="energy"][data-tvbp-ready="true"] .bar-timeleft___B9RGV,
      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-key="nerve"][data-tvbp-ready="true"] .bar-descr___muXn5,
      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-key="nerve"][data-tvbp-ready="true"] .bar-timeleft___B9RGV {
        transform: scale(1.02);
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .tick-list___GeD3y,
      #${ROOT_ID} [${TVBP_ATTR}="true"] .tick-list___McObN {
        display: flex;
        gap: 3px;
        margin: 1px 0 0;
        padding: 0;
        list-style: none;
        opacity: 1;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .tick-list___GeD3y li[data-tvbp-hidden="true"],
      #${ROOT_ID} [${TVBP_ATTR}="true"] .tick-list___McObN li[data-tvbp-hidden="true"] {
        display: none;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] > div:last-child {
        margin: 0;
        padding: 0;
        line-height: 0;
        min-height: 0;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .tick-list___GeD3y li,
      #${ROOT_ID} [${TVBP_ATTR}="true"] .tick-list___McObN li {
        flex: 1 1 0;
        height: 4px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
        opacity: 0.12;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .tick-list___GeD3y li[data-tvbp-tick="active"],
      #${ROOT_ID} [${TVBP_ATTR}="true"] .tick-list___McObN li[data-tvbp-tick="active"] {
        background: color-mix(in srgb, var(--tvbp-accent, #ffffff) 82%, #ffffff 18%);
        opacity: 0.56;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"] .tick-list___GeD3y li[data-tvbp-tick="edge"],
      #${ROOT_ID} [${TVBP_ATTR}="true"] .tick-list___McObN li[data-tvbp-tick="edge"] {
        background: color-mix(in srgb, var(--tvbp-accent, #ffffff) 54%, rgba(255, 255, 255, 0.28) 46%);
        opacity: 0.24;
        box-shadow: none;
      }

      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-ready="true"] .tick-list___GeD3y li,
      #${ROOT_ID} [${TVBP_ATTR}="true"][data-tvbp-ready="true"] .tick-list___McObN li {
        opacity: 0.48;
      }

      @media (prefers-reduced-motion: reduce) {
        #${ROOT_ID} [${TVBP_ATTR}="true"],
        #${ROOT_ID} [${TVBP_ATTR}="true"] * {
          transition: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function normalizeLabel(text) {
    return text.replace(/:\s*$/, "").trim().toLowerCase();
  }

  function isInsideVitalsSection(node) {
    return Boolean(node.closest(VITALS_SCOPE));
  }

  function getBarParts(bar) {
    const cached = barPartCache.get(bar);

    if (cached && (!cached.label || cached.label.isConnected)) {
      return cached;
    }

    const showTicks = getTickVisibility();
    const parts = {
      label: bar.querySelector(BAR_PARTS.label),
      value: bar.querySelector(BAR_PARTS.value),
      timer: bar.querySelector(BAR_PARTS.timer),
      progress: bar.querySelector(BAR_PARTS.progress),
      progressTimer: bar.querySelector(BAR_PARTS.progressTimer),
      ticks: showTicks ? [...bar.querySelectorAll(BAR_PARTS.ticks)] : [],
    };

    barPartCache.set(bar, parts);
    return parts;
  }

  function invalidateBarParts(bar) {
    if (bar instanceof HTMLElement) {
      barPartCache.delete(bar);
    }
  }

  function getBarLabel(bar) {
    return normalizeLabel(getBarParts(bar).label?.textContent || "");
  }

  function setDatasetValue(element, key, value) {
    if (element.dataset[key] !== value) {
      element.dataset[key] = value;
    }
  }

  function deleteDatasetValue(element, key) {
    if (key in element.dataset) {
      delete element.dataset[key];
    }
  }

  function setStyleValue(element, property, value) {
    if (element.style.getPropertyValue(property) !== value) {
      element.style.setProperty(property, value);
    }
  }

  function clearStyleValue(element, property) {
    if (element.style.getPropertyValue(property)) {
      element.style.removeProperty(property);
    }
  }

  function getBarFromMutationTarget(target) {
    const element = target instanceof Element ? target : target.parentElement;

    if (!element) {
      return null;
    }

    if (element.matches(BAR_MATCH_SELECTOR)) {
      return element;
    }

    return element.closest(BAR_MATCH_SELECTOR);
  }

  function nodeContainsVitals(node) {
    if (!(node instanceof Element)) {
      return false;
    }

    return (
      node.matches(VITALS_SCOPE) ||
      node.matches(BAR_MATCH_SELECTOR) ||
      Boolean(node.querySelector(`${VITALS_SCOPE}, ${BAR_MATCH_SELECTOR}`))
    );
  }

  function childListTouchesVitals(mutation) {
    if (nodeContainsVitals(mutation.target)) {
      return true;
    }

    return [...mutation.addedNodes].some(nodeContainsVitals);
  }

  function parseRatio(text) {
    const match = text.match(/(\d[\d,.]*)\s*\/\s*(\d[\d,.]*)/);
    if (!match) {
      return { current: 0, max: 100, ratio: 0 };
    }

    const current = Number(match[1].replace(/,/g, ""));
    const max = Number(match[2].replace(/,/g, ""));
    if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
      return { current: 0, max: 100, ratio: 0 };
    }

    return {
      current,
      max,
      ratio: Math.min(Math.max(current / max, 0), 1),
    };
  }

  function syncBar(bar) {
    if (!isInsideVitalsSection(bar)) {
      deleteDatasetValue(bar, "tvbpBar");
      return;
    }

    const key = getBarLabel(bar);
    const config = LABEL_CONFIG[key];
    if (!config) {
      deleteDatasetValue(bar, "tvbpBar");
      return;
    }

    const showTicks = getTickVisibility();
    const { value, timer, progress, progressTimer, ticks } = getBarParts(bar);

    const ratio = parseRatio(value?.textContent || "");
    const timerText = (timer?.textContent || "").trim().toUpperCase();
    const isReady = timerText === "FULL" || (key === "chain" && timerText === "00:00") || ratio.ratio >= 0.995;
    const isLow = ratio.ratio > 0 && ratio.ratio <= config.lowThreshold;

    setDatasetValue(bar, "tvbpBar", "true");
    setDatasetValue(bar, "tvbpKey", key);
    setDatasetValue(bar, "tvbpReady", String(isReady));
    setDatasetValue(bar, "tvbpLow", String(isLow));
    setStyleValue(bar, "--tvbp-accent", config.accent);
    setStyleValue(bar, "--tvbp-glow", config.glow);
    setStyleValue(bar, "--tvbp-tone", config.tone);

    if (progress && key === "chain" && ratio.current === 0 && ratio.max > 0) {
      setStyleValue(progress, "min-width", "0");
    } else if (progress) {
      clearStyleValue(progress, "min-width");
    }

    if (progressTimer && isReady) {
      setStyleValue(progressTimer, "opacity", "0.16");
    } else if (progressTimer) {
      clearStyleValue(progressTimer, "opacity");
    }

    if (ticks.length > 0 && showTicks) {
      const visibleTicks = ticks.slice(0, MAX_VISIBLE_TICKS);

      ticks.forEach((tick, index) => {
        if (index < MAX_VISIBLE_TICKS) {
          deleteDatasetValue(tick, "tvbpHidden");
        } else {
          setDatasetValue(tick, "tvbpHidden", "true");
          deleteDatasetValue(tick, "tvbpTick");
        }
      });

      const scaled = ratio.ratio * visibleTicks.length;
      const completed = Math.floor(scaled);
      const hasEdge = scaled > completed && completed < visibleTicks.length;

      visibleTicks.forEach((tick, index) => {
        deleteDatasetValue(tick, "tvbpTick");

        if (isReady || index < completed) {
          setDatasetValue(tick, "tvbpTick", "active");
          return;
        }

        if (hasEdge && index === completed) {
          setDatasetValue(tick, "tvbpTick", "edge");
        }
      });
    } else if (ticks.length > 0) {
      ticks.forEach((tick) => {
        deleteDatasetValue(tick, "tvbpHidden");
        deleteDatasetValue(tick, "tvbpTick");
      });
    }
  }

  function syncAllBars() {
    document.querySelectorAll(BAR_SELECTOR).forEach((bar) => {
      if (bar instanceof HTMLElement) {
        syncBar(bar);
      }
    });
  }

  function watchSidebar() {
    injectStyles();
    applyTickVisibility();
    syncAllBars();

    const root = document.getElementById(ROOT_ID);
    if (!root) {
      return;
    }

    let queuedAllBars = false;
    let queuedFrame = 0;
    const queuedBars = new Set();

    const flushQueuedSync = () => {
      queuedFrame = 0;

      if (queuedAllBars) {
        queuedAllBars = false;
        queuedBars.clear();
        syncAllBars();
        return;
      }

      const bars = [...queuedBars];
      queuedBars.clear();
      bars.forEach((bar) => {
        if (bar.isConnected && bar instanceof HTMLElement) {
          syncBar(bar);
        }
      });
    };

    const queueSync = (bar) => {
      if (bar instanceof HTMLElement) {
        queuedBars.add(bar);
      } else {
        queuedAllBars = true;
      }

      if (!queuedFrame) {
        queuedFrame = window.requestAnimationFrame(flushQueuedSync);
      }
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          if (mutation.addedNodes.length || mutation.removedNodes.length) {
            const bar = getBarFromMutationTarget(mutation.target);
            if (!bar && !childListTouchesVitals(mutation)) {
              return;
            }
            invalidateBarParts(bar);
            queueSync(bar);
          }
          return;
        }

        const bar = getBarFromMutationTarget(mutation.target);
        if (bar) {
          queueSync(bar);
        }
      });
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", watchSidebar, { once: true });
  } else {
    watchSidebar();
  }

  registerMenuCommands();
})();
