declare const figma: any;
declare const __html__: any;

// Initialize the Figma Plugin UI
figma.showUI(__html__, { width: 380, height: 440 });

// Fetch stored token and pass to UI on load
figma.clientStorage.getAsync('figma_token').then((token: any) => {
  figma.ui.postMessage({ type: 'init-auth', token: token || '' });
});

// Listener for messages from the UI thread
figma.ui.onmessage = async (msg: any) => {
  if (msg.type === 'save-token') {
    await figma.clientStorage.setAsync('figma_token', msg.token);
  } else if (msg.type === 'import-design') {
    const { design } = msg;
    if (!design) return;

    try {
      // Load fallback font first so it is guaranteed to be ready
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });


      // Create main viewport frame
      const mainFrame = figma.createFrame();
      mainFrame.name = `${design.name} (${design.device ? design.device.toUpperCase() : 'DESKTOP'})`;
      mainFrame.resize(design.width || 1440, design.height || 900);
      
      // Position it in the center of the current viewport
      mainFrame.x = figma.viewport.center.x - mainFrame.width / 2;
      mainFrame.y = figma.viewport.center.y - mainFrame.height / 2;

      // Draw children recursively
      if (design.nodes && design.nodes.length > 0) {
        for (const node of design.nodes) {
          await createFigmaNode(node, mainFrame);
        }
      }

      // Focus and select the new frame
      figma.currentPage.selection = [mainFrame];
      figma.viewport.scrollAndZoomIntoView([mainFrame]);
      
      figma.notify(`Imported design "${design.name}" successfully!`);
    } catch (e: any) {
      console.error(e);
      figma.notify(`Failed to import design: ${e.message}`, { error: true });
    }
  }
};

/**
 * Parses Hex colors (#RRGGBB or #RRGGBBAA) to Figma compatible format (RGB values 0 to 1, and alpha)
 */
