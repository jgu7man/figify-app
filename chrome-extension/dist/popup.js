"use strict";
async function checkConnection(url) {
    const dotEl = document.getElementById('connection-dot');
    const textEl = document.getElementById('connection-text');
    const containerEl = document.getElementById('backend-url-container');
    if (textEl)
        textEl.textContent = 'Connecting...';
    if (dotEl) {
        dotEl.style.backgroundColor = '#e2e8f0';
        dotEl.style.boxShadow = 'none';
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const response = await fetch(`${url}/api/figma/status`, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) {
            if (textEl) {
                const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
                textEl.textContent = isLocal ? 'Connected (Local)' : 'Connected (Remote)';
                textEl.style.color = '#34d399';
            }
            if (dotEl) {
                dotEl.style.backgroundColor = '#10b981';
                dotEl.style.boxShadow = '0 0 8px #10b981';
            }
            if (containerEl) {
                containerEl.style.display = 'none'; // Hide URL config by default if connected
            }
            return true;
        }
    }
    catch (e) {
        // Fail silently, fallback to offline state below
    }
    if (textEl) {
        textEl.textContent = 'Offline';
        textEl.style.color = '#f87171';
    }
    if (dotEl) {
        dotEl.style.backgroundColor = '#ef4444';
        dotEl.style.boxShadow = '0 0 8px #ef4444';
    }
    if (containerEl) {
        containerEl.style.display = 'flex'; // Show URL config if offline
    }
    return false;
}
// On popup load, restore saved Backend URL and check connection
document.addEventListener('DOMContentLoaded', async () => {
    const urlInput = document.getElementById('backend-url');
    if (urlInput) {
        const data = await chrome.storage.local.get('backendUrl');
        let activeUrl = 'https://figify-app--figify-app.us-central1.hosted.app';
        if (data.backendUrl) {
            activeUrl = data.backendUrl;
            urlInput.value = activeUrl;
        }
        else {
            // Auto-detect active local server port on startup if no custom URL is saved
            const ports = [3000, 4200, 4000];
            for (const port of ports) {
                try {
                    const url = `http://localhost:${port}`;
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 400);
                    const response = await fetch(`${url}/api/figma/status`, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (response.ok) {
                        activeUrl = url;
                        urlInput.value = activeUrl;
                        console.log("Successfully auto-detected active local backend at:", url);
                        break;
                    }
                }
                catch (e) {
                    // Port not active, continue probing
                }
            }
        }
        // Verify connection status
        await checkConnection(activeUrl);
    }
    // Toggle server URL configuration panel on badge click
    document.getElementById('connection-badge')?.addEventListener('click', () => {
        const container = document.getElementById('backend-url-container');
        if (container) {
            const isHidden = container.style.display === 'none';
            container.style.display = isHidden ? 'flex' : 'none';
        }
    });
});
document.getElementById('extract-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('extract-btn');
    const statusEl = document.getElementById('status');
    const urlInput = document.getElementById('backend-url');
    const backendUrl = urlInput ? urlInput.value.trim() : 'https://figify-app--figify-app.us-central1.hosted.app';
    if (btn)
        btn.disabled = true;
    statusEl.textContent = 'Extracting DOM...';
    statusEl.className = 'status-text';
    try {
        // Save to storage
        await chrome.storage.local.set({ backendUrl });
        // Update connection status
        await checkConnection(backendUrl);
        // 1. Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            throw new Error('No active browser tab found.');
        }
        // 2. Inject content script
        statusEl.textContent = 'Scanning layout...';
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['dist/content-script.js']
        });
        if (!results || !results[0] || !results[0].result) {
            throw new Error('Could not extract layout from page.');
        }
        const payload = results[0].result;
        payload.name = tab.title || 'Extracted Tab';
        // 3. Sync to backend server
        statusEl.textContent = `Syncing to ${backendUrl}...`;
        const response = await fetch(`${backendUrl}/api/figma/designs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Server Sync failed: ${errText || response.statusText}`);
        }
        statusEl.textContent = 'Successfully synced to Figma!';
        statusEl.className = 'status-text status-success';
    }
    catch (err) {
        console.error(err);
        statusEl.textContent = err.message || 'Error occurred';
        statusEl.className = 'status-text status-error';
    }
    finally {
        if (btn)
            btn.disabled = false;
    }
});
