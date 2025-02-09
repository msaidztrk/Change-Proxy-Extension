document.addEventListener('DOMContentLoaded', () => {
    const proxySelect = document.getElementById('proxySelect');
    const applyProxyButton = document.getElementById('applyProxy');
    const disableProxyButton = document.getElementById('disableProxy');
    const testAndApplyProxyButton = document.getElementById('testAndApplyProxy');
    const statusDiv = document.getElementById('status'); 


    const urls = [
        'http://bcrain.site/login',
        'https://api.jikan.moe/v4/anime?q=naruto',
        'https://www.whenisthenextmcufilm.com/api',
        'https://openlibrary.org/search.json?q=the+lord+of+the+rings',
        'https://www.reddit.com/r/Wallstreetbets/top.json?limit=10&t=year',
        'https://tradestie.com/api/v1/apps/reddit',
        'https://rickandmortyapi.com/api/character/108',
        'https://stapi.co/api/v2/rest/spacecraft/search',
        'https://swapi.dev/api/planets/3/?format=json',
        'https://the-rosary-api.vercel.app/v1/today',
        'http://api.tvmaze.com/search/shows?q=golden girls',
        'https://wolnelektury.pl/api/authors/edgar-allan-poe/',
        'https://api4.binance.com/api/v3/ticker/24hr',
        'https://api.coinbase.com/v2/currencies',
        'https://api.coincap.io/v2/assets',
        'https://api.coindesk.com/v1/bpi/currentprice.json',
        // Add more URLs as needed
    ];

    let currentUrlIndex = 0;

    function getNextUrl() {
        const url = urls[currentUrlIndex];
        currentUrlIndex = (currentUrlIndex + 1) % urls.length;
        return url;
    } 

  
    let currentProxies = [];
    const testUrl = 'http://bcrain.site/login';
    let isTesting = false; // flag to prevent multiple simultaneous tests
  
    // Store proxies in local storage with a timestamp.
    function storeProxiesInLocalStorage(proxies) {
      const timestamp = new Date().getTime();
      localStorage.setItem('proxies', JSON.stringify({ proxies, timestamp }));
    }
  
    // Retrieve proxies from local storage if they are less than 30 minutes old.
    function getProxiesFromLocalStorage() {
      const data = localStorage.getItem('proxies');
      if (data) {
        const { proxies, timestamp } = JSON.parse(data);
        const thirtyMinutesInMilliseconds = 30 * 60 * 1000;
        if (new Date().getTime() - timestamp < thirtyMinutesInMilliseconds) {
          return proxies;
        } else {
          localStorage.removeItem('proxies'); // Expired proxies
          return [];
        }
      }
      return [];
    }
  
    // Fetch proxies from the GeoNode API or use local storage if available.
    async function fetchProxies() {
      // Try to load from local storage first.
      currentProxies = getProxiesFromLocalStorage();
  
      if (currentProxies.length === 0) {
        try {
          const response = await fetch('https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc');
          const data = await response.json();
          // Map each proxy from the API to an object with host and port.
          currentProxies = data.data
            .map(proxy => {
              return { host: proxy.ip, port: parseInt(proxy.port, 10) };
            })
            .filter(proxy => proxy.host && !isNaN(proxy.port));
  
          // Store the fetched proxies in local storage.
          storeProxiesInLocalStorage(currentProxies);
  
          // Populate the select element.
          proxySelect.innerHTML = '<option value="">Select a proxy</option>';
          currentProxies.forEach(proxy => {
            const option = new Option(`${proxy.host}:${proxy.port}`, `${proxy.host}:${proxy.port}`);
            proxySelect.add(option);
          });
          applyProxyButton.disabled = false;
          statusDiv.textContent = `${currentProxies.length} proxies loaded`;
        } catch (error) {
          console.error('Proxy fetch error:', error);
          statusDiv.textContent = 'Error loading proxies';
        }
      } else {
        // Use cached proxies.
        proxySelect.innerHTML = '<option value="">Select a proxy</option>';
        currentProxies.forEach(proxy => {
          const option = new Option(`${proxy.host}:${proxy.port}`, `${proxy.host}:${proxy.port}`);
          proxySelect.add(option);
        });
        applyProxyButton.disabled = false;
        statusDiv.textContent = `${currentProxies.length} proxies loaded from cache`;
      }
    }
  
    // Apply and test the given proxy.
    async function applyAndTestProxy(proxy) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'setProxy', host: proxy.host, port: proxy.port },
          async (response) => {
            if (response.status === 'success') {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout
                const url = getNextUrl();
                const testResponse = await fetch(url, {
                  method: 'GET',
                  cache: 'no-cache',
                  signal: controller.signal
                });
  
                console.log('Request sent using proxy:', proxy);
                clearTimeout(timeoutId);
  
                if (testResponse.ok) {
                  statusDiv.textContent = `Working proxy: ${proxy.host}:${proxy.port}`;
                  console.log('Working proxy:', proxy);
                  resolve(true);
                } else {
                  resolve(false);
                }
              } catch (error) {
                if (error.name === 'AbortError') {
                  console.log('Proxy took too long, considered as failed.');
                }
                resolve(false);
              }
            } else {
              resolve(false);
            }
          }
        );
      });
    }
  
    // Start the proxy testing process.
    async function startProxyTest() {
      if (isTesting) {
        console.log('Proxy test already in progress, skipping new test.');
        return;
      }
      isTesting = true;
      try {
        if (currentProxies.length === 0) {
          statusDiv.textContent = 'No proxies available';
          return;
        }
        // Shuffle proxies to choose randomly.
        const shuffledProxies = [...currentProxies].sort(() => Math.random() - 0.5);
        let proxyFound = false;
        for (const proxy of shuffledProxies) {
          statusDiv.textContent = `Testing ${proxy.host}:${proxy.port}...`;
          const success = await applyAndTestProxy(proxy);
          if (success) {
            proxyFound = true;
            break; // Stop once a working proxy is found.
          } else {
            chrome.runtime.sendMessage({ action: 'resetProxy' });
          }
        }
        if (!proxyFound) {
          statusDiv.textContent = 'No working proxy found';
        }
      } finally {
        isTesting = false;
      }
    }
  
    // Check the current proxy's health every 30 seconds.
    function checkProxyHealth() {
      setInterval(async () => {
        // Skip health check if a proxy test is already running.
        if (isTesting) {
          console.log('Skipping health check since a proxy test is in progress.');
          return;
        }
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000); // 5 seconds timeout
          const url = getNextUrl();
          const response = await fetch(url, {
            method: 'GET',
            cache: 'no-cache',
            signal: controller.signal
          });
  
          clearTimeout(timeoutId);
  
          if (response.ok) {
            console.log('Proxy is working');
            // Nothing to do if the current proxy is healthy.
            return;
          } else {
            console.log('Proxy failed, resetting...');
            chrome.runtime.sendMessage({ action: 'resetProxy' });
            statusDiv.textContent = 'Proxy failed, restarting proxy test...';
            // Fetch new proxies and start testing until one works.
            fetchProxies().then(() => startProxyTest());
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log('Proxy request timed out.');
          } else {
            console.log('Error checking proxy:', error);
          }
          chrome.runtime.sendMessage({ action: 'resetProxy' });
          statusDiv.textContent = 'Proxy error or timeout, restarting proxy test...';
          fetchProxies().then(() => startProxyTest());
        }
      }, 30000); // Run every 30 seconds.
    }
  
    // Button event listeners.
    testAndApplyProxyButton.addEventListener('click', () => startProxyTest());
  
    applyProxyButton.addEventListener('click', () => {
      const [host, port] = proxySelect.value.split(':');
      applyAndTestProxy({ host, port: parseInt(port) });
    });
  
    disableProxyButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'resetProxy' });
      statusDiv.textContent = 'Proxy disabled';
    });
  
    // Load proxies, start proxy testing, and begin health checking.
    fetchProxies()
      .then(() => startProxyTest())
      .then(() => checkProxyHealth());
  });
  chrome.runtime.sendMessage({ action: 'resetProxy' });