function parseHexColor(colorStr: string): { r: number, g: number, b: number, a: number } {
  if (!colorStr || colorStr === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  
  const str = colorStr.trim();
  
  if (str.startsWith('#')) {
    const clean = str.substring(1);
    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;
    const a = clean.length >= 8 ? parseInt(clean.substring(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  
  if (str.startsWith('rgb')) {
    const match = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const r = parseInt(match[1]) / 255;
      const g = parseInt(match[2]) / 255;
      const b = parseInt(match[3]) / 255;
      const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
      return { r, g, b, a };
    }
  }
  
  return { r: 0, g: 0, b: 0, a: 0 };
}

function parseBoxShadows(shadowStr: string): any[] {
  if (!shadowStr || shadowStr === 'none') return [];
  
  const effects: any[] = [];
  const shadows = shadowStr.split(/,(?![^(]*\))/);
  
  for (const shadow of shadows) {
    const trimmed = shadow.trim();
    // Match rgb/rgba or hex color anywhere in the shadow definition
    const colorMatch = trimmed.match(/(rgba?\(.*?\)|#[0-9a-fA-F]{3,8})/);
    if (!colorMatch) continue;
    
    const colorStr = colorMatch[1];
    const rest = trimmed.replace(colorStr, '').trim();
    const parts = rest.split(/\s+/);
    
    if (parts.length >= 2) {
      const x = parseFloat(parts[0]) || 0;
      const y = parseFloat(parts[1]) || 0;
      const blur = parseFloat(parts[2]) || 0;
      
      const color = parseHexColor(colorStr);
      effects.push({
        type: 'DROP_SHADOW',
        color: { r: color.r, g: color.g, b: color.b, a: color.a },
        offset: { x, y },
        radius: blur,
        visible: true,
        blendMode: 'NORMAL'
      });
    }
  }
  
  return effects;
}

/**
 * Safely resolves and loads fonts dynamically based on css styles
 */
async function loadFontForNode(fontFamily: string, fontWeight: string): Promise<{ family: string, style: string }> {
  // Extract primary font name
  let family = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
  if (!family || family === 'inherit' || family === 'sans-serif') {
    family = "Inter";
  }
  
  let style = "Regular";
  const weight = fontWeight.toString().toLowerCase();
  if (weight === 'bold' || weight === '700' || weight === '800' || weight === '900') {
    style = "Bold";
  } else if (weight === 'medium' || weight === '500') {
    style = "Medium";
  } else if (weight === 'semibold' || weight === '600') {
    style = "SemiBold";
  } else if (weight === 'light' || weight === '300') {
    style = "Light";
  }

  try {
    await figma.loadFontAsync({ family, style });
    return { family, style };
  } catch (e) {
    // Fallback to Inter with same weight
    try {
      await figma.loadFontAsync({ family: "Inter", style });
      return { family: "Inter", style };
    } catch (err) {
      return { family: "Inter", style: "Regular" };
    }
  }
}

/**
 * Recursively creates layers in Figma based on DOM layout mapping
 */
async function createFigmaNode(node: any, parent: any) {
  if (!node) return;

  if (node.type === 'VECTOR') {
    try {
      const vector = figma.createNodeFromSvg(node.svgContent);
      vector.x = node.x;
      vector.y = node.y;
      vector.resize(Math.max(0.01, node.width || 0.01), Math.max(0.01, node.height || 0.01));
      parent.appendChild(vector);
    } catch (e) {
      console.error("Failed to parse SVG icon", e);
    }
  } else if (node.type === 'TEXT') {
    const figmaNode = figma.createText();
    
    // Load font before applying characters
    const font = await loadFontForNode(
      node.styles?.fontFamily || 'Inter', 
      node.styles?.fontWeight || '400'
    );
    figmaNode.fontName = font;
    figmaNode.characters = node.characters || '';
    
    if (node.styles?.fontSize) {
      figmaNode.fontSize = node.styles.fontSize;
    }

    if (node.styles?.lineHeight && node.styles.lineHeight !== 'normal') {
      const lhVal = parseFloat(node.styles.lineHeight);
      if (!isNaN(lhVal)) {
        figmaNode.lineHeight = { value: lhVal, unit: 'PIXELS' };
      }
    }

    const color = parseHexColor(node.styles?.color);
    if (color.a > 0) {
      figmaNode.fills = [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b } }];
    } else {
      figmaNode.fills = [];
    }

    if (node.styles?.textAlignHorizontal) {
      figmaNode.textAlignHorizontal = node.styles.textAlignHorizontal;
    }

    figmaNode.x = node.x;
    figmaNode.y = node.y;
    
    // If it's a single line of text, use Auto-Width to prevent wrapping due to font metric differences
    if (node.height && node.styles?.fontSize && node.height < node.styles.fontSize * 1.8) {
      figmaNode.textAutoResize = "WIDTH_AND_HEIGHT";
    } else {
      figmaNode.resize(Math.max(0.01, node.width || 0.01), Math.max(0.01, node.height || 0.01));
    }
    
    parent.appendChild(figmaNode);
  } else {
    // FRAME
    const figmaNode = figma.createFrame();
    figmaNode.name = node.name || 'div';
    figmaNode.resize(Math.max(0.01, node.width || 0.01), Math.max(0.01, node.height || 0.01));
    figmaNode.clipsContent = true;

    // Always apply absolute coordinates to match the browser's bounding rect calculations
    figmaNode.x = node.x;
    figmaNode.y = node.y;

    const bg = parseHexColor(node.styles?.backgroundColor);
    if (bg.a > 0) {
      figmaNode.fills = [{ type: 'SOLID', color: { r: bg.r, g: bg.g, b: bg.b }, opacity: bg.a }];
    } else {
      figmaNode.fills = [];
    }

    if (node.styles?.borderRadius > 0) {
      figmaNode.cornerRadius = node.styles.borderRadius;
    }

    // Strokes (Borders)
    const hasIndividualStrokes = (node.styles?.strokeTopWeight || node.styles?.strokeRightWeight || node.styles?.strokeBottomWeight || node.styles?.strokeLeftWeight);
    if ((node.styles?.strokeWeight > 0 || hasIndividualStrokes) && node.styles.strokes && node.styles.strokes.length > 0) {
      const strokeColor = parseHexColor(node.styles.strokes[0]);
      if (strokeColor.a > 0) {
        figmaNode.strokes = [{ type: 'SOLID', color: { r: strokeColor.r, g: strokeColor.g, b: strokeColor.b } }];
        
        if (hasIndividualStrokes) {
          figmaNode.strokeTopWeight = node.styles.strokeTopWeight || 0;
          figmaNode.strokeRightWeight = node.styles.strokeRightWeight || 0;
          figmaNode.strokeBottomWeight = node.styles.strokeBottomWeight || 0;
          figmaNode.strokeLeftWeight = node.styles.strokeLeftWeight || 0;
        } else {
          figmaNode.strokeWeight = node.styles.strokeWeight;
        }
      }
    }

    // Shadows (Effects)
    if (node.styles?.boxShadow && node.styles.boxShadow !== 'none') {
      const effects = parseBoxShadows(node.styles.boxShadow);
      if (effects.length > 0) {
        figmaNode.effects = effects;
      }
    }

    // Disabling Auto Layout mapping to prioritize absolute positioning fidelity

    parent.appendChild(figmaNode);

    // Recursively process children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        await createFigmaNode(child, figmaNode);
      }
    }
  }
}
