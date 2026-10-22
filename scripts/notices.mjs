// Regenerates THIRD_PARTY_NOTICES.md from the production dependency tree.
// Usage: npm run notices
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const paths = execSync('npm ls --omit=dev --all --parseable', { cwd: root, encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter((p) => p.includes('node_modules'));

const packages = new Map();
for (const dir of paths) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const key = `${pkg.name}@${pkg.version}`;
  if (packages.has(key)) continue;
  const licenseFile = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  const license =
    typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'See package');
  packages.set(key, {
    name: pkg.name,
    version: pkg.version,
    license,
    homepage: pkg.homepage ?? pkg.repository?.url ?? pkg.repository ?? '',
    text: licenseFile ? readFileSync(join(dir, licenseFile), 'utf8').trim() : '',
  });
}

const sorted = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));

const out = [];
out.push('# Third-party notices');
out.push('');
out.push(
  'Reef is MIT-licensed (see `LICENSE`). It bundles the open-source components below; ' +
    'each remains under its own license, reproduced in full further down.',
);
out.push('');
out.push('## Key components');
out.push('');
out.push('| Component | License | Notes |');
out.push('|---|---|---|');
out.push(
  '| mermaid | MIT | Diagram rendering. Reef is not affiliated with Mermaid / Mermaid Chart. |',
);
out.push(
  '| @mermaid-js/layout-elk | MIT | Optional ELK layout, loaded on demand as a separate file. |',
);
out.push(
  '| elkjs | EPL-2.0 | Dependency of layout-elk. Used unmodified; source is available at https://github.com/kieler/elkjs. |',
);
out.push('| CodeMirror 6 (@codemirror/*, @lezer/*) | MIT | Code editor. |');
out.push('| svg-pan-zoom | BSD-2-Clause | Preview pan and zoom. |');
out.push(
  '| Inter, JetBrains Mono (via @fontsource) | SIL OFL 1.1 | Fonts are self-hosted and embedded in SVG exports. |',
);
out.push('');
out.push(`## All bundled packages (${sorted.length})`);
out.push('');
out.push('| Package | Version | License |');
out.push('|---|---|---|');
for (const p of sorted) out.push(`| ${p.name} | ${p.version} | ${p.license} |`);
out.push('');
out.push('## License texts');
for (const p of sorted) {
  out.push('');
  out.push(`### ${p.name}@${p.version} (${p.license})`);
  if (p.homepage) out.push('', String(p.homepage));
  out.push('');
  out.push('```');
  out.push(p.text || `No license file shipped with the package. Declared license: ${p.license}.`);
  out.push('```');
}
out.push('');

writeFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), out.join('\n'));
console.log(`Wrote notices for ${sorted.length} packages.`);
