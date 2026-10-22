# Reef

A static, client-side studio for turning Mermaid code into polished diagrams. Type on the left, see a live preview on the right, pick one of five themes and export SVG or PNG. Everything runs in the browser: no backend, no analytics, no cookies, no third-party requests.

<img width="1511" height="817" alt="image" src="https://github.com/user-attachments/assets/e194ec07-15dc-4809-836b-2136af6928b6" />

## Features

- **Editor**: CodeMirror 6 with lightweight Mermaid highlighting, autosave to `localStorage`, and seven examples (flowchart, sequence, class, state, ER, Gantt, pie).
- **Live render**: 300 ms debounce. On a syntax error the message appears under the editor, the offending line is highlighted and the last valid diagram stays on screen.
- **Themes**: Clean Light, Spectrum (Mermaid's `redux-color` preset with the `neo` look), Midnight, Pastel, Blueprint and Sketch (hand-drawn look). Sequence-diagram participants get a distinct colour each. The preview background matches the export.
- **Layouts**: Dagre by default, ELK on demand (loaded as a separate chunk only when selected).
- **Preview**: pan and zoom, Fit, actual size (100%).
- **Export**:
  - SVG with padding, background rect and base64-embedded fonts (only the subsets the diagram uses, including Vietnamese).
  - PNG at 1×, 2× or 3×, optionally transparent; scaled down automatically if the canvas would exceed browser limits.
  - Copy PNG to the clipboard.
- **Shortcuts**: `Ctrl/⌘ + S` downloads PNG, `Ctrl/⌘ + Shift + S` downloads SVG.

## Development

```bash
npm install
npm run dev        # http://localhost:5173/reef/
npm run lint
npm run build      # type-check + static build into dist/
npm run notices    # regenerate THIRD_PARTY_NOTICES.md after dependency changes
```

## Deployment

`.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist/` with `actions/deploy-pages`. In the repository settings, set **Pages → Source** to **GitHub Actions**.

`vite.config.ts` sets `base: '/reef/'`; change it if the repository is renamed.

> GitHub Pages on a **private** repository requires a paid GitHub plan (Pro, Team or Enterprise). On a free plan, either make the repository public or host `dist/` elsewhere.

## Notes

- Labels use HTML (`htmlLabels: true`), like Mermaid Live, so wrapping, markdown and characters such as `>` behave the same. If a browser refuses to export a canvas that drew HTML labels, the PNG is re-rendered with plain SVG text labels. Flowchart edges use the `step` curve with softened corners.
- `@mermaid-js/layout-elk` ships its own copy of some Mermaid internals, so the ELK chunk is large. It only loads when ELK is selected.

## License

MIT, see [LICENSE](LICENSE). Bundled components keep their own licenses, listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); elkjs is EPL-2.0 and is used unmodified.

Powered by Mermaid. Not affiliated with Mermaid / Mermaid Chart.
