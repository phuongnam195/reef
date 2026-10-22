// UI fonts. Fontsource ships the files with the bundle, so no request ever leaves the site.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';

import interLatin400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import interLatin700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import interLatinExt400 from '@fontsource/inter/files/inter-latin-ext-400-normal.woff2?url';
import interLatinExt700 from '@fontsource/inter/files/inter-latin-ext-700-normal.woff2?url';
import interViet400 from '@fontsource/inter/files/inter-vietnamese-400-normal.woff2?url';
import interViet700 from '@fontsource/inter/files/inter-vietnamese-700-normal.woff2?url';
import monoLatin400 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url';
import monoLatin700 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2?url';
import monoLatinExt400 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-400-normal.woff2?url';
import monoLatinExt700 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-ext-700-normal.woff2?url';
import monoViet400 from '@fontsource/jetbrains-mono/files/jetbrains-mono-vietnamese-400-normal.woff2?url';
import monoViet700 from '@fontsource/jetbrains-mono/files/jetbrains-mono-vietnamese-700-normal.woff2?url';

type Subset = 'latin' | 'latin-ext' | 'vietnamese';

// Unicode ranges copied from the Fontsource stylesheets.
const RANGES: Record<Subset, string> = {
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext':
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  vietnamese:
    'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
};

interface FontFile {
  family: 'Inter' | 'JetBrains Mono';
  weight: 400 | 700;
  subset: Subset;
  url: string;
}

const FILES: FontFile[] = [
  { family: 'Inter', weight: 400, subset: 'latin', url: interLatin400 },
  { family: 'Inter', weight: 700, subset: 'latin', url: interLatin700 },
  { family: 'Inter', weight: 400, subset: 'latin-ext', url: interLatinExt400 },
  { family: 'Inter', weight: 700, subset: 'latin-ext', url: interLatinExt700 },
  { family: 'Inter', weight: 400, subset: 'vietnamese', url: interViet400 },
  { family: 'Inter', weight: 700, subset: 'vietnamese', url: interViet700 },
  { family: 'JetBrains Mono', weight: 400, subset: 'latin', url: monoLatin400 },
  { family: 'JetBrains Mono', weight: 700, subset: 'latin', url: monoLatin700 },
  { family: 'JetBrains Mono', weight: 400, subset: 'latin-ext', url: monoLatinExt400 },
  { family: 'JetBrains Mono', weight: 700, subset: 'latin-ext', url: monoLatinExt700 },
  { family: 'JetBrains Mono', weight: 400, subset: 'vietnamese', url: monoViet400 },
  { family: 'JetBrains Mono', weight: 700, subset: 'vietnamese', url: monoViet700 },
];

function parseRanges(ranges: string): [number, number][] {
  return ranges.split(',').map((r) => {
    const [a, b] = r.replace('U+', '').split('-');
    const start = parseInt(a, 16);
    return [start, b ? parseInt(b, 16) : start];
  });
}

const PARSED = Object.fromEntries(
  Object.entries(RANGES).map(([k, v]) => [k, parseRanges(v)]),
) as Record<Subset, [number, number][]>;

function subsetsFor(text: string): Set<Subset> {
  const needed = new Set<Subset>(['latin']);
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x100) continue;
    for (const subset of ['latin-ext', 'vietnamese'] as const) {
      if (PARSED[subset].some(([lo, hi]) => cp >= lo && cp <= hi)) needed.add(subset);
    }
  }
  return needed;
}

const dataUrlCache = new Map<string, Promise<string>>();

function toDataUrl(url: string): Promise<string> {
  let cached = dataUrlCache.get(url);
  if (!cached) {
    cached = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Font request failed: ${res.status}`);
        return res.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(new Blob([blob], { type: 'font/woff2' }));
          }),
      );
    dataUrlCache.set(url, cached);
    cached.catch(() => dataUrlCache.delete(url));
  }
  return cached;
}

/**
 * Builds `@font-face` rules with base64-embedded fonts for the families and
 * character subsets a diagram actually uses, so exports render the same anywhere.
 */
export async function buildEmbeddedFontCss(svgMarkup: string, text: string): Promise<string> {
  const families = new Set<string>();
  if (svgMarkup.includes('Inter')) families.add('Inter');
  if (svgMarkup.includes('JetBrains Mono')) families.add('JetBrains Mono');
  if (families.size === 0) return '';

  const subsets = subsetsFor(text);
  const files = FILES.filter((f) => families.has(f.family) && subsets.has(f.subset));
  const rules = await Promise.all(
    files.map(
      async (f) =>
        `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};` +
        `src:url(${await toDataUrl(f.url)}) format("woff2");unicode-range:${RANGES[f.subset]};}`,
    ),
  );
  return rules.join('\n');
}

/** Resolves once the diagram fonts are usable for text measurement. */
export function fontsReady(): Promise<unknown> {
  return Promise.all([
    document.fonts.load('400 16px "Inter"'),
    document.fonts.load('700 16px "Inter"'),
    document.fonts.load('400 16px "JetBrains Mono"'),
    document.fonts.load('700 16px "JetBrains Mono"'),
  ]).catch(() => undefined);
}
