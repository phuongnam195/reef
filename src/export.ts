import { buildEmbeddedFontCss } from './fonts';
import type { AppTheme } from './themes';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Safari refuses canvases above ~16.7 MP, so larger PNGs are scaled down to fit.
const MAX_CANVAS_PIXELS = 16_777_216;
const MAX_CANVAS_SIDE = 16_384;

export interface ExportOptions {
  transparent: boolean;
}

export interface PreparedSvg {
  markup: string;
  width: number;
  height: number;
}

function readViewBox(svg: SVGSVGElement): [number, number, number, number] {
  const vb = svg
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (vb && vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) {
    return vb as [number, number, number, number];
  }
  const width = parseFloat(svg.getAttribute('width') ?? '') || 800;
  const height = parseFloat(svg.getAttribute('height') ?? '') || 600;
  return [0, 0, width, height];
}

/**
 * Turns the rendered Mermaid SVG into a standalone file: explicit size,
 * padding, a background rect and embedded fonts.
 */
export async function prepareSvg(
  rendered: string,
  theme: AppTheme,
  { transparent }: ExportOptions,
): Promise<PreparedSvg> {
  // The HTML parser tolerates any non-XML bits Mermaid may emit; XMLSerializer
  // then writes well-formed XML back out.
  const template = document.createElement('template');
  template.innerHTML = rendered;
  const svg = template.content.querySelector('svg');
  if (!svg) throw new Error('Nothing to export yet.');

  const pad = theme.canvas.padding;
  const [x, y, w, h] = readViewBox(svg);
  const vx = x - pad;
  const vy = y - pad;
  const width = Math.ceil(w + pad * 2);
  const height = Math.ceil(h + pad * 2);

  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svg.setAttribute('viewBox', `${vx} ${vy} ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.removeAttribute('style');

  if (!transparent) {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(vx));
    rect.setAttribute('y', String(vy));
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    rect.setAttribute('fill', theme.canvas.background);
    svg.insertBefore(rect, svg.firstChild);
  }

  const fontCss = await buildEmbeddedFontCss(rendered, svg.textContent ?? '');
  if (fontCss) {
    const style = document.createElementNS(SVG_NS, 'style');
    style.textContent = fontCss;
    svg.insertBefore(style, svg.firstChild);
  }

  const markup = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
  return { markup, width, height };
}

export function svgBlob(prepared: PreparedSvg): Blob {
  return new Blob([prepared.markup], { type: 'image/svg+xml;charset=utf-8' });
}

export interface PngResult {
  blob: Blob;
  /** The scale actually used; lower than requested when the canvas would be too large. */
  scale: number;
}

export async function renderPng(prepared: PreparedSvg, requestedScale: number): Promise<PngResult> {
  const { width, height } = prepared;
  const maxByArea = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
  const maxBySide = MAX_CANVAS_SIDE / Math.max(width, height);
  const scale = Math.min(requestedScale, maxByArea, maxBySide);

  const img = new Image();
  img.decoding = 'sync';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(prepared.markup)}`;
  await img.decode();
  // Safari can report the image decoded before its embedded fonts are applied.
  await new Promise((resolve) => setTimeout(resolve, 50));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The browser could not encode the PNG.');
  return { blob, scale };
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canCopyImage(): boolean {
  return typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
}

/**
 * Copies a PNG to the clipboard. The ClipboardItem is created synchronously with
 * a pending blob so Safari still treats the write as part of the user's click.
 */
export function copyPng(pngBlob: Promise<Blob>): Promise<void> {
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
}

export function exportFilename(code: string, ext: 'svg' | 'png'): string {
  const firstLine = code
    .replace(/^\s*---[\s\S]*?\n---\s*\n/, '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('%%') && l !== '---');
  const kind =
    firstLine
      ?.split(/\s+/)[0]
      ?.replace(/[^\w-]/g, '')
      .toLowerCase() || 'diagram';
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return `reef-${kind}-${stamp}.${ext}`;
}
