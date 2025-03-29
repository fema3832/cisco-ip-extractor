function processLog() {
    const log = document.getElementById('logInput').value;
    const lines = log.split('\n');

    const devices = {};
    let currentDevice = null;
    let currentInterface = null;

    lines.forEach(line => {
        const parts = line.trim().split(/\s{2,}/);
        if (parts.length < 2) return;

        const deviceName = parts[0];
        let rawConfig = parts[1];
        rawConfig = rawConfig.replace(/^.*?#/, '').trim();

        if (deviceName) {
            currentDevice = deviceName;
            devices[currentDevice] = devices[currentDevice] || {};
        }

        if (/^(exit|ex)$/i.test(rawConfig)) {
            currentInterface = null;
            return;
        }

        const ifaceMatch = /^interface\s+([\w\s/.\-]+)/i.exec(rawConfig);
        if (ifaceMatch) {
            const ifaceRaw = ifaceMatch[1].trim();
            if (/\d/.test(ifaceRaw)) {
                const iface = normalizeInterfaceName(ifaceRaw);
                currentInterface = iface;
                devices[currentDevice][currentInterface] = devices[currentDevice][currentInterface] || { ipv4: null, ipv6: null };
            } else {
                currentInterface = null;
            }
            return;
        }

        if (!currentInterface) return;

        const ipv4Match = /ip address\s+([\d.]+)(?:\s+[\d.]+)?/i.exec(rawConfig);
        if (ipv4Match) {
            devices[currentDevice][currentInterface].ipv4 = ipv4Match[1];
        }

        const ipv6Match = /ipv6 address\s+([\w:]+(?:\/\d+)?)/i.exec(rawConfig);
        if (ipv6Match) {
            devices[currentDevice][currentInterface].ipv6 = ipv6Match[1];
        }
    });

    const output = document.getElementById('output');
    output.innerHTML = '';

    for (const [device, interfaces] of Object.entries(devices)) {
        // Összevonjuk az azonos interfészeket (pl. fa0/1 és f0/1)
        const mergedInterfaces = {};
        for (const [iface, ips] of Object.entries(interfaces)) {
            const mergedKey = mergeInterfaceKey(iface);
            if (!mergedInterfaces[mergedKey]) {
                mergedInterfaces[mergedKey] = { ipv4: null, ipv6: null };
            }
            if (ips.ipv4) mergedInterfaces[mergedKey].ipv4 = ips.ipv4;
            if (ips.ipv6) mergedInterfaces[mergedKey].ipv6 = ips.ipv6;
        }

        // Csak IP-vel rendelkező interfészek
        const filteredInterfaces = Object.entries(mergedInterfaces).filter(([_, ips]) => ips.ipv4 || ips.ipv6);
        if (filteredInterfaces.length === 0) continue;

        const deviceDiv = document.createElement('div');
        deviceDiv.classList.add('card', 'w-auto', 'mb-5', 'p-3', 'shadow', 'border-secondary');
        deviceDiv.innerHTML = `<h2 class="card-header mb-3">${device}</h2>`;

        filteredInterfaces.forEach(([iface, ips], index) => {
            const ifaceDiv = document.createElement('div');
            ifaceDiv.classList.add('ms-3');
            // Ha az utolsó elem, akkor kapjon mb-3 margint
            if (index === filteredInterfaces.length - 1) {
                ifaceDiv.classList.add('mb-3');
            }
            ifaceDiv.innerHTML = `<h5 class="fw-bold">${iface}:</h5>IPv4: ${ips.ipv4 || 'None'}<br>IPv6: ${ips.ipv6 || 'None'}`;
            deviceDiv.appendChild(ifaceDiv);
        
            // Közé csak <br> kerüljön, az utolsó után már ne
            if (index < filteredInterfaces.length - 1) {
                deviceDiv.appendChild(document.createElement("hr"));
            }
        });
        

        output.appendChild(deviceDiv);
    }

    hasInter = true;
    if (output.innerHTML.trim() === '') {
        output.innerHTML = '<p class="text-center fw-bold">Nincsen interfész IP címmel!</p>';
        hasInter = false;
    }

    const btn = document.createElement("div")
    btn.classList.add("text-center", "m-0")
    output.appendChild(btn)
    if (hasInter) btn.innerHTML = '<button class="btn btn-primary mb-5" id="downloadTXT" onclick="downloadAsTxt()">Mentés TXT-be</button>'
}

function normalizeInterfaceName(name) {
    return name
        .toLowerCase()
        .replace(/^fastethernet/, 'fa')
        .replace(/^gigabitethernet/, 'gi')
        .replace(/^ethernet/, 'eth')
        .replace(/^serial/, 's')
        .replace(/\s+/g, '');
}

function mergeInterfaceKey(name) {
    if (/^f(\d\/\d+)/.test(name)) {
        return name.replace(/^f/, 'fa');
    }
    return name;
}

function downloadAsTxt() {
    const output = document.getElementById('output');
    if (!output.innerHTML.trim()) {
        alert("Nincs menthető adat!");
        return;
    }

    let textContent = '';

    output.querySelectorAll('.card').forEach(card => {
        const deviceName = card.querySelector('h2')?.innerText || 'Ismeretlen eszköz';
        textContent += `${deviceName}\n`;

        card.querySelectorAll('div.ms-3').forEach(ifaceDiv => {
            const ifaceTitle = ifaceDiv.querySelector('h5')?.innerText.replace(':', '') || 'Ismeretlen interfész';
            const lines = ifaceDiv.innerText.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith(ifaceTitle));
            const ipv4 = lines.find(line => line.toLowerCase().startsWith('ipv4')) || 'IPv4: Nincsen';
            const ipv6 = lines.find(line => line.toLowerCase().startsWith('ipv6')) || 'IPv6: Nincsen';
            textContent += `  ${ifaceTitle}\n    ${ipv4}\n    ${ipv6}\n`;
        });

        textContent += `\n`;
    });

    const blob = new Blob([textContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'interfaces_output.txt';
    link.click();
    URL.revokeObjectURL(link.href);
}
