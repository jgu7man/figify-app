import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// Load .env file variables into process.env
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    });
  } catch (err) {
    console.error('Failed to parse .env file:', err);
  }
}

const browserDistFolder = join(import.meta.dirname, '../browser');
const DESIGNS_FILE = join(process.cwd(), 'designs.json');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Custom CORS middleware to allow connection from Figma Plugin iframe
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Helper functions to persist designs
function getDesigns() {
  if (!existsSync(DESIGNS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(DESIGNS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveDesigns(designs: any[]) {
  writeFileSync(DESIGNS_FILE, JSON.stringify(designs, null, 2), 'utf-8');
}

/**
 * Figma OAuth and Design Endpoints
 */
app.get('/api/figma/auth', (req, res) => {
  const clientId = process.env['FIGMA_CLIENT_ID'];
  const redirectUri = `${req.protocol}://${req.headers.host}/api/figma/callback`;
  const state = (req.query['state'] as string) || 'web';
  const authUrl = `https://www.figma.com/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=current_user:read&state=${state}&response_type=code`;
  res.redirect(authUrl);
});

app.get('/api/figma/callback', async (req, res) => {
  const code = req.query['code'];
  const state = req.query['state'] as string;
  const clientId = process.env['FIGMA_CLIENT_ID'];
  const clientSecret = process.env['FIGMA_CLIENT_SECRET'];
  const redirectUri = `${req.protocol}://${req.headers.host}/api/figma/callback`;

  if (!code) {
    res.status(400).send('Missing authorization code');
    return;
  }

  try {
    const response = await fetch('https://api.figma.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        code: code as string,
        grant_type: 'authorization_code'
      })
    });

    const data = (await response.json()) as any;
    if (data.access_token) {
      res.cookie('figma_token', data.access_token, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: false });
      
      if (state === 'plugin') {
        res.redirect('/figma-plugin-auth.html');
        return;
      }
    }
  } catch (err) {
    console.error('OAuth error during exchange:', err);
  }
  res.redirect('/');
});

app.post('/api/figma/mock-login', (req, res) => {
  res.cookie('figma_token', 'mock_access_token', { maxAge: 900000, httpOnly: false });
  res.json({ success: true });
});

app.get('/api/figma/status', (req, res) => {
  const token = req.headers.cookie?.includes('figma_token=') || req.headers.authorization;
  res.json({ connected: !!token });
});

app.post('/api/figma/disconnect', (req, res) => {
  res.clearCookie('figma_token');
  res.json({ success: true });
});

// Image Proxy Endpoint to bypass CORS
app.get('/api/images/proxy', async (req, res) => {
  const url = req.query['url'] as string;
  if (!url) {
    res.status(400).send('Missing url parameter');
    return;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      res.status(response.status).send(`Failed to fetch image: ${response.statusText}`);
      return;
    }
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  } catch (err) {
    console.error('Image proxy error:', err);
    res.status(500).send('Internal server error proxying image');
  }
});

// Helper functions to fetch images and convert to base64
async function fetchAndBase64(url: string, reqHeadersHost: string, isHttps: boolean): Promise<string | null> {
  try {
    let targetUrl = url;
    if (url.startsWith('/')) {
      const protocol = isHttps ? 'https' : 'http';
      targetUrl = `${protocol}://${reqHeadersHost}${url}`;
    }
    const response = await fetch(targetUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch image from: ${targetUrl}. Status: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  } catch (err) {
    console.error(`Error fetching/converting image from: ${url}`, err);
    return null;
  }
}

async function resolveNodeImages(node: any, reqHeadersHost: string, isHttps: boolean) {
  if (node.imageUrl) {
    if (node.imageUrl.toLowerCase().includes('.svg')) {
      try {
        let targetUrl = node.imageUrl;
        if (node.imageUrl.startsWith('/')) {
          const protocol = isHttps ? 'https' : 'http';
          targetUrl = `${protocol}://${reqHeadersHost}${node.imageUrl}`;
        }
        const response = await fetch(targetUrl);
        if (response.ok) {
          const svgText = await response.text();
          node.type = 'VECTOR';
          node.svgContent = svgText;
          delete node.imageUrl;
        }
      } catch (e) {
        console.warn("Failed to fetch SVG image code directly in server:", node.imageUrl, e);
      }
    } else {
      const base64 = await fetchAndBase64(node.imageUrl, reqHeadersHost, isHttps);
      if (base64) {
        node.imageBase64 = base64;
      }
    }
  }
  if (node.backgroundImageUrl) {
    if (node.backgroundImageUrl.toLowerCase().includes('.svg')) {
      try {
        let targetUrl = node.backgroundImageUrl;
        if (node.backgroundImageUrl.startsWith('/')) {
          const protocol = isHttps ? 'https' : 'http';
          targetUrl = `${protocol}://${reqHeadersHost}${node.backgroundImageUrl}`;
        }
        const response = await fetch(targetUrl);
        if (response.ok) {
          const svgText = await response.text();
          node.type = 'VECTOR';
          node.svgContent = svgText;
          delete node.backgroundImageUrl;
        }
      } catch (e) {
        console.warn("Failed to fetch SVG background image directly in server:", node.backgroundImageUrl, e);
      }
    } else {
      const base64 = await fetchAndBase64(node.backgroundImageUrl, reqHeadersHost, isHttps);
      if (base64) {
        node.backgroundImageBase64 = base64;
      }
    }
  }
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      await resolveNodeImages(child, reqHeadersHost, isHttps);
    }
  }
}

// Designs API Endpoints
app.get('/api/figma/designs', (req, res) => {
  const designs = getDesigns();
  res.json({ success: true, designs });
});

app.post('/api/figma/designs', async (req, res) => {
  const { name, device, width, height, nodes } = req.body;
  if (!name || !nodes) {
    res.status(400).json({ success: false, error: 'Missing name or nodes' });
    return;
  }

  const reqHeadersHost = req.headers.host || 'localhost:3000';
  const isHttps = req.secure;

  try {
    for (const node of nodes) {
      await resolveNodeImages(node, reqHeadersHost, isHttps);
    }
  } catch (err) {
    console.error('Error resolving images in designs POST:', err);
  }

  const designs = getDesigns();
  const newDesign = {
    id: Math.random().toString(36).substring(2, 9),
    name,
    device,
    width,
    height,
    nodes,
    createdAt: new Date().toISOString()
  };
  designs.unshift(newDesign);
  saveDesigns(designs);
  res.json({ success: true, design: newDesign });
});

app.delete('/api/figma/designs/:id', (req, res) => {
  const { id } = req.params;
  let designs = getDesigns();
  designs = designs.filter((d: any) => d.id !== id);
  saveDesigns(designs);
  res.json({ success: true });
});


/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
