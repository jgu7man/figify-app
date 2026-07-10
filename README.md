# Figify: HTML-to-Figma Layout Converter

Figify is an advanced, high-fidelity developer utility that translates browser DOM trees, HTML pages, and CSS structures into pixel-perfect, editable Figma designs.

---

## 1. Running the Web Application

The project utilizes a unified Angular SSR development server. This single command starts both the frontend designer interface and the local Node.js Express server on port **`3000`**.

### Setup & Startup:
1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Configure Environment:**
   Create or verify your `.env` file matches the configurations in `.env.example`. Make sure to set the OAuth client credentials:
   ```env
   GEMINI_API_KEY="your_api_key"
   FIGMA_CLIENT_ID="your_figma_client_id"
   FIGMA_CLIENT_SECRET="your_figma_client_secret"
   ```
3. **Start Server:**
   ```bash
   npm run dev
   ```
   *The app is served at `http://localhost:3000`.*

---

## 2. Configuring Figma OAuth

To enable user authentication with Figma:

1. Go to the [Figma Developer Portal](https://www.figma.com/developers/apps) and log in.
2. Click **"Register a new app"** and fill out the details:
   * **App Name:** `Figify` (or any custom name)
   * **Redirect URI:** Add `http://localhost:3000/api/figma/callback` (for local development).
   * **Scopes:** Select/enable **`current_user:read`** (this is the only scope required by our authentication backend).
3. Once registered, copy the **Client ID** and **Client Secret**.
4. Save them in your local `.env` file under `FIGMA_CLIENT_ID` and `FIGMA_CLIENT_SECRET`.

---

## 3. Building & Loading the Figma Plugin

The Figma plugin runs locally inside Figma using the manifest configuration.

### Setup & Build:
1. Navigate to the plugin directory and compile the TypeScript source files:
   ```bash
   cd figma-plugin
   npm run build
   ```
   *This compiles `src/code.ts` into `dist/code.js`.*

### Loading into Figma:
1. Open **Figma Desktop** (or Figma in the browser).
2. Go to **Menu** $\rightarrow$ **Plugins** $\rightarrow$ **Development** $\rightarrow$ **Import plugin from manifest...**.
3. Select the `manifest.json` file inside the `figma-plugin` folder.
4. Run the plugin from your plugin list.

---

## 4. Current Implementation State

The compiler supports the following features today:

* **Unified Server Engine:** Both the preview page renderer and the Express database APIs run concurrently on port `3000`.
* **Absolute Coordinate Layouts:** Evaluates element bounds using Chrome's Range API and bounding client rects to position every element exactly, avoiding overlaps.
* **Inline Range Text Measurements:** Wraps loose text nodes inside Flexbox elements in a temporary `span` during extraction to calculate their layout coordinates accurately, resolving icon-and-text badge overlaps.
* **Shadow Effects (`box-shadow`):** Parses CSS shadow strings (including hex, rgb, and rgba colors) and renders them as Figma `DROP_SHADOW` effects.
* **Rounded Corners & Custom Borders:** Converts `border-radius` to corner radii. Detects individual thick borders (like yellow left border cards) and renders them as clipped highlight frames.
* **Input Placeholders:** Automatically detects empty `<input>` and `<textarea>` fields and injects virtual, styled placeholder text layers.
* **Text Auto-Width:** Single-line text fields automatically use Figma's auto-width resize to prevent text wrapping due to font metric differences.
* **Advanced Font Loading:** Reads font stacks from the browser and matches them against available local/system fonts inside Figma, loading the correct weights (Bold, Medium, Light) and falling back cleanly to `Inter`.
* **Database & UI Cleanups:** Features a design list in the plugin UI with instant deletion buttons that remove designs instantly without browser popup alerts.
