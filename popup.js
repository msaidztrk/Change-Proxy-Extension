document.getElementById('connectProxy').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'setProxy' }, (response) => {
    const statusEl = document.getElementById('status');
    if (response && response.status === 'success') {
      statusEl.innerText = 'Proxy Connected Successfully';
    } else {
      statusEl.innerText = 'Failed to Connect Proxy';
    }
  });
});

document.getElementById('disableProxy').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'resetProxy' }, (response) => {
    const statusEl = document.getElementById('status');
    if (response && response.status === 'success') {
      statusEl.innerText = 'Proxy Disabled. Default IP in use.';
    } else {
      statusEl.innerText = 'Failed to Disable Proxy';
    }
  });
});
