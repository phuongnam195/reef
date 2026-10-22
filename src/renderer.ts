import mermaid, { type MermaidConfig } from 'mermaid';
import type { AppTheme, ParticipantColor } from './themes';

export type LayoutEngine = 'dagre' | 'elk';

export interface RenderError {
  message: string;
  /** 1-based line number, when the parser reports one. */
  line?: number;
}

let counter = 0;
let elkRegistered: Promise<void> | null = null;

// ELK is lazy-loaded into its own chunk so the default experience never pays for it.
function ensureElk(): Promise<void> {
  elkRegistered ??= import('@mermaid-js/layout-elk')
    .then(({ default: elkLayouts }) => {
      mermaid.registerLayoutLoaders(elkLayouts);
    })
    .catch((err) => {
      elkRegistered = null;
      throw err;
    });
  return elkRegistered;
}

export interface RenderOptions {
  /**
   * Draw labels as plain SVG text instead of HTML in foreignObject. Only needed
   * when a browser refuses to export a canvas that drew HTML labels.
   */
  svgLabels?: boolean;
}

function buildConfig(
  theme: AppTheme,
  layout: LayoutEngine,
  { svgLabels = false }: RenderOptions,
): MermaidConfig {
  const htmlLabels = !svgLabels;
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme.mermaid.theme,
    look: theme.mermaid.look ?? 'classic',
    themeVariables: theme.mermaid.themeVariables,
    // Monospace themes would otherwise turn `>=` or `->` into ligature glyphs.
    themeCSS: `* { font-variant-ligatures: none; }\n${theme.mermaid.themeCSS ?? ''}`,
    fontFamily: String(theme.mermaid.themeVariables.fontFamily ?? ''),
    layout,
    // HTML labels wrap and escape text the same way Mermaid Live does; the
    // SVG-text path drops characters such as `>` from labels.
    htmlLabels,
    flowchart: {
      htmlLabels,
      curve: theme.mermaid.curve ?? 'step',
      padding: 14,
      nodeSpacing: 48,
      rankSpacing: 56,
    },
    class: { htmlLabels },
    markdownAutoWrap: true,
  };
}

type Point = [number, number];

/** Rewrites a straight-segment path (M/L only) so each corner gets a small arc. */
function roundCorners(d: string, radius: number): string | null {
  const commands = d.trim().match(/[A-Za-z][^A-Za-z]*/g);
  if (!commands || commands.some((c) => !/^[ML]/.test(c))) return null;
  const points: Point[] = [];
  for (const c of commands) {
    const [x, y] = c
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const prev = points[points.length - 1];
    if (!prev || Math.hypot(x - prev[0], y - prev[1]) > 0.01) points.push([x, y]);
  }
  if (points.length < 3) return null;

  const fmt = (p: Point) => `${+p[0].toFixed(2)},${+p[1].toFixed(2)}`;
  let out = `M${fmt(points[0])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [p0, p1, p2] = [points[i - 1], points[i], points[i + 1]];
    const d1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const r = Math.min(radius, d1 / 2, d2 / 2);
    const a: Point = [p1[0] - ((p1[0] - p0[0]) / d1) * r, p1[1] - ((p1[1] - p0[1]) / d1) * r];
    const b: Point = [p1[0] + ((p2[0] - p1[0]) / d2) * r, p1[1] + ((p2[1] - p1[1]) / d2) * r];
    out += `L${fmt(a)}Q${fmt(p1)} ${fmt(b)}`;
  }
  return `${out}L${fmt(points[points.length - 1])}`;
}

// Mermaid's step curve draws sharp right angles; soften them like a hand-tuned diagram.
function softenEdges(root: SVGSVGElement): void {
  for (const path of root.querySelectorAll<SVGPathElement>('path.flowchart-link')) {
    const rounded = roundCorners(path.getAttribute('d') ?? '', 8);
    if (rounded) path.setAttribute('d', rounded);
  }
}

// Mermaid only varies participant colours in its redux-color themes; give every
// theme with a palette the same left-to-right colour coding.
function colorParticipants(root: SVGSVGElement, palette: ParticipantColor[]): void {
  const lifelines = [...root.querySelectorAll<SVGLineElement>('line.actor-line[name]')].sort(
    (a, b) => Number(a.getAttribute('x1')) - Number(b.getAttribute('x1')),
  );
  lifelines.forEach((line, i) => {
    const { fill, stroke } = palette[i % palette.length];
    const name = CSS.escape(line.getAttribute('name') ?? '');
    for (const rect of root.querySelectorAll<SVGRectElement>(`rect.actor[name="${name}"]`)) {
      rect.style.fill = fill;
      rect.style.stroke = stroke;
    }
    for (const man of root.querySelectorAll<SVGGElement>(`g.actor-man[name="${name}"]`)) {
      man.style.stroke = stroke;
      man.querySelector('circle')?.style.setProperty('fill', fill);
    }
  });
}

function postProcess(svg: string, theme: AppTheme): string {
  const palette = theme.participants;
  const hasEdges = svg.includes('flowchart-link');
  const hasActors = !!palette?.length && svg.includes('actor-line');
  if (!hasEdges && !hasActors) return svg;

  const template = document.createElement('template');
  template.innerHTML = svg;
  const root = template.content.querySelector('svg');
  if (!root) return svg;
  if (hasEdges) softenEdges(root);
  if (hasActors) colorParticipants(root, palette!);
  return root.outerHTML;
}

function toRenderError(err: unknown): RenderError {
  const e = err as {
    message?: string;
    str?: string;
    hash?: { line?: number; loc?: { first_line?: number } };
  };
  const message = (e?.message || e?.str || String(err)).trim();
  let line = e?.hash?.loc?.first_line ?? (e?.hash?.line != null ? e.hash.line + 1 : undefined);
  if (line == null) {
    const match = /line (\d+)/i.exec(message);
    if (match) line = Number(match[1]);
  }
  return { message, line };
}

// Mermaid's config is global, so renders must not interleave.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Renders the code with the given theme. Mermaid is re-initialised before
 * every render. Rejects with a RenderError on failure.
 */
export function renderDiagram(
  code: string,
  theme: AppTheme,
  layout: LayoutEngine,
  options: RenderOptions = {},
): Promise<string> {
  const run = queue.then(() => renderNow(code, theme, layout, options));
  queue = run.catch(() => undefined);
  return run;
}

async function renderNow(
  code: string,
  theme: AppTheme,
  layout: LayoutEngine,
  options: RenderOptions,
): Promise<string> {
  if (layout === 'elk') await ensureElk();
  mermaid.initialize(buildConfig(theme, layout, options));

  try {
    await mermaid.parse(code);
  } catch (err) {
    throw toRenderError(err);
  }

  // A fresh id per render keeps leftovers from failed renders from colliding.
  const id = `reef-svg-${++counter}`;
  try {
    const { svg } = await mermaid.render(id, code);
    return postProcess(svg, theme);
  } catch (err) {
    throw toRenderError(err);
  } finally {
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
  }
}
