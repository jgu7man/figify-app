document.getElementById('extract-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('extract-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('status') as HTMLElement;
  
  if (btn) btn.disabled = true;
  statusEl.textContent = 'Extracting DOM...';
  statusEl.className = 'status-text';

  try {
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

    const payload = results[0].result as any;
    payload.name = tab.title || 'Extracted Tab';

    // 3. Sync to local backend server
    statusEl.textContent = 'Syncing to local server...';
    
    const response = await fetch('http://localhost:3000/api/figma/designs', {
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
  } catch (err: any) {
    console.error(err);
    statusEl.textContent = err.message || 'Error occurred';
    statusEl.className = 'status-text status-error';
  } finally {
    if (btn) btn.disabled = false;
  }
});
