import "./style.css";

import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const MODES = {
  FOCUS: "FOCUS",
  BREAK: "BREAK",
};

const THEMES = ["latte", "frappe", "macchiato", "mocha"];

const DEFAULT_SECONDS = {
  [MODES.FOCUS]: 25 * 60,
  [MODES.BREAK]: 5 * 60,
};

const STATE_SUBDIR = "pomodoro-mvp";
const STATE_FILENAME = "state.json";

const state = {
  mode: MODES.FOCUS,
  remainingSeconds: DEFAULT_SECONDS[MODES.FOCUS],
  running: false,
  lastUpdated: Date.now(),
  theme: "mocha",
};

const ui = {
  modeLabel: document.querySelector("#modeLabel"),
  timeDisplay: document.querySelector("#timeDisplay"),
  statusText: document.querySelector("#statusText"),
  runningIndicator: document.querySelector("#runningIndicator"),
  runningText: document.querySelector("#runningText"),
  themeSelect: document.querySelector("#themeSelect"),
  startBtn: document.querySelector("#startBtn"),
  pauseBtn: document.querySelector("#pauseBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  focusBtn: document.querySelector("#focusBtn"),
  breakBtn: document.querySelector("#breakBtn"),
};

let stateFilePath;
let timerId = null;

function formatMMSS(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function setStatus(message = "") {
  ui.statusText.textContent = message;
}

function applyTheme(theme) {
  const selectedTheme = THEMES.includes(theme) ? theme : "mocha";
  state.theme = selectedTheme;
  document.documentElement.dataset.theme = selectedTheme;
  ui.themeSelect.value = selectedTheme;
}

function render() {
  ui.modeLabel.textContent = state.mode;
  ui.timeDisplay.textContent = formatMMSS(state.remainingSeconds);
  ui.startBtn.disabled = state.running || state.remainingSeconds <= 0;
  ui.pauseBtn.disabled = !state.running;

  const modeSwitchDisabled = state.running;
  ui.focusBtn.disabled = modeSwitchDisabled;
  ui.breakBtn.disabled = modeSwitchDisabled;

  ui.runningIndicator.classList.toggle("is-running", state.running);
  ui.runningText.textContent = state.running ? "Running" : "Paused";
}

function defaultSecondsForMode(mode) {
  return DEFAULT_SECONDS[mode] ?? DEFAULT_SECONDS[MODES.FOCUS];
}

function clearTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function ensureSingleInterval() {
  clearTimer();
  timerId = setInterval(tick, 1000);
}

async function resolveStatePath() {
  if (stateFilePath) {
    return stateFilePath;
  }

  const dataDir = await appDataDir();
  const appStateDir = await join(dataDir, STATE_SUBDIR);
  const filePath = await join(appStateDir, STATE_FILENAME);

  if (!(await exists(appStateDir))) {
    await mkdir(appStateDir, { recursive: true });
  }

  stateFilePath = filePath;
  return stateFilePath;
}

async function saveState() {
  try {
    const filePath = await resolveStatePath();
    state.lastUpdated = Date.now();
    await writeTextFile(filePath, JSON.stringify(state, null, 2));
  } catch (error) {
    setStatus(`Save failed: ${String(error)}`);
  }
}

async function loadState() {
  try {
    const filePath = await resolveStatePath();
    if (!(await exists(filePath))) {
      applyTheme("mocha");
      await saveState();
      return;
    }

    const raw = await readTextFile(filePath);
    const parsed = JSON.parse(raw);

    const mode = parsed.mode === MODES.BREAK ? MODES.BREAK : MODES.FOCUS;
    const fallback = defaultSecondsForMode(mode);
    const remainingSeconds = Number.isFinite(parsed.remainingSeconds)
      ? Math.max(0, Math.floor(parsed.remainingSeconds))
      : fallback;

    state.mode = mode;
    state.remainingSeconds = remainingSeconds;
    state.running = false;
    state.lastUpdated = Date.now();
    applyTheme(typeof parsed.theme === "string" ? parsed.theme : "mocha");

    await saveState();
  } catch {
    state.mode = MODES.FOCUS;
    state.remainingSeconds = DEFAULT_SECONDS[MODES.FOCUS];
    state.running = false;
    state.lastUpdated = Date.now();
    applyTheme("mocha");
    await saveState();
  }
}

async function notifyModeComplete(completedMode) {
  const body = completedMode === MODES.FOCUS ? "Focus finished!" : "Break finished!";

  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }

    if (granted) {
      await sendNotification({
        title: "Pomodoro",
        body,
      });
    }
  } catch {
    // Keep timer behavior independent of notification delivery.
  }
}

async function completeCycle() {
  const finishedMode = state.mode;
  clearTimer();
  state.running = false;

  await notifyModeComplete(finishedMode);

  state.mode = finishedMode === MODES.FOCUS ? MODES.BREAK : MODES.FOCUS;
  state.remainingSeconds = defaultSecondsForMode(state.mode);

  setStatus(`${finishedMode} done. Switched to ${state.mode}.`);
  render();
  await saveState();
}

function tick() {
  if (!state.running) {
    return;
  }

  if (state.remainingSeconds <= 0) {
    void completeCycle();
    return;
  }

  state.remainingSeconds -= 1;
  render();
  void saveState();

  if (state.remainingSeconds <= 0) {
    void completeCycle();
  }
}

async function start() {
  if (state.running || state.remainingSeconds <= 0) {
    return;
  }

  state.running = true;
  setStatus("");
  render();
  await saveState();
  ensureSingleInterval();
}

async function pause() {
  if (!state.running) {
    return;
  }

  clearTimer();
  state.running = false;
  render();
  await saveState();
}

async function reset() {
  clearTimer();
  state.running = false;
  state.remainingSeconds = defaultSecondsForMode(state.mode);
  setStatus("");
  render();
  await saveState();
}

async function setMode(mode) {
  if (state.running || state.mode === mode) {
    return;
  }

  state.mode = mode;
  state.remainingSeconds = defaultSecondsForMode(mode);
  setStatus("");
  render();
  await saveState();
}

function isTextInputFocused() {
  const el = document.activeElement;
  if (!el) {
    return false;
  }
  return ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
}

function bindShortcuts() {
  window.addEventListener("keydown", (event) => {
    if (isTextInputFocused()) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === " ") {
      event.preventDefault();
      if (state.running) {
        void pause();
      } else {
        void start();
      }
      return;
    }

    if (key === "r") {
      event.preventDefault();
      void reset();
      return;
    }

    if (key === "f") {
      event.preventDefault();
      if (!state.running) {
        void setMode(MODES.FOCUS);
      }
      return;
    }

    if (key === "b") {
      event.preventDefault();
      if (!state.running) {
        void setMode(MODES.BREAK);
      }
    }
  });
}

async function init() {
  applyTheme("mocha");
  await loadState();
  clearTimer();
  state.running = false;
  render();

  ui.startBtn.addEventListener("click", () => {
    void start();
  });

  ui.pauseBtn.addEventListener("click", () => {
    void pause();
  });

  ui.resetBtn.addEventListener("click", () => {
    void reset();
  });

  ui.focusBtn.addEventListener("click", () => {
    void setMode(MODES.FOCUS);
  });

  ui.breakBtn.addEventListener("click", () => {
    void setMode(MODES.BREAK);
  });

  ui.themeSelect.addEventListener("change", () => {
    applyTheme(ui.themeSelect.value);
    void saveState();
  });

  bindShortcuts();

  window.addEventListener("beforeunload", () => {
    clearTimer();
    state.running = false;
    void saveState();
  });
}

void init();
