export interface FrameData {
  videoFrame?: VideoFrame | null;
  timestamp: number;
}

export interface RenderOptions {
  filters?: any[];
  quality?: 'high' | 'medium' | 'low';
  width?: number;
  height?: number;
  transform?: any;
  crop?: any;
}

export interface VideoRenderer {
  /**
   * Initialize the renderer with an offscreen canvas.
   */
  init(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<void>;

  /**
   * Draw a frame to the canvas.
   */
  drawFrame(frameData: FrameData, options?: RenderOptions): void;

  /**
   * Resize the output canvas/viewport.
   */
  resize(width: number, height: number): void;

  /**
   * Cleanup resources.
   */
  dispose(): void;
}
