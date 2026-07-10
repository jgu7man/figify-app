"use strict";
// self-contained DOM extraction logic for the Chrome Extension content-script
function rgbaToHex(rgba) {
    if (rgba === 'rgba(0, 0, 0, 0)' || rgba === 'transparent')
        return 'transparent';
    const parts = rgba.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (!parts)
        return rgba;
    const r = parseInt(parts[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(parts[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(parts[3], 10).toString(16).padStart(2, '0');
    const a = parts[4] ? Math.round(parseFloat(parts[4]) * 255).toString(16).padStart(2, '0') : '';
    return `#${r}${g}${b}${a}`;
}
function getSmartNodeName(element) {
    const tagName = element.tagName.toLowerCase();
    const id = element.id;
    if (id && id.trim().length > 0) {
        return `#${id.trim()}`;
    }
    const classList = Array.from(element.classList);
    if (classList.length > 0) {
        const utilityRegex = /^(flex|grid|block|inline|inline-flex|p-|px-|py-|pt-|pr-|pb-|pl-|m-|mx-|my-|mt-|mr-|mb-|ml-|gap-|space-|bg-|text-|rounded-|w-|h-|border-|shadow-|justify-|items-|self-|min-|max-|top-|right-|bottom-|left-|relative|absolute|fixed|overflow-|z-|cursor-|opacity-|transition-|duration-|ease-|select-|pointer-|focus-|hover-)/;
        const semanticClass = classList.find(cls => !utilityRegex.test(cls));
        if (semanticClass) {
            return `.${semanticClass}`;
        }
    }
    const semanticTags = ['header', 'footer', 'nav', 'main', 'aside', 'section', 'article', 'button', 'input', 'img', 'svg', 'a'];
    if (semanticTags.includes(tagName)) {
        return tagName.charAt(0).toUpperCase() + tagName.slice(1);
    }
    return 'Frame';
}
function parseRgbaColor(colorStr, doc) {
    const div = doc.createElement('div');
    div.style.color = colorStr;
    doc.body.appendChild(div);
    const computedColor = doc.defaultView?.getComputedStyle(div).color || 'rgb(0, 0, 0)';
    doc.body.removeChild(div);
    const match = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
        return {
            r: parseInt(match[1]) / 255,
            g: parseInt(match[2]) / 255,
            b: parseInt(match[3]) / 255,
            a: match[4] !== undefined ? parseFloat(match[4]) : 1
        };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
}
function parseCssGradient(gradientStr, doc) {
    if (!gradientStr || gradientStr === 'none')
        return null;
    const linearMatch = gradientStr.match(/linear-gradient\((.*)\)/i);
    if (!linearMatch)
        return null;
    const content = linearMatch[1];
    const parts = content.split(/,(?![^(]*\))/).map(p => p.trim());
    let angle = 180; // default to vertical top-to-bottom
    let colorStopsStartIdx = 0;
    const angleMatch = parts[0].match(/(-?\d+)(deg|rad|grad|turn)/);
    if (angleMatch) {
        const val = parseFloat(angleMatch[1]);
        const unit = angleMatch[2];
        if (unit === 'deg')
            angle = val;
        else if (unit === 'rad')
            angle = val * (180 / Math.PI);
        else if (unit === 'turn')
            angle = val * 360;
        colorStopsStartIdx = 1;
    }
    else if (parts[0].startsWith('to ')) {
        const dir = parts[0].substring(3).trim();
        if (dir === 'top')
            angle = 0;
        else if (dir === 'bottom')
            angle = 180;
        else if (dir === 'left')
            angle = 270;
        else if (dir === 'right')
            angle = 90;
        else if (dir === 'top right' || dir === 'right top')
            angle = 45;
        else if (dir === 'bottom right' || dir === 'right bottom')
            angle = 135;
        else if (dir === 'bottom left' || dir === 'left bottom')
            angle = 225;
        else if (dir === 'top left' || dir === 'left top')
            angle = 315;
        colorStopsStartIdx = 1;
    }
    const rad = (angle - 90) * (Math.PI / 180);
    const x1 = 0.5 - Math.cos(rad) * 0.5;
    const y1 = 0.5 - Math.sin(rad) * 0.5;
    const x2 = 0.5 + Math.cos(rad) * 0.5;
    const y2 = 0.5 + Math.sin(rad) * 0.5;
    const stops = parts.slice(colorStopsStartIdx).map((stopStr, idx, arr) => {
        const match = stopStr.match(/(rgba?\(.*?\)|#[0-9a-fA-F]{3,8}|\w+)(?:\s+(\d+)%)?/);
        if (!match)
            return null;
        const colorVal = match[1];
        const percentage = match[2] ? parseFloat(match[2]) / 100 : idx / (arr.length - 1);
        const parsedColor = parseRgbaColor(colorVal, doc);
        return {
            position: percentage,
            color: {
                r: parsedColor.r,
                g: parsedColor.g,
                b: parsedColor.b,
                a: parsedColor.a
            }
        };
    }).filter(Boolean);
    if (stops.length < 2)
        return null;
    return {
        type: 'GRADIENT_LINEAR',
        gradientTransform: [
            [x2 - x1, 0, x1],
            [0, y2 - y1, y1]
        ],
        gradientStops: stops
    };
}
function extractFigmaSchema(element, win) {
    if (element.nodeType !== Node.ELEMENT_NODE)
        return null;
    const style = win.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
        return null;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && element.childNodes.length === 0)
        return null;
    const parentRect = element.parentElement?.getBoundingClientRect();
    let x = rect.left - (parentRect ? parentRect.left : 0);
    let y = rect.top - (parentRect ? parentRect.top : 0);
    const isModalBackdrop = (style.position === 'fixed' || style.position === 'absolute') &&
        (rect.width >= win.innerWidth * 0.85) &&
        (rect.height >= win.innerHeight * 0.85);
    let parentIsModalBackdrop = false;
    if (element.parentElement) {
        const pStyle = win.getComputedStyle(element.parentElement);
        const pRect = element.parentElement.getBoundingClientRect();
        parentIsModalBackdrop = (pStyle.position === 'fixed' || pStyle.position === 'absolute') &&
            pRect.width >= win.innerWidth * 0.85 &&
            pRect.height >= win.innerHeight * 0.85;
    }
    if (parentIsModalBackdrop && element.parentElement) {
        const parentStyle = win.getComputedStyle(element.parentElement);
        const isHorizontallyCentered = parentStyle.justifyContent.includes('center') || parentStyle.alignItems.includes('center') || parentStyle.display === 'flex';
        const isVerticallyCentered = parentStyle.alignItems.includes('center') || parentStyle.justifyContent.includes('center') || parentStyle.display === 'flex';
        if (isHorizontallyCentered) {
            x = (win.innerWidth - rect.width) / 2;
        }
        if (isVerticallyCentered) {
            y = (win.innerHeight - rect.height) / 2;
        }
    }
    // Handle SVGs
    if (element.tagName.toLowerCase() === 'svg') {
        let svgHtml = element.outerHTML;
        const computedColor = style.color || 'rgb(0, 0, 0)';
        svgHtml = svgHtml.replace(/currentColor/gi, computedColor);
        if (!svgHtml.includes('fill=') && !svgHtml.includes('stroke=')) {
            svgHtml = svgHtml.replace('<svg', `<svg fill="${computedColor}"`);
        }
        return {
            type: 'VECTOR',
            name: getSmartNodeName(element),
            x: x,
            y: y,
            width: rect.width,
            height: rect.height,
            svgContent: svgHtml
        };
    }
    const className = typeof element.className === 'string' ? element.className : (element.getAttribute('class') || '');
    if (element.tagName.toLowerCase() === 'i' && className.includes('fa-')) {
        return {
            type: 'TEXT',
            name: 'icon',
            characters: win.getComputedStyle(element, '::before').content?.replace(/"/g, '') || '',
            x: x,
            y: y,
            width: rect.width,
            height: rect.height,
            styles: {
                fontFamily: style.fontFamily,
                fontSize: parseFloat(style.fontSize) || 16,
                color: rgbaToHex(style.color)
            }
        };
    }
    const validChildNodes = Array.from(element.childNodes).filter(n => {
        if (n.nodeType === Node.COMMENT_NODE)
            return false;
        if (n.nodeType === Node.TEXT_NODE) {
            const text = n.textContent?.trim().replace(/\n/g, '').trim();
            return !!text;
        }
        return true;
    });
    const isPureText = validChildNodes.length > 0 && validChildNodes.every(n => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && n.tagName.toLowerCase() === 'br'));
    const bg = style.backgroundColor;
    const isBgTransparent = !bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' || bg === 'rgba(0,0,0,0)';
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderRight = parseFloat(style.borderRightWidth) || 0;
    const borderBottom = parseFloat(style.borderBottomWidth) || 0;
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    const hasVisualStyles = !isBgTransparent ||
        (parseFloat(style.borderRadius) || 0) > 0 ||
        (style.boxShadow && style.boxShadow !== 'none') ||
        borderTop > 0 || borderRight > 0 || borderBottom > 0 || borderLeft > 0;
    let activeStrokeColor = 'transparent';
    const isLeftColorDifferent = borderLeft > 0 && style.borderLeftColor !== style.borderTopColor && style.borderLeftColor !== 'transparent' && style.borderLeftColor !== 'rgba(0, 0, 0, 0)';
    if (borderTop > 0)
        activeStrokeColor = style.borderTopColor;
    else if (borderRight > 0)
        activeStrokeColor = style.borderRightColor;
    else if (borderBottom > 0)
        activeStrokeColor = style.borderBottomColor;
    else if (borderLeft > 0 && !isLeftColorDifferent)
        activeStrokeColor = style.borderLeftColor;
    else if (style.borderColor && style.borderStyle !== 'none')
        activeStrokeColor = style.borderColor;
    // Auto Layout compiler mappings
    const isFlex = style.display === 'flex' || style.display === 'inline-flex' || style.display === 'inline-block';
    const flexDir = style.flexDirection;
    const layoutMode = isFlex
        ? (flexDir.includes('column') ? 'VERTICAL' : 'HORIZONTAL')
        : 'NONE';
    const isWidthAuto = style.width === 'auto' || style.width.includes('content');
    const isHeightAuto = style.height === 'auto' || style.height.includes('content');
    let primaryAxisSizingMode = 'FIXED';
    let counterAxisSizingMode = 'FIXED';
    if (layoutMode === 'HORIZONTAL') {
        primaryAxisSizingMode = isWidthAuto ? 'AUTO' : 'FIXED';
        counterAxisSizingMode = isHeightAuto ? 'AUTO' : 'FIXED';
    }
    else if (layoutMode === 'VERTICAL') {
        primaryAxisSizingMode = isHeightAuto ? 'AUTO' : 'FIXED';
        counterAxisSizingMode = isWidthAuto ? 'AUTO' : 'FIXED';
    }
    let layoutPositioning = 'RELATIVE';
    if (style.position === 'absolute' || style.position === 'fixed') {
        layoutPositioning = 'ABSOLUTE';
    }
    let layoutGrow = 0;
    const flexGrowVal = parseFloat(style.flexGrow) || 0;
    if (flexGrowVal > 0) {
        layoutGrow = 1;
    }
    let layoutAlign = 'MIN';
    const parentEl = element.parentElement;
    if (parentEl) {
        const parentStyle = win.getComputedStyle(parentEl);
        const isParentFlex = parentStyle.display === 'flex' || parentStyle.display === 'inline-flex' || parentStyle.display === 'inline-block';
        if (isParentFlex) {
            if (style.alignSelf === 'stretch' || (parentStyle.alignItems === 'stretch' && style.alignSelf !== 'flex-start')) {
                layoutAlign = 'STRETCH';
            }
            else if (style.alignSelf === 'center' || parentStyle.alignItems === 'center') {
                layoutAlign = 'CENTER';
            }
            else if (style.alignSelf === 'flex-end' || parentStyle.alignItems === 'flex-end') {
                layoutAlign = 'MAX';
            }
        }
    }
    const nodeData = {
        type: isPureText && element.textContent?.trim() && !hasVisualStyles ? 'TEXT' : 'FRAME',
        name: getSmartNodeName(element),
        x: x,
        y: y,
        width: rect.width,
        height: rect.height,
        styles: {
            backgroundColor: rgbaToHex(style.backgroundColor),
            borderRadius: parseFloat(style.borderRadius) || 0,
            layoutMode: layoutMode,
            primaryAxisSizingMode: primaryAxisSizingMode,
            counterAxisSizingMode: counterAxisSizingMode,
            layoutPositioning: layoutPositioning,
            layoutGrow: layoutGrow,
            layoutAlign: layoutAlign,
            paddingTop: parseFloat(style.paddingTop) || 0,
            paddingRight: parseFloat(style.paddingRight) || 0,
            paddingBottom: parseFloat(style.paddingBottom) || 0,
            paddingLeft: parseFloat(style.paddingLeft) || 0,
            marginTop: parseFloat(style.marginTop) || 0,
            marginRight: parseFloat(style.marginRight) || 0,
            marginBottom: parseFloat(style.marginBottom) || 0,
            marginLeft: parseFloat(style.marginLeft) || 0,
            itemSpacing: parseFloat(style.gap) || parseFloat(style.columnGap) || parseFloat(style.rowGap) || 0,
            primaryAxisAlignItems: style.justifyContent.includes('end') ? 'MAX' : style.justifyContent.includes('center') ? 'CENTER' : style.justifyContent.includes('between') ? 'SPACE_BETWEEN' : 'MIN',
            counterAxisAlignItems: style.alignItems.includes('end') ? 'MAX' : style.alignItems.includes('center') ? 'CENTER' : 'MIN',
            strokeTopWeight: borderTop,
            strokeRightWeight: borderRight,
            strokeBottomWeight: borderBottom,
            strokeLeftWeight: borderLeft,
            strokeWeight: borderLeft || borderTop || borderRight || borderBottom,
            strokes: activeStrokeColor !== 'transparent' && activeStrokeColor !== 'rgba(0, 0, 0, 0)' ? [rgbaToHex(activeStrokeColor)] : [],
            boxShadow: style.boxShadow || 'none'
        }
    };
    if (isModalBackdrop) {
        nodeData.width = win.innerWidth;
        nodeData.height = win.innerHeight;
        nodeData.x = 0;
        nodeData.y = 0;
    }
    // Image and Gradient extraction
    if (element.tagName.toLowerCase() === 'img') {
        nodeData.type = 'FRAME';
        nodeData.imageUrl = element.src;
    }
    const bgImage = style.backgroundImage;
    if (bgImage && bgImage !== 'none') {
        const imgMatch = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (imgMatch) {
            nodeData.backgroundImageUrl = imgMatch[1];
        }
        else if (bgImage.includes('gradient')) {
            const gradient = parseCssGradient(bgImage, win.document);
            if (gradient) {
                nodeData.styles.backgroundGradient = gradient;
            }
        }
    }
    if (nodeData.type === 'TEXT') {
        nodeData.characters = element.textContent?.trim();
        nodeData.styles.fontSize = parseFloat(style.fontSize) || 16;
        nodeData.styles.fontFamily = style.fontFamily;
        nodeData.styles.color = rgbaToHex(style.color);
        nodeData.styles.fontWeight = style.fontWeight;
        nodeData.styles.lineHeight = style.lineHeight;
        nodeData.styles.textAlignHorizontal = style.textAlign.includes('center') ? 'CENTER' : style.textAlign.includes('right') ? 'RIGHT' : style.textAlign.includes('justify') ? 'JUSTIFIED' : 'LEFT';
    }
    else {
        const children = [];
        // Extract ::before
        const beforeStyle = win.getComputedStyle(element, '::before');
        const beforeContent = beforeStyle.content;
        if (beforeContent && beforeContent !== 'none' && beforeContent !== 'normal') {
            try {
                const span = win.document.createElement('span');
                const contentText = beforeContent.replace(/^['"]|['"]$/g, '');
                span.textContent = contentText;
                const stylesToCopy = [
                    'display', 'position', 'top', 'right', 'bottom', 'left',
                    'width', 'height', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight',
                    'color', 'backgroundColor', 'borderRadius', 'paddingTop', 'paddingRight',
                    'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom',
                    'marginLeft', 'borderStyle', 'borderWidth', 'borderColor', 'boxShadow',
                    'alignItems', 'justifyContent', 'flexDirection', 'gap'
                ];
                for (const prop of stylesToCopy) {
                    span.style[prop] = beforeStyle[prop];
                }
                if (element.firstChild) {
                    element.insertBefore(span, element.firstChild);
                }
                else {
                    element.appendChild(span);
                }
                const beforeNode = extractFigmaSchema(span, win);
                if (beforeNode) {
                    beforeNode.name = '::before';
                    children.push(beforeNode);
                }
                span.parentNode?.removeChild(span);
            }
            catch (err) {
                console.warn("Failed to extract ::before pseudo-element", err);
            }
        }
        const mappedChildren = validChildNodes.map(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent?.trim().replace(/\n/g, '').trim();
                if (text) {
                    let textX = 0;
                    let textY = 0;
                    let textW = rect.width;
                    let textH = rect.height;
                    try {
                        const span = win.document.createElement('span');
                        span.style.display = 'inline';
                        span.style.padding = '0';
                        span.style.margin = '0';
                        span.style.border = 'none';
                        child.parentNode?.insertBefore(span, child);
                        span.appendChild(child);
                        const textRect = span.getBoundingClientRect();
                        if (textRect.width > 0 || textRect.height > 0) {
                            textX = textRect.left - rect.left;
                            textY = textRect.top - rect.top;
                            textW = textRect.width;
                            textH = textRect.height;
                        }
                        span.parentNode?.insertBefore(child, span);
                        span.parentNode?.removeChild(span);
                    }
                    catch (err) {
                        console.warn("Failed to calculate text node rect with span wrapper:", err);
                    }
                    return {
                        type: 'TEXT',
                        name: 'text',
                        characters: text,
                        x: textX,
                        y: textY,
                        width: textW,
                        height: textH,
                        styles: {
                            fontSize: parseFloat(style.fontSize) || 16,
                            fontFamily: style.fontFamily,
                            color: rgbaToHex(style.color),
                            fontWeight: style.fontWeight,
                            lineHeight: style.lineHeight,
                            textAlignHorizontal: 'LEFT'
                        }
                    };
                }
                return null;
            }
            else if (child.nodeType === Node.ELEMENT_NODE) {
                return extractFigmaSchema(child, win);
            }
            return null;
        }).filter(Boolean);
        children.push(...mappedChildren);
        // Extract ::after
        const afterStyle = win.getComputedStyle(element, '::after');
        const afterContent = afterStyle.content;
        if (afterContent && afterContent !== 'none' && afterContent !== 'normal') {
            try {
                const span = win.document.createElement('span');
                const contentText = afterContent.replace(/^['"]|['"]$/g, '');
                span.textContent = contentText;
                const stylesToCopy = [
                    'display', 'position', 'top', 'right', 'bottom', 'left',
                    'width', 'height', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight',
                    'color', 'backgroundColor', 'borderRadius', 'paddingTop', 'paddingRight',
                    'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom',
                    'marginLeft', 'borderStyle', 'borderWidth', 'borderColor', 'boxShadow',
                    'alignItems', 'justifyContent', 'flexDirection', 'gap'
                ];
                for (const prop of stylesToCopy) {
                    span.style[prop] = afterStyle[prop];
                }
                element.appendChild(span);
                const afterNode = extractFigmaSchema(span, win);
                if (afterNode) {
                    afterNode.name = '::after';
                    children.push(afterNode);
                }
                span.parentNode?.removeChild(span);
            }
            catch (err) {
                console.warn("Failed to extract ::after pseudo-element", err);
            }
        }
        // Input placeholder text extraction
        if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
            const inputEl = element;
            const placeholder = inputEl.getAttribute('placeholder');
            const value = inputEl.value;
            if (placeholder && !value) {
                const paddingLeft = parseFloat(style.paddingLeft) || 12;
                const paddingTop = parseFloat(style.paddingTop) || 8;
                children.push({
                    type: 'TEXT',
                    name: 'placeholder',
                    characters: placeholder,
                    x: paddingLeft,
                    y: paddingTop,
                    width: rect.width - paddingLeft * 2,
                    height: rect.height - paddingTop * 2,
                    styles: {
                        fontSize: parseFloat(style.fontSize) || 14,
                        fontFamily: style.fontFamily,
                        color: '#94a3b8',
                        fontWeight: style.fontWeight,
                        lineHeight: style.lineHeight,
                        textAlignHorizontal: 'LEFT'
                    }
                });
            }
        }
        // Border highlights (side borders)
        const topColor = style.borderTopColor;
        const rightColor = style.borderRightColor;
        const bottomColor = style.borderBottomColor;
        const leftColor = style.borderLeftColor;
        if (isLeftColorDifferent) {
            children.push({
                type: 'FRAME',
                name: 'border-left-stripe',
                x: 0,
                y: 0,
                width: borderLeft,
                height: rect.height,
                styles: {
                    backgroundColor: rgbaToHex(leftColor),
                    borderRadius: 0,
                    layoutMode: 'NONE'
                }
            });
        }
        nodeData.children = children;
    }
    return nodeData;
}
async function fetchAndBase64(url) {
    try {
        const res = await fetch(url);
        if (!res.ok)
            return null;
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }
    catch (err) {
        console.warn(`Failed to fetch image locally for url: ${url}`, err);
        return null;
    }
}
async function resolveNodeImages(node) {
    if (node.imageUrl && !node.imageUrl.startsWith('data:')) {
        const base64 = await fetchAndBase64(node.imageUrl);
        if (base64) {
            node.imageBase64 = base64;
        }
    }
    if (node.backgroundImageUrl && !node.backgroundImageUrl.startsWith('data:')) {
        const base64 = await fetchAndBase64(node.backgroundImageUrl);
        if (base64) {
            node.backgroundImageBase64 = base64;
        }
    }
    if (node.children && node.children.length > 0) {
        await Promise.all(node.children.map((child) => resolveNodeImages(child)));
    }
}
async function runExtraction() {
    const body = document.body;
    const win = window;
    const schema = extractFigmaSchema(body, win);
    if (!schema)
        return null;
    const design = {
        name: document.title || 'Extracted Tab',
        width: win.innerWidth,
        height: win.innerHeight,
        device: win.innerWidth < 768 ? 'MOBILE' : (win.innerWidth < 1024 ? 'TABLET' : 'DESKTOP'),
        nodes: [schema]
    };
    await resolveNodeImages(design.nodes[0]);
    return design;
}
// Start extraction (executeScript will resolve this promise)
runExtraction();
