import svgPanZoom from 'svg-pan-zoom';

/** Shows the rendered SVG with pan and zoom, keeping the view stable across re-renders. */
export class Preview {
  private pz: SvgPanZoom.Instance | null = null;
  // Once the user pans or zooms, re-renders keep their view instead of re-fitting.
  private userMoved = false;
  private markup = '';

  constructor(
    private readonly host: HTMLElement,
    private readonly onZoomChange: (percent: number) => void,
  ) {
    new ResizeObserver(() => this.handleResize()).observe(host);
    const markMoved = () => {
      if (this.pz) this.userMoved = true;
    };
    host.addEventListener('wheel', markMoved, { passive: true });
    host.addEventListener('pointerdown', markMoved);
    host.addEventListener('dblclick', markMoved);
  }

  setBackground(color: string): void {
    this.host.style.background = color;
  }

  show(svgMarkup: string): void {
    const previous =
      this.pz && this.userMoved ? { zoom: this.pz.getZoom(), pan: this.pz.getPan() } : null;
    this.destroy();

    this.markup = svgMarkup;
    this.host.innerHTML = svgMarkup;
    const svg = this.host.querySelector('svg');
    if (!svg) return;
    svg.removeAttribute('style');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    if (this.host.clientWidth === 0 || this.host.clientHeight === 0) return;

    this.pz = svgPanZoom(svg, {
      fit: true,
      center: true,
      minZoom: 0.05,
      maxZoom: 40,
      zoomScaleSensitivity: 0.25,
      dblClickZoomEnabled: true,
      controlIconsEnabled: false,
      onZoom: () => this.reportZoom(),
    });

    if (previous) {
      this.pz.zoom(previous.zoom);
      this.pz.pan(previous.pan);
    }
    this.reportZoom();
  }

  fit(): void {
    if (!this.pz) return;
    this.userMoved = false;
    this.pz.resize();
    this.pz.fit();
    this.pz.center();
    this.reportZoom();
  }

  /** Shows the diagram at its natural size (1 SVG unit = 1 CSS pixel). */
  actualSize(): void {
    if (!this.pz) return;
    this.userMoved = true;
    const { realZoom } = this.pz.getSizes();
    this.pz.zoom(this.pz.getZoom() / realZoom);
    this.pz.center();
    this.reportZoom();
  }

  zoomBy(factor: number): void {
    if (!this.pz) return;
    this.userMoved = true;
    this.pz.zoomBy(factor);
  }

  clear(): void {
    this.destroy();
    this.markup = '';
    this.host.innerHTML = '';
  }

  private destroy(): void {
    this.pz?.destroy();
    this.pz = null;
  }

  private handleResize(): void {
    if (!this.pz) {
      // The first render may have happened while the host had no size.
      if (this.markup && this.host.clientWidth > 0) this.show(this.markup);
      return;
    }
    this.pz.resize();
    if (!this.userMoved) {
      this.pz.fit();
      this.pz.center();
    }
    this.reportZoom();
  }

  private reportZoom(): void {
    if (this.pz) this.onZoomChange(Math.round(this.pz.getSizes().realZoom * 100));
  }
}
