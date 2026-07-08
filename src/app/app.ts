import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, signal, computed, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

interface Device {
  id: string;
  name: string;
  width: number;
  height: number;
  icon: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, MatIconModule],
  template: `
    <div class="flex h-screen bg-zinc-950 font-sans text-zinc-100 overflow-hidden">
      
      <!-- Sidebar -->
      <aside class="w-96 flex-shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full overflow-y-auto">
        <!-- Header -->
        <div class="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 bg-zinc-100 text-zinc-900 rounded flex items-center justify-center">
              <mat-icon class="text-[18px] w-[18px] h-[18px]">transform</mat-icon>
            </div>
            <h1 class="text-xl font-semibold tracking-tight">Figify</h1>
          </div>
        </div>

        <!-- Figma Connection -->
        <div class="p-6 border-b border-zinc-800">
          <h2 class="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wider">Figma Integration</h2>
          
          @if (figmaConnected()) {
            <div class="bg-emerald-950/50 border border-emerald-900/50 rounded-xl p-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-emerald-900/50 text-emerald-400 rounded-full flex items-center justify-center">
                  <mat-icon class="text-[16px] w-[16px] h-[16px]">check_circle</mat-icon>
                </div>
                <div>
                  <p class="text-sm font-medium text-emerald-400">Connected to Figma</p>
                  <p class="text-xs text-emerald-600">OAuth Authenticated</p>
                </div>
              </div>
              <button type="button" (click)="disconnectFigma()" class="text-xs font-medium text-emerald-500 hover:text-emerald-400 underline">
                Disconnect
              </button>
            </div>
          } @else {
            <div class="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4">
              <p class="text-sm text-zinc-400 mb-3">Connect your Figma account to enable direct plugin syncing.</p>
              <button type="button" (click)="connectFigma()" class="w-full flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 hover:bg-white transition-colors py-2 px-4 rounded-lg text-sm font-medium">
                <mat-icon class="text-[16px] w-[16px] h-[16px]">link</mat-icon>
                Connect to Figma
              </button>
            </div>
          }
        </div>

        <!-- HTML Input -->
        <div class="p-6 border-b border-zinc-800 flex-1 flex flex-col">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-medium text-zinc-400 uppercase tracking-wider">HTML Input</h2>
            <button (click)="loadSample()" class="text-xs text-zinc-400 hover:text-zinc-200 underline">Load Sample</button>
          </div>
          <textarea 
            [formControl]="htmlControl" 
            class="flex-1 w-full p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl text-sm font-mono text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
            placeholder="Paste your HTML here... Tailwind CDN is automatically applied in the preview."
          ></textarea>
        </div>

        <!-- Controls & Settings -->
        <div class="p-6 bg-zinc-900 border-b border-zinc-800">
          <h2 class="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Settings & Configuration</h2>
          
          <div class="space-y-4">
            <!-- File Upload -->
            <div>
              <label class="block text-xs font-medium text-zinc-300 mb-1">Upload HTML File</label>
              <input 
                type="file" 
                accept=".html" 
                (change)="onFileSelected($event)"
                class="block w-full text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700 cursor-pointer"
              />
            </div>

            <!-- CDN Configuration -->
            <div>
              <label class="block text-xs font-medium text-zinc-300 mb-1">Inject CDNs (One per line)</label>
              <textarea 
                [formControl]="cdnsControl"
                class="w-full p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none h-24"
                placeholder="https://cdn.tailwindcss.com..."
              ></textarea>
            </div>

            <!-- State Simulation -->
            <div>
              <label class="block text-xs font-medium text-zinc-300 mb-1">Simulate Component State</label>
              <select 
                [formControl]="stateControl"
                class="w-full p-2 bg-zinc-950/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                <option value="default">Default</option>
                <option value="hover">Hover</option>
                <option value="focus">Focus</option>
                <option value="active">Active</option>
              </select>
              <p class="text-[10px] text-zinc-500 mt-1">Forces state on components to extract variant styles.</p>
            </div>
          </div>
        </div>

        <div class="p-6 bg-zinc-950 border-t border-zinc-800">
          <h2 class="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wider">Viewport</h2>
          <div class="flex gap-2 mb-6">
            @for (device of devices; track device.id) {
              <button 
                type="button"
                (click)="selectedDevice.set(device)"
                class="flex-1 flex flex-col items-center justify-center py-3 rounded-xl border transition-all"
                [class.border-zinc-500]="selectedDevice().id === device.id"
                [class.bg-zinc-800]="selectedDevice().id === device.id"
                [class.border-zinc-800]="selectedDevice().id !== device.id"
                [class.text-zinc-100]="selectedDevice().id === device.id"
                [class.text-zinc-500]="selectedDevice().id !== device.id"
                [class.hover:bg-zinc-800/50]="selectedDevice().id !== device.id"
              >
                <mat-icon class="mb-1">{{ device.icon }}</mat-icon>
                <span class="text-xs font-medium">{{ device.name }}</span>
              </button>
            }
          </div>

          <button 
            type="button"
            (click)="processHtml()" 
            [disabled]="isProcessing()"
            class="w-full flex items-center justify-center gap-2 bg-zinc-100 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-900 hover:bg-white transition-colors py-3 px-4 rounded-xl text-sm font-medium shadow-sm"
          >
            @if (isProcessing()) {
              <mat-icon class="animate-spin">autorenew</mat-icon>
              Processing...
            } @else {
              <mat-icon>auto_awesome</mat-icon>
              Generate Figma Schema
            }
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col min-w-0 bg-zinc-950">
        <!-- Tabs -->
        <header class="bg-zinc-900 border-b border-zinc-800 px-6 flex items-end h-16 shrink-0">
          <div class="flex gap-6 h-full">
            <button 
              (click)="activeTab.set('preview')"
              class="h-full border-b-2 px-2 font-medium text-sm transition-colors flex items-center gap-2"
              [class.border-zinc-100]="activeTab() === 'preview'"
              [class.text-zinc-100]="activeTab() === 'preview'"
              [class.border-transparent]="activeTab() !== 'preview'"
              [class.text-zinc-500]="activeTab() !== 'preview'"
              [class.hover:text-zinc-300]="activeTab() !== 'preview'"
            >
              <mat-icon class="text-[18px] w-[18px] h-[18px]">preview</mat-icon>
              Live Preview
            </button>
            <button 
              (click)="activeTab.set('json')"
              class="h-full border-b-2 px-2 font-medium text-sm transition-colors flex items-center gap-2"
              [class.border-zinc-100]="activeTab() === 'json'"
              [class.text-zinc-100]="activeTab() === 'json'"
              [class.border-transparent]="activeTab() !== 'json'"
              [class.text-zinc-500]="activeTab() !== 'json'"
              [class.hover:text-zinc-300]="activeTab() !== 'json'"
            >
              <mat-icon class="text-[18px] w-[18px] h-[18px]">data_object</mat-icon>
              JSON Schema Output
            </button>
          </div>
        </header>

        <!-- Canvas Area -->
        <div class="flex-1 overflow-auto p-8 flex justify-center">
          
          <!-- Preview Tab -->
          @if (activeTab() === 'preview') {
            <div class="flex flex-col items-center w-full">
              <div class="mb-4 text-sm font-medium text-zinc-500">
                {{ selectedDevice().width }}px &times; {{ selectedDevice().height }}px
              </div>
              <div 
                class="bg-white shadow-xl shadow-black/50 border border-zinc-800 overflow-hidden transition-all duration-300 ease-in-out relative rounded-xl"
                [style.width.px]="selectedDevice().width"
                [style.height.px]="selectedDevice().height"
              >
                <!-- Iframe for isolated CSS rendering -->
                <iframe 
                  #previewFrame
                  [srcdoc]="safeHtmlContent()"
                  class="w-full h-full border-none"
                  sandbox="allow-scripts allow-same-origin"
                ></iframe>
              </div>
            </div>
          }

          <!-- JSON Tab -->
          @if (activeTab() === 'json') {
            <div class="w-full max-w-4xl bg-zinc-900 shadow-sm border border-zinc-800 rounded-xl flex flex-col h-full max-h-full">
              <div class="p-4 border-b border-zinc-800 bg-zinc-950/50 rounded-t-xl flex justify-between items-center">
                <span class="text-sm font-medium text-zinc-300">Figma Plugin Payload</span>
                <button (click)="copyJson()" class="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 hover:bg-zinc-700 font-medium text-zinc-300 flex items-center gap-1 transition-colors">
                  <mat-icon class="text-[14px] w-[14px] h-[14px]">content_copy</mat-icon>
                  Copy
                </button>
              </div>
              <div class="flex-1 overflow-auto p-4 bg-[#1E1E1E]">
                <pre class="text-xs font-mono text-[#D4D4D4] leading-relaxed"><code>{{ jsonOutput() }}</code></pre>
              </div>
            </div>
          }
        </div>
      </main>
    </div>
  `
})
export class App implements OnInit {
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);
  private http = inject(HttpClient);

  @ViewChild('previewFrame') previewFrame?: ElementRef<HTMLIFrameElement>;

  devices: Device[] = [
    { id: 'mobile', name: 'Mobile', width: 375, height: 812, icon: 'smartphone' },
    { id: 'tablet', name: 'Tablet', width: 768, height: 1024, icon: 'tablet_mac' },
    { id: 'desktop', name: 'Desktop', width: 1440, height: 900, icon: 'desktop_mac' }
  ];

  selectedDevice = signal<Device>(this.devices[0]);
  activeTab = signal<'preview' | 'json'>('preview');
  isProcessing = signal(false);
  figmaConnected = signal(false);
  jsonOutput = signal<string>('// Process HTML to generate schema');

  htmlControl = this.fb.control('');
  cdnsControl = this.fb.control('https://cdn.tailwindcss.com\nhttps://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');
  stateControl = this.fb.control('default');

  safeHtmlContent = computed(() => {
    const raw = this.htmlControl.value || '';
    const cdns = (this.cdnsControl.value || '').split('\n').filter(l => l.trim().length > 0);
    
    let cdnTags = cdns.map(url => {
      url = url.trim();
      if (url.endsWith('.css')) return `<link rel="stylesheet" href="${url}">`;
      return `<script src="${url}"></script>`;
    }).join('\\n');

    let stateInjection = '';
    const state = this.stateControl.value;
    if (state !== 'default') {
      // Very basic simulation for tailwind specifically or general states
      stateInjection = `
        <script>
          window.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('*').forEach(el => {
              // Try to force tailwind pseudo classes by modifying classes
              // e.g., hover:bg-blue-500 becomes bg-blue-500
              const classes = Array.from(el.classList);
              classes.forEach(c => {
                if (c.startsWith('${state}:')) {
                  el.classList.add(c.replace('${state}:', ''));
                }
              });
            });
          });
        </script>
      `;
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          ${cdnTags}
          ${stateInjection}
          <style>
            body { margin: 0; padding: 0; font-family: sans-serif; }
          </style>
        </head>
        <body>
          ${raw}
        </body>
      </html>
    `;
    return this.sanitizer.bypassSecurityTrustHtml(fullHtml);
  });

  ngOnInit() {
    this.checkFigmaStatus();
    this.loadSample();
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        this.htmlControl.setValue(text);
      };
      reader.readAsText(file);
    }
  }

  loadSample() {
    const sample = `<div class="p-8 bg-white min-h-screen">
  <div class="max-w-sm mx-auto bg-slate-50 rounded-2xl shadow-sm border border-slate-100 p-6">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold text-slate-800">Card Title</h2>
      <i class="fa-solid fa-heart text-rose-500"></i>
    </div>
    <p class="text-slate-600 mb-6 text-sm leading-relaxed">
      This is a sample card utilizing Tailwind CSS and Font Awesome. It will be converted into a Figma frame with Auto Layout.
    </p>
    <button class="w-full bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 transition-colors">
      Action Button
    </button>
  </div>
</div>`;
    this.htmlControl.setValue(sample);
  }

  checkFigmaStatus() {
    this.http.get<{connected: boolean}>('/api/figma/status').subscribe({
      next: (res) => this.figmaConnected.set(res.connected),
      error: () => this.figmaConnected.set(false)
    });
  }

  connectFigma() {
    this.http.post('/api/figma/mock-login', {}).subscribe({
      next: () => this.figmaConnected.set(true),
      error: (err) => console.error('Failed to connect to Figma', err)
    });
  }

  disconnectFigma() {
    this.http.post('/api/figma/disconnect', {}).subscribe(() => {
      this.figmaConnected.set(false);
    });
  }

  async processHtml() {
    if (!this.previewFrame || !this.previewFrame.nativeElement) return;
    
    this.isProcessing.set(true);
    
    // Allow UI to update
    await new Promise(r => setTimeout(r, 100));

    try {
      const iframe = this.previewFrame.nativeElement;
      const iframeDoc = iframe.contentDocument;
      const iframeWin = iframe.contentWindow;

      if (!iframeDoc || !iframeWin) {
        throw new Error("Cannot access iframe contents");
      }

      // Wait a bit for CDNs to apply
      await new Promise(r => setTimeout(r, 500));

      const body = iframeDoc.body;
      const schema = this.extractFigmaSchema(body, iframeWin);
      
      const payload = {
        version: "1.0",
        device: this.selectedDevice().id,
        viewport: { width: this.selectedDevice().width, height: this.selectedDevice().height },
        nodes: schema.children || [] // Skip the body tag itself, just take its children
      };

      this.jsonOutput.set(JSON.stringify(payload, null, 2));
      this.activeTab.set('json');

    } catch (e) {
      console.error(e);
      this.jsonOutput.set(`// Error processing HTML: ${e}`);
    } finally {
      this.isProcessing.set(false);
    }
  }

  copyJson() {
    navigator.clipboard.writeText(this.jsonOutput());
  }

  private extractFigmaSchema(element: HTMLElement, win: Window): any {
    if (element.nodeType !== Node.ELEMENT_NODE) return null;
    
    const style = win.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return null;

    const rect = element.getBoundingClientRect();
    
    // Ignore empty/zero-size containers unless they have children
    if (rect.width === 0 && rect.height === 0 && element.childNodes.length === 0) return null;

    // Check if SVG
    if (element.tagName.toLowerCase() === 'svg') {
      return {
        type: 'VECTOR',
        name: 'svg',
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        svgContent: element.outerHTML
      };
    }

    const className = typeof element.className === 'string' ? element.className : (element.getAttribute('class') || '');
    
    // Font Awesome icons (i tags)
    if (element.tagName.toLowerCase() === 'i' && className.includes('fa-')) {
        // Technically Font Awesome sets content via ::before, we could extract the char or treat as text
        return {
          type: 'TEXT',
          name: 'icon',
          characters: win.getComputedStyle(element, '::before').content?.replace(/"/g, '') || '',
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          styles: {
            fontFamily: style.fontFamily,
            fontSize: parseFloat(style.fontSize),
            color: this.rgbaToHex(style.color)
          }
        };
    }

    // A node is purely text if all its nodes are TEXT_NODE or <br> and it doesn't just consist of whitespaces
    const validChildNodes = Array.from(element.childNodes).filter(n => n.nodeType !== Node.COMMENT_NODE);
    const isPureText = validChildNodes.length > 0 && validChildNodes.every(n => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName.toLowerCase() === 'br'));
    
    const nodeData: any = {
      type: isPureText && element.textContent?.trim() ? 'TEXT' : 'FRAME',
      name: element.tagName.toLowerCase(),
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      styles: {
        backgroundColor: this.rgbaToHex(style.backgroundColor),
        borderRadius: parseFloat(style.borderRadius),
        layoutMode: style.display === 'flex' ? (style.flexDirection.includes('row') ? 'HORIZONTAL' : 'VERTICAL') : 'NONE',
        paddingTop: parseFloat(style.paddingTop),
        paddingRight: parseFloat(style.paddingRight),
        paddingBottom: parseFloat(style.paddingBottom),
        paddingLeft: parseFloat(style.paddingLeft),
      }
    };

    if (nodeData.type === 'TEXT') {
      nodeData.characters = element.textContent?.trim();
      nodeData.styles.fontSize = parseFloat(style.fontSize);
      nodeData.styles.fontFamily = style.fontFamily;
      nodeData.styles.color = this.rgbaToHex(style.color);
      nodeData.styles.fontWeight = style.fontWeight;
      nodeData.styles.lineHeight = style.lineHeight;
    } else {
      // If it's a frame, we process its childNodes to capture both elements and loose text nodes
      const children = validChildNodes.map(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent?.trim();
          if (text) {
            return {
              type: 'TEXT',
              name: 'text',
              characters: text,
              x: rect.left, // rough estimate for loose text
              y: rect.top,
              width: rect.width,
              height: rect.height,
              styles: {
                fontSize: parseFloat(style.fontSize),
                fontFamily: style.fontFamily,
                color: this.rgbaToHex(style.color),
                fontWeight: style.fontWeight,
                lineHeight: style.lineHeight
              }
            };
          }
          return null;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          return this.extractFigmaSchema(child as HTMLElement, win);
        }
        return null;
      }).filter(Boolean);
      
      if (children.length > 0) {
        nodeData.children = children;
      }
    }

    return nodeData;
  }

  private rgbaToHex(rgba: string): string {
    if (rgba === 'rgba(0, 0, 0, 0)' || rgba === 'transparent') return 'transparent';
    const parts = rgba.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (!parts) return rgba;
    
    const r = parseInt(parts[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(parts[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(parts[3], 10).toString(16).padStart(2, '0');
    const a = parts[5] ? Math.round(parseFloat(parts[5]) * 255).toString(16).padStart(2, '0') : '';
    
    return `#${r}${g}${b}${a}`;
  }
}
