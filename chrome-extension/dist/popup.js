"use strict";
// On popup load, restore saved Backend URL
document.addEventListener('DOMContentLoaded', async () => {
    const urlInput = document.getElementById('backend-url');
    if (urlInput) {
        const data = await chrome.storage.local.get('backendUrl');
        if (data.backendUrl) {
            urlInput.value = data.backendUrl;
        }
    }
});
document.getElementById('extract-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('extract-btn');
    const statusEl = document.getElementById('status');
    const urlInput = document.getElementById('backend-url');
    const backendUrl = urlInput ? urlInput.value.trim() : 'http://localhost:3000';
    if (btn)
        btn.disabled = true;
    statusEl.textContent = 'Extracting DOM...';
    statusEl.className = 'status-text';
    try {
        // Save to storage
        await chrome.storage.local.set({ backendUrl });
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
