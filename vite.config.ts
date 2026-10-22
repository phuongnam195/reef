import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const BASE = '/reef/';

// Published name -> source file, relative to this config.
const LICENSE_FILES: Record<string, string> = {
  'LICENSE.txt': 'LICENSE',
  'THIRD_PARTY_NOTICES.txt': 'THIRD_PARTY_NOTICES.md',
};

function readSource(file: string): Buffer {
  return readFileSync(fileURLToPath(new URL(file, import.meta.url)));
}

// Ships the license files next to the site so the footer links work, both on
// Pages and on the dev server (which would otherwise fall back to index.html).
function licenseFiles(): Plugin {
  return {
    name: 'reef-license-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.split('?')[0].replace(BASE, '');
        const source = name ? LICENSE_FILES[name] : undefined;
        if (!source) return next();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(readSource(source));
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(LICENSE_FILES)) {
        this.emitFile({ type: 'asset', fileName, source: readSource(source) });
      }
    },
  };
}

// GitHub Pages serves the site under /<repo-name>/.
export default defineConfig({
  base: BASE,
  plugins: [licenseFiles()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
  },
});
