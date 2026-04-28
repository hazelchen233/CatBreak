// CatBreak - Background Service Worker
// Tracks global active browsing time and triggers the cat overlay on the current tab.

const DEFAULT_SETTINGS = {
  triggerMinutes: 30,
  cooldownMinutes: 5,
  countdownSeconds: 30,
  whitelist: [],
  enabled: true
};

const DEFAULT_TIMER_STATE = {
  elapsedMs: 0,
  sessionStart: null,
  isTiming: false,
  hasTriggered: false,
  activeTabId: null,
  activeTabUrl: ''
};

async function getSettings() {
  const result = await chrome.storage.sync.get('settings');
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

async function getTimerState() {
  const result = await chrome.storage.local.get('globalTimerState');
  return { ...DEFAULT_TIMER_STATE, ...result.globalTimerState };
}

async function saveTimerState(state) {
  await chrome.storage.local.set({ globalTimerState: state });
}

function getElapsedMs(state) {
  if (!state.isTiming || !state.sessionStart) return state.elapsedMs;
  return state.elapsedMs + Date.now() - state.sessionStart;
}

function isWhitelisted(url, whitelist) {
  if (!url) return true;
  try {
    const hostname = new URL(url).hostname;
    return whitelist.some(domain => hostname.includes(domain));
  } catch {
    return true;
  }
}

function isInjectableUrl(url) {
  return Boolean(url)
    && !url.startsWith('chrome://')
    && !url.startsWith('chrome-extension://')
    && !url.startsWith('edge://')
    && !url.startsWith('about:');
}

async function setActiveTab(tabId) {
  const state = await getTimerState();

  try {
    const tab = await chrome.tabs.get(tabId);
    state.activeTabId = tab.id;
    state.activeTabUrl = tab.url || '';
    state.isTiming = true;
    state.sessionStart = state.sessionStart || Date.now();
  } catch {
    state.activeTabId = null;
    state.activeTabUrl = '';
  }

  await saveTimerState(state);
  return state;
}

async function pauseGlobalTimer() {
  const state = await getTimerState();
  if (state.isTiming && state.sessionStart) {
    state.elapsedMs += Date.now() - state.sessionStart;
  }
  state.sessionStart = null;
  state.isTiming = false;
  await saveTimerState(state);
}

async function resumeGlobalTimer(activeTab) {
  const state = await getTimerState();
  state.activeTabId = activeTab.id;
  state.activeTabUrl = activeTab.url || '';
  if (!state.isTiming) {
    state.isTiming = true;
    state.sessionStart = Date.now();
  } else if (!state.sessionStart) {
    state.sessionStart = Date.now();
  }
  await saveTimerState(state);
  return state;
}

async function resetGlobalTimer(activeTab) {
  const state = {
    ...DEFAULT_TIMER_STATE,
    elapsedMs: 0,
    sessionStart: Date.now(),
    isTiming: true,
    hasTriggered: false,
    activeTabId: activeTab?.id || null,
    activeTabUrl: activeTab?.url || ''
  };
  await saveTimerState(state);
}

async function ensureOverlayReady(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['content.css']
  });
}

async function showCatOnActiveTab(state, settings) {
  if (!state.activeTabId || !isInjectableUrl(state.activeTabUrl)) return false;

  try {
    await ensureOverlayReady(state.activeTabId);
    await chrome.tabs.sendMessage(state.activeTabId, {
      action: 'showCat',
      countdownSeconds: settings.countdownSeconds
    });
    return true;
  } catch {
    return false;
  }
}

async function checkGlobalTrigger() {
  const settings = await getSettings();
  const state = await getTimerState();

  if (!settings.enabled || state.hasTriggered || !state.activeTabId) return;
  if (isWhitelisted(state.activeTabUrl, settings.whitelist)) return;

  const triggerMs = settings.triggerMinutes * 60 * 1000;
  if (getElapsedMs(state) < triggerMs) return;

  state.hasTriggered = true;
  await saveTimerState(state);

  const shown = await showCatOnActiveTab(state, settings);
  if (!shown) {
    state.hasTriggered = false;
    await saveTimerState(state);
  }
}

chrome.alarms.create('checkGlobalTimer', { periodInMinutes: 0.1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkGlobalTimer') {
    await checkGlobalTrigger();
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await setActiveTab(activeInfo.tabId);
  await checkGlobalTrigger();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url && !tab.url) return;

  const state = await getTimerState();
  if (tabId !== state.activeTabId) return;

  state.activeTabUrl = changeInfo.url || tab.url || '';
  await saveTimerState(state);
  await checkGlobalTrigger();
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = await getTimerState();
  if (state.activeTabId === tabId) {
    state.activeTabId = null;
    state.activeTabUrl = '';
    await saveTimerState(state);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    pauseGlobalTimer();
    return;
  }

  chrome.tabs.query({ active: true, windowId }, async (tabs) => {
    if (tabs[0]) {
      await resumeGlobalTimer(tabs[0]);
      await checkGlobalTrigger();
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'catDismissed') {
    resetGlobalTimer(sender.tab || null);
  }

  if (message.action === 'getTimeLeft' && sender.tab) {
    const respond = async () => {
      const settings = await getSettings();
      const state = await getTimerState();
      const triggerMs = settings.triggerMinutes * 60 * 1000;
      const remaining = Math.max(0, triggerMs - getElapsedMs(state));
      return { remainingMs: remaining, triggerMs };
    };
    respond().then(data => {
      try {
        chrome.tabs.sendMessage(sender.tab.id, { action: 'timeLeftResponse', ...data });
      } catch { /* ignore */ }
    });
  }
});

chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  if (tabs[0]) {
    await resumeGlobalTimer(tabs[0]);
  }
});
