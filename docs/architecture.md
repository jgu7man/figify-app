# Architecture Overview

This document describes the technical architecture and data flow of the Figify HTML-to-Figma Converter.

---

## Technical Architecture Diagram

```mermaid
graph TD
  A[Iframe DOM Preview] -->|1. Extract Nodes + Style Maps| B[Angular Layout Controller]
  G[Chrome Extension] -->|1. Inject Content Script & Extract DOM| G
  G -->|2. Local Base64 Image Resolution| G
  G -->|3. Sync JSON Payload| C[Node Express Proxy Server]
  B -->|2. Send External Font/Image URLs| C
  C -->|3. Fetch & Convert Binaries to Base64| B
  B -->|4. Sync Unified Figma JSON Payload| D[designs.json]
  C -->|4. Save payload| D
  E[Figma Plugin UI] -->|5. Fetch payload| D
  E -->|6. Load Fonts & Paints| F[Figma Desktop API]
```

---

## Component Responsibilities

### 1. Extraction Layer (Web Client)
* **File:** [app.ts](file:///Users/jgu7man/Code/jguzman/figify-app/src/app/app.ts)
* **Responsibilities:**
  * Traverses the DOM trees inside the preview iframe recursively.
  * Measures element coordinates using bounding client rectangles.
  * Parses advanced styles like border highlights, input placeholders, shadows, and linear gradients (converting angles into a Figma-compatible 2x3 matrix).
  * Measures pseudo-elements (`::before` / `::after`) by inserting temporary mirror spans in the DOM flow.
  * Evaluates flexbox rules (`display: flex`, `gap`, `padding`) and sizing properties (`auto`, `content-width`) to output Auto Layout coordinates.

### 2. Node Express Server (Backend)
* **File:** [server.ts](file:///Users/jgu7man/Code/jguzman/figify-app/src/server.ts)
* **Responsibilities:**
  * Hosts the Angular application and serves client-side static resources.
  * Exposes REST endpoints to save, retrieve, and delete compiled design payloads.
  * Bypasses client-side CORS policies by acting as a proxy for remote visual images, converting them into Base64 strings.
  * Resolves all relative asset URLs to absolute paths using requesting headers.

### 3. Drawing Engine (Figma Plugin)
* **Files:**
  * [code.ts](file:///Users/jgu7man/Code/jguzman/figify-app/figma-plugin/src/code.ts) (Plugin Controller)
  * [ui.html](file:///Users/jgu7man/Code/jguzman/figify-app/figma-plugin/src/ui.html) (Plugin UI)
* **Responsibilities:**
  * Interfaces with the backend API to retrieve synced designs list.
  * Performs parallel preloading of all unique font styles present in the design payload to optimize rendering speeds.
  * Recreates text layers, vector outlines (from SVGs), and frame layers in the active Figma viewport.
  * Applies solid fills, Base64 image paints, gradient stops, custom rounded corners, and shadow effects.
  * Sets up responsive Auto Layout containers (Vertical / Horizontal alignment, paddings, item spacing, grow, align-self) and applies absolute position overrides where needed.
