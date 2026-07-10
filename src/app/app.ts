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
            <div class="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-2">
              <p class="text-sm text-zinc-400 mb-1">Connect your Figma account to enable direct plugin syncing.</p>
              <button type="button" (click)="connectFigma()" class="w-full flex items-center justify-center gap-2 bg-zinc-100 text-zinc-900 hover:bg-white transition-colors py-2 px-4 rounded-lg text-sm font-medium">
                <mat-icon class="text-[16px] w-[16px] h-[16px]">link</mat-icon>
                Connect to Figma
              </button>
              <button type="button" (click)="connectFigmaMock()" class="w-full flex items-center justify-center gap-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-750 transition-colors py-2 px-4 rounded-lg text-sm font-medium">
                <mat-icon class="text-[16px] w-[16px] h-[16px]">vpn_key</mat-icon>
                Mock Connect (Bypass OAuth)
              </button>
            </div>
          }
        </div>

        <!-- Paso 1: Carga tu HTML -->
        <div class="p-6 border-b border-zinc-800 flex-shrink-0 flex flex-col min-h-[220px]">
          <!-- Mode Toggle Tabs -->
          <div class="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
            <div class="flex gap-4">
              <button 
                type="button"
                (click)="inputMode.set('file')"
                class="text-xs font-semibold pb-2 border-b-2 transition-colors cursor-pointer"
                [class.border-zinc-100]="inputMode() === 'file'"
                [class.text-zinc-100]="inputMode() === 'file'"
                [class.border-transparent]="inputMode() !== 'file'"
                [class.text-zinc-500]="inputMode() !== 'file'"
                [class.hover:text-zinc-300]="inputMode() !== 'file'"
              >
                Load File
              </button>
              <button 
                type="button"
                (click)="inputMode.set('text')"
                class="text-xs font-semibold pb-2 border-b-2 transition-colors cursor-pointer"
                [class.border-zinc-100]="inputMode() === 'text'"
                [class.text-zinc-100]="inputMode() === 'text'"
                [class.border-transparent]="inputMode() !== 'text'"
                [class.text-zinc-500]="inputMode() !== 'text'"
                [class.hover:text-zinc-300]="inputMode() !== 'text'"
              >
                Input HTML
              </button>
            </div>
            
            <button 
              type="button"
              (click)="loadSample(); loadedFileName.set('sample_card.html')"
              class="text-xs text-zinc-500 hover:text-zinc-350 transition-colors cursor-pointer flex items-center gap-1"
            >
              <mat-icon class="text-sm w-4 h-4">lightbulb</mat-icon>
              Load Sample
            </button>
          </div>

          <!-- Mode A: Load File View -->
          @if (inputMode() === 'file') {
            <div class="flex-1 flex flex-col justify-center">
              @if (!loadedFileName()) {
                <!-- Beautiful dashed drop-zone area -->
                <div class="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl p-6 bg-zinc-950/20 hover:bg-zinc-950/40 transition-all cursor-pointer relative min-h-[140px]">
                  <mat-icon class="text-zinc-500 mb-2 text-[32px] w-[32px] h-[32px]">upload_file</mat-icon>
                  <span class="text-xs text-zinc-300 font-medium">Select or Drop HTML File</span>
                  <span class="text-[10px] text-zinc-500 mt-1">Accepts files ending in .html</span>
                  <input type="file" accept=".html" (change)="onFileSelected($event)" class="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              } @else {
                <!-- Success state with loaded file name -->
                <div class="p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between shadow-sm">
                  <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-8 h-8 rounded-lg bg-emerald-950/50 border border-emerald-900/50 text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <mat-icon class="text-base w-4 h-4">check_circle</mat-icon>
                    </div>
                    <div class="overflow-hidden">
                      <p class="text-xs font-medium text-zinc-200 truncate">{{ loadedFileName() }}</p>
                      <p class="text-[10px] text-zinc-500">File loaded successfully</p>
                    </div>
                  </div>
                  <button type="button" (click)="clearFile()" class="text-zinc-500 hover:text-zinc-300 transition-colors p-1 hover:bg-zinc-800 rounded-lg cursor-pointer">
                    <mat-icon class="text-lg w-5 h-5">close</mat-icon>
                  </button>
                </div>
              }
            </div>
          }

          <!-- Mode B: Paste/Input HTML View -->
          @if (inputMode() === 'text') {
            <textarea 
              [formControl]="htmlControl" 
              class="flex-1 w-full p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl text-sm font-mono text-zinc-350 focus:outline-none focus:ring-2 focus:ring-zinc-800 resize-none min-h-[140px]"
              placeholder="Paste your HTML code here..."
            ></textarea>
          }
        </div>

        <!-- Paso 2: Configuración de Viewport y Estados -->
        <div class="p-6 border-b border-zinc-800 bg-zinc-900/50">
          <h2 class="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">2. Viewport & States</h2>
          
          <div class="space-y-4">
            <!-- Viewport buttons -->
            <div class="flex gap-2">
              @for (device of devices; track device.id) {
                <button 
                  type="button"
                  (click)="selectedDevice.set(device)"
                  class="flex-1 flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all cursor-pointer"
                  [class.border-zinc-500]="selectedDevice().id === device.id"
                  [class.bg-zinc-800]="selectedDevice().id === device.id"
                  [class.border-zinc-800]="selectedDevice().id !== device.id"
                  [class.text-zinc-100]="selectedDevice().id === device.id"
                  [class.text-zinc-500]="selectedDevice().id !== device.id"
                  [class.hover:bg-zinc-800/50]="selectedDevice().id !== device.id"
                >
                  <mat-icon class="mb-1 text-lg">{{ device.icon }}</mat-icon>
                  <span class="text-[10px] font-medium">{{ device.name }}</span>
                </button>
              }
            </div>

            <!-- State selection & CDNs -->
            <div class="flex gap-4 items-end">
              <div class="flex-1">
                <label class="block text-[10px] font-medium text-zinc-400 mb-1">Simulate Component State</label>
                <select 
                  [formControl]="stateControl"
                  class="w-full p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-350 focus:outline-none focus:ring-1 focus:ring-zinc-700 cursor-pointer"
                >
                  <option value="default">Default State</option>
                  <option value="hover">Hover State</option>
                  <option value="focus">Focus State</option>
                  <option value="active">Active State</option>
                </select>
              </div>
            </div>

            <!-- Collapsible CDNs -->
            <details class="text-[11px] text-zinc-500 cursor-pointer select-none">
              <summary class="hover:text-zinc-400 transition-colors">Advanced Settings (CDNs)</summary>
              <div class="mt-2 space-y-2 pointer-events-auto cursor-default">
                <label class="block text-[10px] font-medium text-zinc-400 mb-1">Inject CDNs (One per line)</label>
                <textarea 
                  [formControl]="cdnsControl"
                  class="w-full p-2 bg-zinc-950/70 border border-zinc-800 rounded-lg text-[10px] font-mono text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-750 resize-none h-16"
                  placeholder="https://cdn.tailwindcss.com..."
                ></textarea>
              </div>
            </details>
          </div>
        </div>

        <!-- Paso 3: Sincronización a Figma -->
        <div class="p-6 bg-zinc-950 border-t border-zinc-800">
          <h2 class="text-xs font-semibold text-zinc-400 mb-3 uppercase tracking-wider">3. Sync to Figma</h2>
          
          <div class="space-y-3">
            <div>
              <label class="block text-[10px] font-medium text-zinc-400 mb-1">Design Name</label>
              <input 
                type="text" 
                [formControl]="designNameControl"
                class="w-full p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                placeholder="Enter design name..."
              />
            </div>
            <button 
              type="button"
              (click)="syncToFigma()"
              [disabled]="isSyncing() || !htmlControl.value"
              class="w-full flex items-center justify-center gap-2 bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white hover:bg-emerald-500 transition-colors py-3 px-4 rounded-xl text-sm font-medium shadow-sm cursor-pointer"
            >
              @if (isSyncing()) {
                <mat-icon class="animate-spin text-lg">autorenew</mat-icon>
                Syncing Design...
              } @else {
                <mat-icon class="text-lg">sync</mat-icon>
                Sync Design to Figma
              }
            </button>
            @if (syncSuccess()) {
              <p class="text-xs text-emerald-400 text-center font-medium">Design synced successfully!</p>
            }

            <!-- Next steps guidance checklist -->
            <div class="mt-4 p-3 bg-zinc-900/50 border border-zinc-850 rounded-xl space-y-2">
              <h3 class="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Import Instructions:</h3>
              <ol class="text-[11px] text-zinc-500 list-decimal list-inside space-y-1">
                <li>Open the <span class="text-zinc-300 font-medium">Figify</span> plugin in Figma</li>
                <li>Find <span class="text-zinc-300 font-medium">"{{ designNameControl.value || 'My Design' }}"</span></li>
                <li>Click <span class="text-zinc-300 font-medium">Import</span> to draw it on your canvas</li>
              </ol>
            </div>
          </div>
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
  inputMode = signal<'file' | 'text'>('file');
  loadedFileName = signal<string>('');
  isProcessing = signal(false);
  isSyncing = signal(false);
  syncSuccess = signal(false);
  figmaConnected = signal(false);
  jsonOutput = signal<string>('// Process HTML to generate schema');

  htmlControl = this.fb.control('');
  htmlContent = signal<string>('');
  cdnsControl = this.fb.control('https://cdn.tailwindcss.com\nhttps://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js');
  stateControl = this.fb.control('default');
  designNameControl = this.fb.control('My Design');

  safeHtmlContent = computed(() => {
    const raw = this.htmlContent() || '';
    const cdns = (this.cdnsControl.value || '').split('\n').filter(l => l.trim().length > 0);
    
    let cdnTags = cdns.map(url => {
      url = url.trim();
      if (url.endsWith('.css')) return `<link rel="stylesheet" href="${url}">`;
      return `<script src="${url}"></script>`;
    }).join('\n');

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
    
    // Bind form changes to signal for computed property reactivity
    this.htmlControl.valueChanges.subscribe(val => {
      this.htmlContent.set(val || '');
    });
    
    this.loadSample();
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.loadedFileName.set(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        this.htmlControl.setValue(text);
      };
      reader.readAsText(file);
    }
  }

  clearFile() {
    this.loadedFileName.set('');
    this.htmlControl.setValue('');
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
    window.location.href = '/api/figma/auth';
  }

  connectFigmaMock() {
    this.http.post('/api/figma/mock-login', {}).subscribe(() => {
      this.figmaConnected.set(true);
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
      await new Promise(r => setTimeout(r, 800));

      const body = iframeDoc.body;
      const schema = this.extractFigmaSchema(body, iframeWin);
      
      const payload = {
        version: "1.0",
        device: this.selectedDevice().id,
        viewport: { width: this.selectedDevice().width, height: this.selectedDevice().height },
        nodes: schema.children || [] // Skip the body tag itself, just take its children
      };

      this.jsonOutput.set(JSON.stringify(payload, null, 2));

    } catch (e) {
      console.error(e);
      this.jsonOutput.set(`// Error processing HTML: ${e}`);
    } finally {
      this.isProcessing.set(false);
    }
  }

  async syncToFigma() {
    this.isSyncing.set(true);
    this.syncSuccess.set(false);

    try {
      await this.processHtml();

      const payloadStr = this.jsonOutput();
      if (payloadStr.startsWith('// Error')) {
        throw new Error("Cannot sync due to generation error: " + payloadStr);
      }

      const payload = JSON.parse(payloadStr);
      
      this.http.post('/api/figma/designs', {
        name: this.designNameControl.value || 'Unnamed Design',
        device: this.selectedDevice().id,
        width: this.selectedDevice().width,
        height: this.selectedDevice().height,
        nodes: payload.nodes
      }).subscribe({
        next: (res: any) => {
          if (res.success) {
            this.syncSuccess.set(true);
            setTimeout(() => this.syncSuccess.set(false), 3000);
          }
        },
        error: (err) => {
          console.error("Failed to sync design:", err);
          alert("Failed to sync design: " + (err.error?.error || err.message));
        }
      });

    } catch (e: any) {
      console.error(e);
      alert("Error preparing sync: " + e.message);
    } finally {
      this.isSyncing.set(false);
    }
  }

  copyJson() {
    navigator.clipboard.writeText(this.jsonOutput());
  }

  private isTextBlock(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    const textTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'label', 'legend', 'strong', 'em', 'b', 'i', 'small', 'code'];
    if (!textTags.includes(tagName)) return false;

    const layoutElements = element.querySelectorAll('div, section, article, nav, header, footer, main, aside, ul, ol, li, table, form, input, textarea, button, img, svg');
    if (layoutElements.length > 0) return false;

    return (element.textContent || '').trim().length > 0;
  }

  private getElementText(element: HTMLElement, doc: Document): string {
    if (element.childNodes.length === 1 && element.firstChild?.nodeType === Node.TEXT_NODE) {
      return element.textContent?.trim() || '';
    }
    const clone = element.cloneNode(true) as HTMLElement;
    const brs = clone.querySelectorAll('br');
    brs.forEach(br => br.parentNode?.replaceChild(doc.createTextNode('\n'), br));
    return clone.textContent?.trim().replace(/[ \t]+/g, ' ') || '';
  }

  private extractFigmaSchema(element: HTMLElement, win: Window): any {
    if (element.nodeType !== Node.ELEMENT_NODE) return null;
    
    const style = win.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return null;

    const rect = element.getBoundingClientRect();
    
    // Ignore empty/zero-size containers unless they have children
    if (rect.width === 0 && rect.height === 0 && element.childNodes.length === 0) return null;

    const parentRect = element.parentElement?.getBoundingClientRect();
    let x = rect.left - (parentRect ? parentRect.left : 0);
    let y = rect.top - (parentRect ? parentRect.top : 0);

    // Check if it is a text block first
    if (this.isTextBlock(element)) {
      const opacityVal = style.opacity !== undefined && style.opacity !== '' ? parseFloat(style.opacity) : 1;
      return {
        type: 'TEXT',
        name: this.getSmartNodeName(element),
        x: x,
        y: y,
        width: rect.width,
        height: rect.height,
        characters: this.getElementText(element, win.document),
        styles: {
          fontSize: parseFloat(style.fontSize) || 16,
          fontFamily: style.fontFamily,
          color: this.rgbaToHex(style.color),
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          textAlignHorizontal: style.textAlign.includes('center') ? 'CENTER' : style.textAlign.includes('right') ? 'RIGHT' : style.textAlign.includes('justify') ? 'JUSTIFIED' : 'LEFT',
          layoutPositioning: style.position === 'absolute' || style.position === 'fixed' ? 'ABSOLUTE' : 'RELATIVE',
          opacity: opacityVal
        }
      };
    }

    // Check if this element is a screen-sized overlay / modal backdrop based on viewport dimension ratios
    const isModalBackdrop = (style.position === 'fixed' || style.position === 'absolute') && 
                            (rect.width >= win.innerWidth * 0.85) && 
                            (rect.height >= win.innerHeight * 0.85);

    // If this element's parent is a screen-sized overlay / modal backdrop, center it
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

    // Check if SVG
    if (element.tagName.toLowerCase() === 'svg') {
      let svgHtml = element.outerHTML;
      const computedColor = style.color || 'rgb(0, 0, 0)';
      
      // Replace currentColor with computed color
      svgHtml = svgHtml.replace(/currentColor/gi, computedColor);
      
      // If the svg doesn't have a fill or stroke attribute, inject the computed color as the default fill
      if (!svgHtml.includes('fill=') && !svgHtml.includes('stroke=')) {
        svgHtml = svgHtml.replace('<svg', `<svg fill="${computedColor}"`);
      }

      return {
        type: 'VECTOR',
        name: this.getSmartNodeName(element),
        x: x,
        y: y,
        width: rect.width,
        height: rect.height,
        svgContent: svgHtml
      };
    }

    const className = typeof element.className === 'string' ? element.className : (element.getAttribute('class') || '');
    
    // Font Awesome icons (i tags) - fallback if not replaced by SVG script
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
            color: this.rgbaToHex(style.color)
          }
        };
    }

    // A node is purely text if all its nodes are TEXT_NODE or <br> and it doesn't just consist of whitespaces
    const validChildNodes = Array.from(element.childNodes).filter(n => {
      if (n.nodeType === Node.COMMENT_NODE) return false;
      if (n.nodeType === Node.TEXT_NODE) {
        const text = n.textContent?.trim().replace(/\\n/g, '').replace(/\n/g, '').trim();
        return !!text;
      }
      return true;
    });
    const isPureText = validChildNodes.length > 0 && validChildNodes.every(n => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName.toLowerCase() === 'br'));
    
    const bg = style.backgroundColor;
    const isBgTransparent = !bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' || bg === 'rgba(0,0,0,0)';
    const borderTop = parseFloat(style.borderTopWidth) || 0;
    const borderRight = parseFloat(style.borderRightWidth) || 0;
    const borderBottom = parseFloat(style.borderBottomWidth) || 0;
    const borderLeft = parseFloat(style.borderLeftWidth) || 0;
    
    const hasVisualStyles = 
      !isBgTransparent ||
      (parseFloat(style.borderRadius) || 0) > 0 ||
      (style.boxShadow && style.boxShadow !== 'none') ||
      borderTop > 0 || borderRight > 0 || borderBottom > 0 || borderLeft > 0;

    let activeStrokeColor = 'transparent';
    const isLeftColorDifferent = borderLeft > 0 && style.borderLeftColor !== style.borderTopColor && style.borderLeftColor !== 'transparent' && style.borderLeftColor !== 'rgba(0, 0, 0, 0)';
    
    if (borderTop > 0) activeStrokeColor = style.borderTopColor;
    else if (borderRight > 0) activeStrokeColor = style.borderRightColor;
    else if (borderBottom > 0) activeStrokeColor = style.borderBottomColor;
    else if (borderLeft > 0 && !isLeftColorDifferent) activeStrokeColor = style.borderLeftColor;
    else if (style.borderColor && style.borderStyle !== 'none') activeStrokeColor = style.borderColor;

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
    } else if (layoutMode === 'VERTICAL') {
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
        } else if (style.alignSelf === 'center' || parentStyle.alignItems === 'center') {
          layoutAlign = 'CENTER';
        } else if (style.alignSelf === 'flex-end' || parentStyle.alignItems === 'flex-end') {
          layoutAlign = 'MAX';
        }
      }
    }

    const opacityVal = style.opacity !== undefined && style.opacity !== '' ? parseFloat(style.opacity) : 1;
    const filter = style.filter;
    let blurRadius = 0;
    if (filter && filter.includes('blur')) {
      const match = filter.match(/blur\(([\d.]+)px\)/);
      if (match) {
        blurRadius = parseFloat(match[1]);
      }
    }

    const nodeData: any = {
      type: isPureText && element.textContent?.trim() && !hasVisualStyles ? 'TEXT' : 'FRAME',
      name: this.getSmartNodeName(element),
      x: x,
      y: y,
      width: rect.width,
      height: rect.height,
      styles: {
        backgroundColor: this.rgbaToHex(style.backgroundColor),
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
        strokes: activeStrokeColor !== 'transparent' && activeStrokeColor !== 'rgba(0, 0, 0, 0)' ? [this.rgbaToHex(activeStrokeColor)] : [],
        boxShadow: style.boxShadow || 'none',
        opacity: opacityVal,
        layerBlur: blurRadius
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
      nodeData.imageUrl = (element as HTMLImageElement).src;
    }

    const bgImage = style.backgroundImage;
    if (bgImage && bgImage !== 'none') {
      const imgMatch = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
      if (imgMatch) {
        nodeData.backgroundImageUrl = imgMatch[1];
      } else if (bgImage.includes('gradient')) {
        const gradient = this.parseCssGradient(bgImage, win.document);
        if (gradient) {
          nodeData.styles.backgroundGradient = gradient;
        }
      }
    }

    if (nodeData.type === 'TEXT') {
      nodeData.characters = element.textContent?.trim();
      nodeData.styles.fontSize = parseFloat(style.fontSize) || 16;
      nodeData.styles.fontFamily = style.fontFamily;
      nodeData.styles.color = this.rgbaToHex(style.color);
      nodeData.styles.fontWeight = style.fontWeight;
      nodeData.styles.lineHeight = style.lineHeight;
      nodeData.styles.textAlignHorizontal = style.textAlign.includes('center') ? 'CENTER' : style.textAlign.includes('right') ? 'RIGHT' : style.textAlign.includes('justify') ? 'JUSTIFIED' : 'LEFT';
    } else {
      const children: any[] = [];

      // Extract ::before pseudo-element
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
            (span.style as any)[prop] = (beforeStyle as any)[prop];
          }

          if (element.firstChild) {
            element.insertBefore(span, element.firstChild);
          } else {
            element.appendChild(span);
          }

          const beforeNode = this.extractFigmaSchema(span, win);
          if (beforeNode) {
            beforeNode.name = '::before';
            children.push(beforeNode);
          }
          span.parentNode?.removeChild(span);
        } catch (err) {
          console.warn("Failed to extract ::before pseudo-element", err);
        }
      }

      const mappedChildren = validChildNodes.map(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent?.trim().replace(/\\n/g, '').replace(/\n/g, '').trim();
          if (text) {
            let textX = 0;
            let textY = 0;
            let textW = rect.width;
            let textH = rect.height;

            try {
              // Wrap the text node in a temporary span to force a real inline layout box (avoids anonymous Flexbox box-less issues)
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
              
              // Restore DOM back to normal immediately
              span.parentNode?.insertBefore(child, span);
              span.parentNode?.removeChild(span);
            } catch (err) {
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
                color: this.rgbaToHex(style.color),
                fontWeight: style.fontWeight,
                lineHeight: style.lineHeight,
                textAlignHorizontal: 'LEFT'
              }
            };
          }
          return null;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          return this.extractFigmaSchema(child as HTMLElement, win);
        }
        return null;
      }).filter(Boolean);

      children.push(...mappedChildren);

      // Extract ::after pseudo-element
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
            (span.style as any)[prop] = (afterStyle as any)[prop];
          }

          element.appendChild(span);

          const afterNode = this.extractFigmaSchema(span, win);
          if (afterNode) {
            afterNode.name = '::after';
            children.push(afterNode);
          }
          span.parentNode?.removeChild(span);
        } catch (err) {
          console.warn("Failed to extract ::after pseudo-element", err);
        }
      }

      // If the element is an input or textarea with placeholder text or value, extract it as a virtual text child node
      if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
        const inputEl = element as HTMLInputElement;
        const placeholder = inputEl.getAttribute('placeholder');
        const value = inputEl.value;
        const textToShow = value || placeholder;
        
        if (textToShow) {
          const paddingLeft = parseFloat(style.paddingLeft) || 12;
          const paddingTop = parseFloat(style.paddingTop) || 8;
          
          children.push({
            type: 'TEXT',
            name: value ? 'value' : 'placeholder',
            characters: textToShow,
            x: paddingLeft,
            y: paddingTop,
            width: Math.max(10, rect.width - paddingLeft - (parseFloat(style.paddingRight) || 12)),
            height: Math.max(10, rect.height - paddingTop - (parseFloat(style.paddingBottom) || 8)),
            styles: {
              fontSize: parseFloat(style.fontSize) || 14,
              fontFamily: style.fontFamily,
              color: value ? this.rgbaToHex(style.color) : '#94a3b8',
              fontWeight: '400',
              lineHeight: style.lineHeight,
              textAlignHorizontal: 'LEFT'
            }
          });
        }
      }
      
      // Check if there is an individual side border with a distinct color, and draw it as a stripe child frame
      const topColor = style.borderTopColor;
      const rightColor = style.borderRightColor;
      const bottomColor = style.borderBottomColor;
      const leftColor = style.borderLeftColor;
      
      const isColorDifferent = (c1: string, c2: string) => {
        return c1 && c2 && c1 !== c2 && c1 !== 'transparent' && c1 !== 'rgba(0, 0, 0, 0)';
      };

      // 1. Left stripe
      if (borderLeft > 0 && isColorDifferent(leftColor, topColor)) {
        children.unshift({
          type: 'FRAME',
          name: 'border-left-stripe',
          x: 0,
          y: 0,
          width: borderLeft,
          height: rect.height,
          styles: {
            backgroundColor: this.rgbaToHex(leftColor),
            borderRadius: 0,
            layoutMode: 'NONE',
            strokeWeight: 0,
            strokes: []
          }
        });
        nodeData.styles.strokeLeftWeight = 0;
      }
      
      // 2. Top stripe
      if (borderTop > 0 && isColorDifferent(topColor, leftColor) && isColorDifferent(topColor, rightColor)) {
        children.unshift({
          type: 'FRAME',
          name: 'border-top-stripe',
          x: 0,
          y: 0,
          width: rect.width,
          height: borderTop,
          styles: {
            backgroundColor: this.rgbaToHex(topColor),
            borderRadius: 0,
            layoutMode: 'NONE',
            strokeWeight: 0,
            strokes: []
          }
        });
        nodeData.styles.strokeTopWeight = 0;
      }

      // 3. Bottom stripe
      if (borderBottom > 0 && isColorDifferent(bottomColor, topColor)) {
        children.unshift({
          type: 'FRAME',
          name: 'border-bottom-stripe',
          x: 0,
          y: rect.height - borderBottom,
          width: rect.width,
          height: borderBottom,
          styles: {
            backgroundColor: this.rgbaToHex(bottomColor),
            borderRadius: 0,
            layoutMode: 'NONE',
            strokeWeight: 0,
            strokes: []
          }
        });
        nodeData.styles.strokeBottomWeight = 0;
      }

      if (children.length > 0) {
        nodeData.children = children;
      }
    }

    return nodeData;
  }

  private rgbaToHex(colorStr: string): string {
    if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return 'transparent';
    
    let rgba = colorStr;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = colorStr;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        rgba = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
      }
    } catch (e) {
      console.warn("Failed to normalize color using canvas:", colorStr, e);
    }

    const parts = rgba.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (!parts) return colorStr;
    
    const r = parseInt(parts[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(parts[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(parts[3], 10).toString(16).padStart(2, '0');
    const a = parts[4] ? Math.round(parseFloat(parts[4]) * 255).toString(16).padStart(2, '0') : '';
    
    return `#${r}${g}${b}${a}`;
  }

  private getSmartNodeName(element: HTMLElement): string {
    const tagName = element.tagName.toLowerCase();
    
    // 1. If it has a specific semantic ID, use it
    const id = element.id;
    if (id && id.trim().length > 0) {
      return `#${id.trim()}`;
    }

    // 2. Process class names to find a semantic one
    const classList = Array.from(element.classList);
    if (classList.length > 0) {
      // Filter out utility classes (especially Tailwind CSS classes)
      const utilityRegex = /^(flex|grid|block|inline|inline-flex|p-|px-|py-|pt-|pr-|pb-|pl-|m-|mx-|my-|mt-|mr-|mb-|ml-|gap-|space-|bg-|text-|rounded-|w-|h-|border-|shadow-|justify-|items-|self-|min-|max-|top-|right-|bottom-|left-|relative|absolute|fixed|overflow-|z-|cursor-|opacity-|transition-|duration-|ease-|select-|pointer-|focus-|hover-)/;
      
      const semanticClass = classList.find(cls => !utilityRegex.test(cls));
      if (semanticClass) {
        return `.${semanticClass}`;
      }
    }

    // 3. Fallback to descriptive semantic tag names capitalized
    const semanticTags = ['header', 'footer', 'nav', 'main', 'aside', 'section', 'article', 'button', 'input', 'img', 'svg', 'a'];
    if (semanticTags.includes(tagName)) {
      return tagName.charAt(0).toUpperCase() + tagName.slice(1);
    }

    // Generic fallback
    return 'Frame';
  }

  private parseRgbaColor(colorStr: string, doc: Document): { r: number, g: number, b: number, a: number } {
    try {
      const canvas = doc.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = colorStr;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return { r: r / 255, g: g / 255, b: b / 255, a: a / 255 };
      }
    } catch (e) {
      console.warn("Failed to parse color via canvas:", colorStr, e);
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  private parseCssGradient(gradientStr: string, doc: Document): any {
    if (!gradientStr || gradientStr === 'none') return null;
    const linearMatch = gradientStr.match(/linear-gradient\((.*)\)/i);
    if (linearMatch) {
      const content = linearMatch[1];
      const parts: string[] = [];
      let currentPart = '';
      let parenCount = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        if (char === '(') parenCount++;
        else if (char === ')') parenCount--;
        
        if (char === ',' && parenCount === 0) {
          parts.push(currentPart.trim());
          currentPart = '';
        } else {
          currentPart += char;
        }
      }
      if (currentPart.trim()) {
        parts.push(currentPart.trim());
      }
      if (parts.length < 2) return null;

      let angleDeg = 180;
      let colorStopsStartIndex = 0;
      const firstPart = parts[0];
      if (firstPart.includes('deg') || firstPart.includes('to ')) {
        colorStopsStartIndex = 1;
        if (firstPart.includes('deg')) {
          const degMatch = firstPart.match(/(-?\d+(?:\.\d+)?)\s*deg/);
          if (degMatch) {
            angleDeg = parseFloat(degMatch[1]);
          }
        } else if (firstPart.includes('to ')) {
          const direction = firstPart.replace(/\s+/g, ' ').toLowerCase();
          if (direction === 'to top') angleDeg = 0;
          else if (direction === 'to right') angleDeg = 90;
          else if (direction === 'to bottom') angleDeg = 180;
          else if (direction === 'to left') angleDeg = 270;
          else if (direction === 'to top right') angleDeg = 45;
          else if (direction === 'to bottom right') angleDeg = 135;
          else if (direction === 'to bottom left') angleDeg = 225;
          else if (direction === 'to top left') angleDeg = 315;
        }
      }

      const stopsRaw = parts.slice(colorStopsStartIndex);
      const gradientStops: any[] = [];
      stopsRaw.forEach((stopStr) => {
        const posMatch = stopStr.match(/(\d+(?:\.\d+)?)\s*%/);
        let position = posMatch ? parseFloat(posMatch[1]) / 100 : null;
        let colorPart = stopStr;
        if (posMatch) {
          colorPart = stopStr.replace(posMatch[0], '').trim();
        }
        const color = this.parseRgbaColor(colorPart, doc);
        gradientStops.push({ position, color });
      });

      for (let i = 0; i < gradientStops.length; i++) {
        if (gradientStops[i].position === null) {
          if (i === 0) {
            gradientStops[i].position = 0;
          } else if (i === gradientStops.length - 1) {
            gradientStops[i].position = 1;
          } else {
            let nextIndex = i + 1;
            while (nextIndex < gradientStops.length && gradientStops[nextIndex].position === null) {
              nextIndex++;
            }
            const nextPos = nextIndex < gradientStops.length ? gradientStops[nextIndex].position : 1;
            const prevPos = gradientStops[i - 1].position;
            const steps = nextIndex - (i - 1);
            gradientStops[i].position = prevPos + (nextPos - prevPos) / steps;
          }
        }
      }

      const rad = (angleDeg * Math.PI) / 180;
      const dx = Math.sin(rad);
      const dy = -Math.cos(rad);
      const sx = 0.5 - dx / 2;
      const sy = 0.5 - dy / 2;
      const ex = 0.5 + dx / 2;
      const ey = 0.5 + dy / 2;

      const a = ex - sx;
      const b = -(ey - sy);
      const c = ey - sy;
      const d = ex - sx;
      const tx = sx - 0.5 * b;
      const ty = sy - 0.5 * d;

      return {
        type: 'GRADIENT_LINEAR',
        gradientTransform: [
          [a, b, tx],
          [c, d, ty]
        ],
        gradientStops: gradientStops.map(s => ({
          position: s.position,
          color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a }
        }))
      };
    }
    return null;
  }
}
