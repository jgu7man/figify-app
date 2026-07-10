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
      // Gather all fonts in the design recursively
      const fontsMap = new Map<string, Set<string>>();
      const collectFonts = (nodes: any[]) => {
        for (const node of nodes) {
          if (node.type === 'TEXT') {
            const family = node.styles?.fontFamily || 'Inter';
            const weight = node.styles?.fontWeight || '400';
            if (!fontsMap.has(family)) {
              fontsMap.set(family, new Set());
            }
            fontsMap.get(family)!.add(weight);
          }
          if (node.children && node.children.length > 0) {
            collectFonts(node.children);
          }
        }
      };

      if (design.nodes) {
        collectFonts(design.nodes);
      }

      const getFigmaFontName = (fontFamily: string, fontWeight: string): { family: string, style: string } => {
        let family = resolveFontFamily(fontFamily);
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
        return { family, style };
      };

      // Map to unique Figma FontNames
      const uniqueFonts = new Map<string, { family: string, style: string }>();
      const fontList: { family: string, style: string }[] = [];
      fontsMap.forEach((weights, family) => {
        weights.forEach(weight => {
          const resolved = getFigmaFontName(family, weight);
          const key = `${resolved.family}_${resolved.style}`;
          if (!uniqueFonts.has(key)) {
            uniqueFonts.set(key, resolved);
            fontList.push(resolved);
          }
        });
      });

      // Always include Inter Regular fallback
      const fallbackKey = "Inter_Regular";
      if (!uniqueFonts.has(fallbackKey)) {
        fontList.push({ family: "Inter", style: "Regular" });
      }

      // Preload all fonts in parallel
      const missingFonts: string[] = [];
      await Promise.all(
        fontList.map(async (font) => {
          try {
            await figma.loadFontAsync(font);
          } catch (e) {
            console.warn(`Failed to preload font: ${font.family} ${font.style}`, e);
            if (font.family !== "Inter") {
              missingFonts.push(`${font.family} (${font.style})`);
            }
          }
        })
      );

      if (missingFonts.length > 0) {
        figma.notify(`Missing system/web fonts: ${missingFonts.join(', ')}. Using fallbacks.`, { timeout: 4500 });
      }


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

