import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// Ships the license files next to the site so the footer links work on Pages.
function licenseFiles(): Plugin {
  return {
    name: 'reef-license-files',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'LICENSE.txt', source: readFileSync('LICENSE') });
      this.emitFile({
        type: 'asset',
        fileName: 'THIRD_PARTY_NOTICES.txt',
        source: readFileSync('THIRD_PARTY_NOTICES.md'),
      });
    },
  };
}

// GitHub Pages serves the site under /<repo-name>/.
export default defineConfig({
  base: '/reef/',
  plugins: [licenseFiles()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
  },
});
