chrome.runtime.onInstalled.addListener(() => {
  console.log('Proxy Manager Extension Installed');
});

// Listen for changes and apply the new proxy settings
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setProxy') {
      const config = {
          mode: 'fixed_servers',
          rules: {
              singleProxy: {
                  scheme: 'http',
                  host: message.host,
                  port: message.port
              },
              bypassList: []
          }
      };

      chrome.proxy.settings.set({ value: config, scope: 'regular' }, () => {
          sendResponse({ status: 'success' });
      });
      return true;  // Ensures async response
  }

  if (message.action === 'resetProxy') {
      chrome.proxy.settings.set({ value: { mode: 'direct' }, scope: 'regular' }, () => {
          sendResponse({ status: 'success' });
      });
      return true;
  }
});
