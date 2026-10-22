import { fontsReady } from './fonts';
import './style.css';
import { createEditor } from './editor';
import { DEFAULT_CODE, EXAMPLES } from './examples';
import {
  canCopyImage,
  copyPng,
  download,
  exportFilename,
  prepareSvg,
  renderPng,
  svgBlob,
} from './export';
import { Preview } from './preview';
import { renderDiagram, type LayoutEngine, type RenderError } from './renderer';
import { load, save } from './storage';
import { getTheme, THEMES, type AppTheme } from './themes';

const RENDER_DEBOUNCE_MS = 300;

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const els = {
  workspace: $('workspace'),
  editor: $('editor'),
  preview: $('preview'),
  status: $('status'),
  error: $('error'),
  errorLine: $('error-line'),
  errorMessage: $('error-message'),
  emptyState: $('empty-state'),
  loading: $('loading'),
  busy: $('busy'),
  zoomLevel: $('zoom-level'),
  exampleSelect: $<HTMLSelectElement>('example-select'),
  themeSelect: $<HTMLSelectElement>('theme-select'),
  themeSwatch: $('theme-swatch'),
  layoutSelect: $<HTMLSelectElement>('layout-select'),
  transparent: $<HTMLInputElement>('transparent-toggle'),
  exportSvg: $<HTMLButtonElement>('export-svg'),
  exportPng: $<HTMLButtonElement>('export-png'),
  copyPng: $<HTMLButtonElement>('copy-png'),
  resizer: $('resizer'),
  toast: $('toast'),
};

// ---- State ---------------------------------------------------------------

let theme: AppTheme = getTheme(load('theme'));
let layout: LayoutEngine = load('layout') === 'elk' ? 'elk' : 'dagre';
let scale = Number(load('scale')) || 2;
let transparent = load('transparent') === '1';

/** The last SVG that rendered successfully, and the theme it was rendered with. */
let lastSvg: string | null = null;
let lastTheme: AppTheme = theme;
let fitOnNextRender = false;

// ---- Toast ---------------------------------------------------------------

let toastTimer: number | undefined;
function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  els.toast.textContent = message;
  els.toast.classList.toggle('toast-error', kind === 'error');
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (els.toast.hidden = true), kind === 'error' ? 5000 : 2400);
}

// ---- Preview and editor ----------------------------------------------------

const preview = new Preview(els.preview, (percent) => {
  els.zoomLevel.textContent = `${percent}%`;
});
preview.setBackground(theme.canvas.background);

const editor = createEditor(els.editor, load('code') ?? DEFAULT_CODE, (code) => {
  save('code', code);
  scheduleRender();
});

function setStatus(kind: 'ok' | 'error' | 'busy', text: string): void {
  els.status.className = `status status-${kind}`;
  els.status.textContent = text;
}

function showError(err: RenderError): void {
  els.error.hidden = false;
  els.errorMessage.textContent = err.message;
  els.errorLine.textContent = err.line ? ` on line ${err.line}` : '';
  editor.markErrorLine(err.line ?? null);
  setStatus('error', 'Error');
}

function clearError(): void {
  els.error.hidden = true;
  editor.markErrorLine(null);
  setStatus('ok', 'Rendered');
}

// ---- Rendering -------------------------------------------------------------

let renderTimer: number | undefined;
let renderSeq = 0;
let renderQueue: Promise<void> = Promise.resolve();
let firstRender = true;

function scheduleRender(delay = RENDER_DEBOUNCE_MS): void {
  clearTimeout(renderTimer);
  renderTimer = window.setTimeout(runRender, delay);
}

// Renders run one at a time because Mermaid's config is global; a render that
// has been superseded by newer input is skipped or its result dropped.
function runRender(): void {
  const seq = ++renderSeq;
  renderQueue = renderQueue.then(async () => {
    if (seq !== renderSeq) return;
    const code = editor.getCode();
    const renderTheme = theme;

    if (!code.trim()) {
      lastSvg = null;
      preview.clear();
      preview.setBackground(renderTheme.canvas.background);
      els.emptyState.hidden = false;
      els.error.hidden = true;
      editor.markErrorLine(null);
      setStatus('ok', 'Empty');
      finishFirstRender();
      return;
    }

    const busyTimer = window.setTimeout(() => {
      els.busy.hidden = false;
      setStatus('busy', 'Rendering…');
    }, 150);
    try {
      const svg = await renderDiagram(code, renderTheme, layout);
      if (seq !== renderSeq) return;
      lastSvg = svg;
      lastTheme = renderTheme;
      els.emptyState.hidden = true;
      preview.setBackground(renderTheme.canvas.background);
      preview.show(svg);
      if (fitOnNextRender) {
        fitOnNextRender = false;
        preview.fit();
      }
      clearError();
    } catch (err) {
      if (seq !== renderSeq) return;
      showError(err as RenderError);
    } finally {
      clearTimeout(busyTimer);
      els.busy.hidden = true;
      finishFirstRender();
    }
  });
}

function finishFirstRender(): void {
  if (!firstRender) return;
  firstRender = false;
  els.loading.hidden = true;
}

// ---- Toolbar controls ------------------------------------------------------

for (const example of EXAMPLES) {
  els.exampleSelect.add(new Option(example.name, example.id));
}
els.exampleSelect.addEventListener('change', () => {
  const example = EXAMPLES.find((e) => e.id === els.exampleSelect.value);
  els.exampleSelect.value = '';
  if (!example) return;
  const current = editor.getCode();
  const isUntouched = !current.trim() || EXAMPLES.some((e) => e.code === current);
  if (!isUntouched && !confirm('Replace the current code with this example?')) return;
  fitOnNextRender = true;
  editor.setCode(example.code);
  scheduleRender(0);
});

