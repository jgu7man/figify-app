import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 */
app.get('/api/figma/auth', (req, res) => {
  // Mock OAuth redirection
  res.redirect('/api/figma/callback?code=mock_figma_code');
});

app.get('/api/figma/callback', (req, res) => {
  // Store mock token in a cookie
  res.cookie('figma_token', 'mock_access_token', { maxAge: 900000, httpOnly: false });
  res.redirect('/');
});

app.post('/api/figma/mock-login', (req, res) => {
  res.cookie('figma_token', 'mock_access_token', { maxAge: 900000, httpOnly: false });
  res.json({ success: true });
});

app.get('/api/figma/status', (req, res) => {
  const token = req.headers.cookie?.includes('figma_token=');
  res.json({ connected: !!token });
});

app.post('/api/figma/disconnect', (req, res) => {
  res.clearCookie('figma_token');
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
