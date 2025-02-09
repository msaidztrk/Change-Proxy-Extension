document.addEventListener('DOMContentLoaded', () => {
    const proxySelect = document.getElementById('proxySelect');
    const applyProxyButton = document.getElementById('applyProxy');
    const disableProxyButton = document.getElementById('disableProxy');
    const testAndApplyProxyButton = document.getElementById('testAndApplyProxy');
    const statusDiv = document.getElementById('status');

    let currentProxies = [];
    const testUrl = 'http://bcrain.site/login';
    let proxyTestInterval;

    // Proxy listesini al
    async function fetchProxies() {
        try {
            const response = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=1000&country=all&ssl=all&anonymity=all');
            const data = await response.text();
            
            currentProxies = data.split(/\r?\n/).map(proxy => {
                const [host, port] = proxy.trim().split(':');
                return { host, port: parseInt(port, 10) };
            }).filter(proxy => proxy.host && !isNaN(proxy.port));

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
    }

    // Proxy uygula ve test et
    async function applyAndTestProxy(proxy) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { action: 'setProxy', host: proxy.host, port: proxy.port },
                async (response) => {
                    if (response.status === 'success') {
                        try {
                            const testResponse = await fetch(testUrl, {
                                method: 'GET',
                                cache: 'no-cache'
                            });

                            if (testResponse.ok) {
                                statusDiv.textContent = `Working proxy: ${proxy.host}:${proxy.port}`;
                                console.log('Working proxy:', proxy);
                                resolve(true);
                            } else {
                                resolve(false);
                            }
                        } catch (error) {
                            resolve(false);
                        }
                    } else {
                        resolve(false);
                    }
                }
            );
        });
    }

    // Proxy test sürecini başlat
    async function startProxyTest() {
        if (currentProxies.length === 0) {
            statusDiv.textContent = 'No proxies available';
            return;
        }

        const shuffledProxies = [...currentProxies].sort(() => Math.random() - 0.5);
        
        for (const proxy of shuffledProxies) {
            statusDiv.textContent = `Testing ${proxy.host}:${proxy.port}...`;
            const success = await applyAndTestProxy(proxy);
            
            if (success) {
                return;
            } else {
                // Başarısız proxy'yi devre dışı bırak
                chrome.runtime.sendMessage({ action: 'resetProxy' });
            }
        }
        
        statusDiv.textContent = 'No working proxy found';
    }

    // Send a request to test the current proxy every 30 seconds
    function checkProxyHealth() {
        setInterval(async () => {
            try {
                const response = await fetch(testUrl, { method: 'GET', cache: 'no-cache' });

                if (response.ok) {
                    console.log('Proxy is working');
                    return; // Do nothing if the proxy works
                } else {
                    console.log('Proxy failed, resetting...');
                    // If the proxy fails, disable the proxy, fetch proxies again, and start testing
                    chrome.runtime.sendMessage({ action: 'resetProxy' });
                    statusDiv.textContent = 'Proxy failed, restarting proxy test...';
                    fetchProxies().then(() => startProxyTest());
                }
            } catch (error) {
                console.log('Error checking proxy:', error);
                // If error, disable the proxy, fetch proxies again, and start testing
                chrome.runtime.sendMessage({ action: 'resetProxy' });
                statusDiv.textContent = 'Proxy error, restarting proxy test...';
                fetchProxies().then(() => startProxyTest());
            }
        }, 30000); // 30 seconds interval
    }

    // Buton eventleri
    testAndApplyProxyButton.addEventListener('click', () => startProxyTest());
    applyProxyButton.addEventListener('click', () => {
        const [host, port] = proxySelect.value.split(':');
        applyAndTestProxy({ host, port: parseInt(port) });
    });
    disableProxyButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'resetProxy' });
        statusDiv.textContent = 'Proxy disabled';
    });

    // İlk proxy listesini yükle ve başlat
    fetchProxies().then(() => startProxyTest());
    checkProxyHealth(); // Start the interval for checking proxy health
});