function resolveFontFamily(fontFamily: string): string {
  if (!fontFamily) return "Inter";
  
  const fonts = fontFamily.split(',').map(f => f.replace(/['"]/g, '').trim());
  
  for (const font of fonts) {
    const lower = font.toLowerCase();
    
    // Monospace fallbacks
    if (lower === 'monospace' || lower === 'ui-monospace' || lower === 'menlo' || lower === 'monaco' || lower === 'consolas' || lower === 'sfmono-regular') {
      return 'Roboto Mono';
    }
    // Sans-serif fallbacks
    if (lower === 'sans-serif' || lower === 'ui-sans-serif' || lower === 'system-ui' || lower === 'blinkmacsystemfont') {
      return 'Inter';
    }
    // Serif fallbacks
    if (lower === 'serif' || lower === 'ui-serif') {
      return 'Georgia';
    }
    
    // If it's a specific named font (e.g. "Outfit", "Arial"), return it!
    if (font && font !== 'inherit') {
      return font;
    }
  }
  
  return "Inter";
}

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

function decodeBase64(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, '').replace(/=/g, '');
  const bufferLength = Math.floor(base64Data.length * 0.75);
  const bytes = new Uint8Array(bufferLength);

  let p = 0;
  for (let i = 0; i < base64Data.length; i += 4) {
    const c1 = lookup[base64Data.charCodeAt(i)] || 0;
    const c2 = lookup[base64Data.charCodeAt(i + 1)] || 0;
    const c3 = lookup[base64Data.charCodeAt(i + 2)] || 0;
    const c4 = lookup[base64Data.charCodeAt(i + 3)] || 0;

    bytes[p++] = (c1 << 2) | (c2 >> 4);
    if (p < bufferLength) {
      bytes[p++] = ((c2 & 15) << 4) | (c3 >> 2);
    }
    if (p < bufferLength) {
      bytes[p++] = ((c3 & 3) << 6) | (c4 & 63);
    }
  }

  return bytes;
}

function applyChildLayoutConstraints(figmaNode: any, node: any, parent: any) {
  if (parent && parent.layoutMode && parent.layoutMode !== 'NONE') {
    if (node.styles?.layoutPositioning === 'ABSOLUTE') {
      figmaNode.layoutPositioning = "ABSOLUTE";
      figmaNode.x = node.x;
      figmaNode.y = node.y;
    } else {
      if (node.styles?.layoutGrow !== undefined) {
        figmaNode.layoutGrow = node.styles.layoutGrow;
      }
      if (node.styles?.layoutAlign !== undefined) {
        figmaNode.layoutAlign = node.styles.layoutAlign;
      }
    }
  }
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
  let family = resolveFontFamily(fontFamily);
  
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

function applyNodeOpacityAndEffects(figmaNode: any, node: any) {
  if (!node || !node.styles) return;

  // Apply general opacity
  if (node.styles.opacity !== undefined) {
    figmaNode.opacity = node.styles.opacity;
  }

  // Compile effects (box shadow + layer blur)
  const effects: any[] = [];
  if (node.styles.boxShadow && node.styles.boxShadow !== 'none') {
    effects.push(...parseBoxShadows(node.styles.boxShadow));
  }
  if (node.styles.layerBlur && node.styles.layerBlur > 0) {
    effects.push({
      type: 'LAYER_BLUR',
      visible: true,
      radius: node.styles.layerBlur
    });
  }

  if (effects.length > 0) {
    figmaNode.effects = effects;
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
      vector.name = node.name || 'svg';
      vector.x = node.x;
      vector.y = node.y;
      vector.resize(Math.max(0.01, node.width || 0.01), Math.max(0.01, node.height || 0.01));
      applyNodeOpacityAndEffects(vector, node);
      parent.appendChild(vector);
      applyChildLayoutConstraints(vector, node, parent);
    } catch (e) {
      console.error("Failed to parse SVG icon", e);
    }
  } else if (node.type === 'TEXT') {
    const figmaNode = figma.createText();
    
    // Load default font and range fonts
    const fontPromises: Promise<any>[] = [];
    fontPromises.push(loadFontForNode(
      node.styles?.fontFamily || 'Inter', 
      node.styles?.fontWeight || '400'
    ));
    
    if (node.styles?.styleRanges) {
      for (const range of node.styles.styleRanges) {
        fontPromises.push(loadFontForNode(
          node.styles?.fontFamily || 'Inter', 
          range.fontWeight || '400'
        ));
      }
    }
    
    const fonts = await Promise.all(fontPromises);
    figmaNode.fontName = fonts[0];
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

    // Apply mixed style ranges (e.g. blue links inside a paragraph)
    if (node.styles?.styleRanges) {
      for (const range of node.styles.styleRanges) {
        const start = Math.min(range.start, figmaNode.characters.length);
        const end = Math.min(range.end, figmaNode.characters.length);
        if (start >= end) continue;
        
        if (range.color) {
          const rangeColor = parseHexColor(range.color);
          if (rangeColor.a > 0) {
            figmaNode.setRangeFills(start, end, [{ type: 'SOLID', color: { r: rangeColor.r, g: rangeColor.g, b: rangeColor.b } }]);
          }
        }
        
        if (range.fontWeight) {
          const rangeFont = await loadFontForNode(
            node.styles?.fontFamily || 'Inter',
            range.fontWeight
          );
          figmaNode.setRangeFontName(start, end, rangeFont);
        }
        
        if (range.textDecoration && range.textDecoration !== 'none') {
          if (range.textDecoration.includes('underline')) {
            figmaNode.setRangeTextDecoration(start, end, 'UNDERLINE');
          } else if (range.textDecoration.includes('line-through')) {
            figmaNode.setRangeTextDecoration(start, end, 'STRIKETHROUGH');
          }
        }
      }
    }

    if (node.styles?.textAlignHorizontal) {
      figmaNode.textAlignHorizontal = node.styles.textAlignHorizontal;
    }

    figmaNode.x = node.x;
    figmaNode.y = node.y;
    applyNodeOpacityAndEffects(figmaNode, node);
    
    // If it's a single line of text and NOT centered/right-aligned, use Auto-Width.
    // For aligned text, keep the box width so centering works perfectly.
    const isAligned = node.styles?.textAlignHorizontal === 'CENTER' || node.styles?.textAlignHorizontal === 'RIGHT';
    if (node.height && node.styles?.fontSize && node.height < node.styles.fontSize * 1.8 && !isAligned) {
      figmaNode.textAutoResize = "WIDTH_AND_HEIGHT";
    } else {
      figmaNode.textAutoResize = "HEIGHT";
      figmaNode.resize(Math.max(0.01, node.width || 0.01), Math.max(0.01, node.height || 0.01));
    }
    
    parent.appendChild(figmaNode);
    applyChildLayoutConstraints(figmaNode, node, parent);
  } else {
    // FRAME
    const figmaNode = figma.createFrame();
    figmaNode.name = node.name || 'div';
    figmaNode.resize(Math.max(0.01, node.width || 0.01), Math.max(0.01, node.height || 0.01));
    figmaNode.clipsContent = true;

    // Always apply absolute coordinates to match the browser's bounding rect calculations
    figmaNode.x = node.x;
    figmaNode.y = node.y;
    applyNodeOpacityAndEffects(figmaNode, node);

    let finalFills: any[] = [];
    if (node.imageBase64 || node.backgroundImageBase64) {
      try {
        const base64Str = node.imageBase64 || node.backgroundImageBase64;
        const bytes = decodeBase64(base64Str);
        const image = figma.createImage(bytes);
        finalFills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
      } catch (err) {
        console.error("Failed to create Figma image paint", err);
      }
    } else if (node.styles?.backgroundGradient) {
      finalFills = [node.styles.backgroundGradient];
    } else {
      const bg = parseHexColor(node.styles?.backgroundColor);
      if (bg.a > 0) {
        finalFills = [{ type: 'SOLID', color: { r: bg.r, g: bg.g, b: bg.b }, opacity: bg.a }];
      }
    }
    figmaNode.fills = finalFills;

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

    // Auto Layout (CSS Flexbox mapping)
    if (node.styles?.layoutMode && node.styles.layoutMode !== 'NONE') {
      figmaNode.layoutMode = node.styles.layoutMode;
      figmaNode.paddingTop = node.styles.paddingTop || 0;
      figmaNode.paddingRight = node.styles.paddingRight || 0;
      figmaNode.paddingBottom = node.styles.paddingBottom || 0;
      figmaNode.paddingLeft = node.styles.paddingLeft || 0;
      figmaNode.itemSpacing = node.styles.itemSpacing || 0;
      
      if (node.styles.primaryAxisAlignItems) {
        figmaNode.primaryAxisAlignItems = node.styles.primaryAxisAlignItems;
      }
      if (node.styles.counterAxisAlignItems) {
        figmaNode.counterAxisAlignItems = node.styles.counterAxisAlignItems;
      }
      if (node.styles.primaryAxisSizingMode) {
        figmaNode.primaryAxisSizingMode = node.styles.primaryAxisSizingMode;
      }
      if (node.styles.counterAxisSizingMode) {
        figmaNode.counterAxisSizingMode = node.styles.counterAxisSizingMode;
      }
    }

    parent.appendChild(figmaNode);
    applyChildLayoutConstraints(figmaNode, node, parent);

    // Recursively process children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const isAbsolute = child.styles?.layoutPositioning === 'ABSOLUTE';
        if (!isAbsolute) {
          // If parent has vertical Auto Layout and child has margin-top
          if (figmaNode.layoutMode === 'VERTICAL' && child.styles?.marginTop > 0) {
            const spacer = figma.createFrame();
            spacer.name = 'spacer';
            spacer.resize(1, child.styles.marginTop);
            spacer.fills = [];
            figmaNode.appendChild(spacer);
          }
          // If parent has horizontal Auto Layout and child has margin-left
          if (figmaNode.layoutMode === 'HORIZONTAL' && child.styles?.marginLeft > 0) {
            const spacer = figma.createFrame();
            spacer.name = 'spacer';
            spacer.resize(child.styles.marginLeft, 1);
            spacer.fills = [];
            figmaNode.appendChild(spacer);
          }
        }
        await createFigmaNode(child, figmaNode);
      }
    }
  }
}