for (const t of THEMES) els.themeSelect.add(new Option(t.name, t.id));
function syncThemeControls(): void {
  els.themeSelect.value = theme.id;
  const [bg, fg] = theme.swatch;
  els.themeSwatch.style.background = `linear-gradient(135deg, ${bg} 50%, ${fg} 50%)`;
}
syncThemeControls();
els.themeSelect.addEventListener('change', () => {
  theme = getTheme(els.themeSelect.value);
  save('theme', theme.id);
  syncThemeControls();
  fitOnNextRender = true;
  scheduleRender(0);
});

els.layoutSelect.value = layout;
els.layoutSelect.addEventListener('change', () => {
  layout = els.layoutSelect.value === 'elk' ? 'elk' : 'dagre';
  save('layout', layout);
  fitOnNextRender = true;
  scheduleRender(0);
});

const scaleInputs = document.querySelectorAll<HTMLInputElement>('input[name="scale"]');
for (const input of scaleInputs) {
  input.checked = Number(input.value) === scale;
  input.addEventListener('change', () => {
    scale = Number(input.value);
    save('scale', String(scale));
  });
}

els.transparent.checked = transparent;
els.transparent.addEventListener('change', () => {
  transparent = els.transparent.checked;
  save('transparent', transparent ? '1' : '0');
});

// ---- Export ----------------------------------------------------------------

function requireSvg(): string | null {
  if (!lastSvg) {
    toast('Nothing to export yet.', 'error');
    return null;
  }
  if (!els.error.hidden) toast('The code has errors. Exporting the last valid diagram.');
  return lastSvg;
}

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/tainted|insecure/i.test(message)) {
    return 'This diagram uses HTML labels that cannot be drawn to PNG. Try SVG instead.';
  }
  return message || 'Export failed.';
}

async function exportSvgFile(): Promise<void> {
  const svg = requireSvg();
  if (!svg) return;
  try {
    const prepared = await prepareSvg(svg, lastTheme, { transparent });
    download(svgBlob(prepared), exportFilename(editor.getCode(), 'svg'));
  } catch (err) {
    toast(describeError(err), 'error');
  }
}

async function exportPngFile(): Promise<void> {
  const svg = requireSvg();
  if (!svg) return;
  try {
    const prepared = await prepareSvg(svg, lastTheme, { transparent });
    const result = await renderPng(prepared, scale);
    download(result.blob, exportFilename(editor.getCode(), 'png'));
    if (result.scale < scale - 0.01) {
      toast(`Diagram is large, so the PNG was exported at ${result.scale.toFixed(2)}×.`);
    }
  } catch (err) {
    toast(describeError(err), 'error');
  }
}

function copyPngToClipboard(): void {
  const svg = requireSvg();
  if (!svg) return;
  const blob = prepareSvg(svg, lastTheme, { transparent })
    .then((prepared) => renderPng(prepared, scale))
    .then((result) => result.blob);
  copyPng(blob)
    .then(() => toast('PNG copied to clipboard.'))
    .catch((err) => toast(describeError(err), 'error'));
}

els.exportSvg.addEventListener('click', exportSvgFile);
els.exportPng.addEventListener('click', exportPngFile);
if (canCopyImage()) {
  els.copyPng.addEventListener('click', copyPngToClipboard);
} else {
  els.copyPng.disabled = true;
  els.copyPng.title = 'Copying images is not supported in this browser';
}

// ---- Zoom ------------------------------------------------------------------

$('zoom-in').addEventListener('click', () => preview.zoomBy(1.25));
$('zoom-out').addEventListener('click', () => preview.zoomBy(0.8));
$('zoom-fit').addEventListener('click', () => preview.fit());
$('zoom-actual').addEventListener('click', () => preview.actualSize());

// ---- Keyboard shortcuts ------------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 's') return;
  e.preventDefault();
  if (e.shiftKey) void exportSvgFile();
  else void exportPngFile();
});

// ---- Resizable split -------------------------------------------------------

function setEditorWidth(percent: number): number {
  const clamped = Math.min(80, Math.max(20, percent));
  els.workspace.style.setProperty('--editor-width', `${clamped}%`);
  els.resizer.setAttribute('aria-valuenow', String(Math.round(clamped)));
  return clamped;
}

let editorWidth = setEditorWidth(Number(load('split')) || 40);

els.resizer.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  els.resizer.setPointerCapture(e.pointerId);
  els.resizer.classList.add('dragging');
  const bounds = els.workspace.getBoundingClientRect();
  const onMove = (ev: PointerEvent) => {
    editorWidth = setEditorWidth(((ev.clientX - bounds.left) / bounds.width) * 100);
  };
  const onUp = () => {
    els.resizer.classList.remove('dragging');
    els.resizer.removeEventListener('pointermove', onMove);
    els.resizer.removeEventListener('pointerup', onUp);
    els.resizer.removeEventListener('pointercancel', onUp);
    save('split', String(Math.round(editorWidth)));
  };
  els.resizer.addEventListener('pointermove', onMove);
  els.resizer.addEventListener('pointerup', onUp);
  els.resizer.addEventListener('pointercancel', onUp);
});

els.resizer.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 10 : 2;
  if (e.key === 'ArrowLeft') editorWidth = setEditorWidth(editorWidth - step);
  else if (e.key === 'ArrowRight') editorWidth = setEditorWidth(editorWidth + step);
  else return;
  e.preventDefault();
  save('split', String(Math.round(editorWidth)));
});

// ---- Start -----------------------------------------------------------------

// Mermaid measures text while laying out, so the fonts must be ready first.
void fontsReady().then(() => scheduleRender(0));
