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
const saveBtn = document.getElementById('saveBtn');
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

// Save settings explicitly via button
saveBtn.addEventListener('click', () => {
  const settings = {
    enabled: enabledEl.checked,
    triggerMinutes: parseInt(triggerEl.value, 10),
    countdownSeconds: parseInt(countdownEl.value, 10),
    whitelist: whitelistEl.value
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0),
    cooldownMinutes: 5
  };
  chrome.storage.sync.set({ settings }, () => {
    // Notify background to apply new settings immediately (reset timer state)
    chrome.runtime.sendMessage({ action: 'settingsUpdated' }, () => {
      // Swallow any "no receiver" error
      void chrome.runtime.lastError;
    });
    showStatus('Settings saved ✓');
  });
});
