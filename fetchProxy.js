async function fetchProxies() {
    const response = await fetch('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=1000&country=all&ssl=all&anonymity=all');
    const proxyList = await response.text();
    return proxyList.split('\n').map(proxy => {
      const [host, port] = proxy.split(':');
      return { scheme: 'http', host, port };
    });
  }
  