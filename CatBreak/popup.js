// CatBreak - Popup Settings Script

const DEFAULT_SETTINGS = {
  triggerMinutes: 30,
  cooldownMinutes: 5,
  countdownSeconds: 30,
  whitelist: [],
  enabled: true
};

const enabledEl = document.getElementById('enabled');
const triggerEl = document.getElementById('triggerMinutes');
const triggerValueEl = document.getElementById('triggerValue');
const countdownEl = document.getElementById('countdownSeconds');
const countdownValueEl = document.getElementById('countdownValue');
const whitelistEl = document.getElementById('whitelist');
const testBtn = document.getElementById('testBtn');
const statusMsg = document.getElementById('statusMsg');

// Load saved settings
chrome.storage.sync.get('settings', (result) => {
  const s = { ...DEFAULT_SETTINGS, ...result.settings };
  enabledEl.checked = s.enabled;
  triggerEl.value = s.triggerMinutes;
  triggerValueEl.textContent = s.triggerMinutes;
  countdownEl.value = s.countdownSeconds;
  countdownValueEl.textContent = s.countdownSeconds;
  whitelistEl.value = s.whitelist.join('\n');
});

// Save settings on change
function saveSettings() {
  const settings = {
    enabled: enabledEl.checked,
    triggerMinutes: parseInt(triggerEl.value),
    countdownSeconds: parseInt(countdownEl.value),
    whitelist: whitelistEl.value
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0),
    cooldownMinutes: 5
  };
  chrome.storage.sync.set({ settings }, () => {
    showStatus('Settings saved ✓');
  });
}

function showStatus(msg) {
  statusMsg.textContent = msg;
  setTimeout(() => { statusMsg.textContent = ''; }, 2000);
}

// Range slider live update
triggerEl.addEventListener('input', () => {
  triggerValueEl.textContent = triggerEl.value;
});
countdownEl.addEventListener('input', () => {
  countdownValueEl.textContent = countdownEl.value;
});

// Save on change
enabledEl.addEventListener('change', saveSettings);
triggerEl.addEventListener('change', saveSettings);
countdownEl.addEventListener('change', saveSettings);
whitelistEl.addEventListener('change', saveSettings);

// Test button
testBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
    showStatus('Cannot test on this page, please switch to a normal webpage');
    return;
  }
  try {
    // Ensure content script is injected
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content.css']
    });
    await chrome.tabs.sendMessage(tab.id, {
      action: 'showCat',
      countdownSeconds: 5
    });
    showStatus('Cat dispatched! 🐱');
  } catch (e) {
    showStatus('Cannot test on this page, please switch to a normal webpage');
  }
});
