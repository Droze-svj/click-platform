import { VideoRenderer, FrameData, RenderOptions } from './VideoRenderer';

export class WebGPURenderer implements VideoRenderer {
  private worker: Worker | null = null;
  private canvasReady = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        // We use a relative path or bundled worker here.
        // Assuming Next.js, a standard worker import or public path:
        this.worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' });
      } catch (e) {
        console.warn('Could not launch WebGPU render worker:', e);
      }
    }
  }

  async init(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<void> {
    if (!this.worker) return;

    return new Promise((resolve) => {
      this.worker!.onmessage = (e) => {
        if (e.data.type === 'INIT_SUCCESS') {
          this.canvasReady = true;
          resolve();
        }
      };

      // Transfer the OffscreenCanvas control to the worker
      if (canvas instanceof OffscreenCanvas) {
        this.worker!.postMessage({ type: 'INIT', canvas }, [canvas]);
      } else if (canvas.transferControlToOffscreen) {
        const offscreen = canvas.transferControlToOffscreen();
        this.worker!.postMessage({ type: 'INIT', canvas: offscreen }, [offscreen]);
      } else {
        console.warn('OffscreenCanvas not supported in this environment');
        resolve(); // Fallback mode
      }
    });
  }

  drawFrame(frameData: FrameData, options?: RenderOptions): void {
    if (!this.worker || !this.canvasReady) return;

    if (frameData.videoFrame) {
      this.worker.postMessage({
        type: 'DRAW_FRAME',
        frame: frameData.videoFrame,
        options
      }, [frameData.videoFrame]);
    }
  }

  resize(width: number, height: number): void {
    if (!this.worker || !this.canvasReady) return;
    this.worker.postMessage({ type: 'RESIZE', width, height });
  }

  dispose(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'DISPOSE' });
      this.worker.terminate();
      this.worker = null;
    }
  }
}
