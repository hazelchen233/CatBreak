// CatBreak - Content Script
// Handles the cat overlay display and interaction

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__catBreakInjected) return;
  window.__catBreakInjected = true;

  let overlay = null;

  function createOverlay(countdownSeconds) {
    if (overlay) return;

    const videoUrl = chrome.runtime.getURL('assets/cat.webm');

    overlay = document.createElement('div');
    overlay.id = 'catbreak-overlay';
    overlay.innerHTML = `
      <div class="catbreak-backdrop"></div>
      <div class="catbreak-cat-container">
        <video class="catbreak-cat-video" autoplay loop muted playsinline>
          <source src="${videoUrl}" type="video/webm">
        </video>
      </div>
      <div class="catbreak-message">
        <div class="catbreak-title">🐱 Time to take a break!</div>
        <div class="catbreak-subtitle">You've been staring at the screen for too long, rest your eyes for a bit</div>
        <div class="catbreak-countdown">${countdownSeconds}</div>
        <button class="catbreak-btn">😸 Back to work</button>
      </div>
    `;

    document.documentElement.appendChild(overlay);

    // Slide in animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add('catbreak-visible');
      });
    });

    // Countdown
    let remaining = countdownSeconds;
    const countdownEl = overlay.querySelector('.catbreak-countdown');
    const btn = overlay.querySelector('.catbreak-btn');

    const countdownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        countdownEl.textContent = '';
        btn.classList.add('catbreak-btn-show');
      } else {
        countdownEl.textContent = remaining;
      }
    }, 1000);

    btn.addEventListener('click', () => {
      dismissCat();
    });
  }

  function dismissCat() {
    if (!overlay) return;

    overlay.classList.remove('catbreak-visible');
    overlay.classList.add('catbreak-leaving');

    // Stop video
    const video = overlay.querySelector('video');
    if (video) video.pause();

    setTimeout(() => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      overlay = null;
    }, 800);

    // Notify background
    chrome.runtime.sendMessage({ action: 'catDismissed' }).catch(() => {});
  }

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showCat') {
      createOverlay(message.countdownSeconds || 30);
    }
  });
})();
