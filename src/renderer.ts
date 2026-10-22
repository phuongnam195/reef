import mermaid, { type MermaidConfig } from 'mermaid';
import type { AppTheme } from './themes';

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

function buildConfig(theme: AppTheme, layout: LayoutEngine): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme.mermaid.theme,
    look: theme.mermaid.look ?? 'classic',
    themeVariables: theme.mermaid.themeVariables,
    themeCSS: theme.mermaid.themeCSS,
    fontFamily: String(theme.mermaid.themeVariables.fontFamily ?? ''),
    layout,
    // foreignObject labels taint the canvas during PNG export, so labels stay pure SVG.
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    class: { htmlLabels: false },
    markdownAutoWrap: true,
  };
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

/**
 * Renders the code with the given theme. Mermaid's config is global, so it is
 * re-initialised before every render. Rejects with a RenderError on failure.
 */
export async function renderDiagram(
  code: string,
  theme: AppTheme,
  layout: LayoutEngine,
): Promise<string> {
  if (layout === 'elk') await ensureElk();
  mermaid.initialize(buildConfig(theme, layout));

  try {
    await mermaid.parse(code);
  } catch (err) {
    throw toRenderError(err);
  }

  // A fresh id per render keeps leftovers from failed renders from colliding.
  const id = `reef-svg-${++counter}`;
  try {
    const { svg } = await mermaid.render(id, code);
    return svg;
  } catch (err) {
    throw toRenderError(err);
  } finally {
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
  }
}
