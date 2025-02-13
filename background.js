
import { API_KEY, API_URL } from './config.js';
console.log(API_KEY ,API_URL )

var username = null 
var password = null
// Fetch a proxy from Webshare
async function fetchProxy() {
  try {
    const response = await fetch(API_URL, {
      headers: { 'Authorization': `Token ${API_KEY}` }
    });
    const data = await response.json();
    console.log('Fetched proxy data:', data.results);
    if (!data.results || data.results.length === 0) {
      throw new Error('No proxies available');
    }
    // Return the first proxy in the list
    username = data.results[0].username
    password = data.results[0].password
    return data.results[0];

  } catch (error) {
    console.error('Error fetching proxy:', error);
    throw error;
  }
}

// Apply the proxy settings using chrome.proxy.settings.set
function setChromeProxy(proxy) {
  const config = {
    mode: 'fixed_servers',
    rules: {
      singleProxy: {
        scheme: 'http',
        host: proxy.proxy_address,
        port: parseInt(proxy.port, 10)
      },
      bypassList: []
    }
  };
  chrome.proxy.settings.set({ value: config, scope: 'regular' }, function() {
    if (chrome.runtime.lastError) {
      console.error('Error setting proxy:', chrome.runtime.lastError);
    } else {
      console.log('Proxy set to:', proxy.proxy_address);
    }
  });
}

// Fetch the proxy and then set it
async function setProxy() {
  const proxy = await fetchProxy();
  setChromeProxy(proxy);
  return proxy;
}

// Reset proxy settings to use direct connection
function resetProxy() {
  chrome.proxy.settings.set({ value: { mode: 'direct' }, scope: 'regular' }, function() {
    if (chrome.runtime.lastError) {
      console.error('Error resetting proxy:', chrome.runtime.lastError);
    } else {
      console.log('Proxy reset to direct connection.');
    }
  });
}

// (Optional) Automatically set proxy on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed.');
  // Uncomment the next line if you want to auto-activate a proxy on install:
  // setProxy().catch(err => console.error(err));
});

// Listen for messages from popup to set or reset the proxy
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setProxy') {
    setProxy()
      .then(proxy => sendResponse({ status: 'success', proxy: proxy }))
      .catch(error => sendResponse({ status: 'error', error: error.message }));
    return true; // Inform Chrome that sendResponse will be called asynchronously.
  }
  if (message.action === 'resetProxy') {
    resetProxy();
    sendResponse({ status: 'success' });
    return true;
  }
});




  chrome.webRequest.onAuthRequired.addListener(
    function(details, callbackFn) {
        console.log("onAuthRequired!", details, callbackFn);
        callbackFn({
            authCredentials: {username: username , password: password}
        });
    },
    {urls: ["<all_urls>"]},
    ['asyncBlocking']
);
