/// <reference lib="webworker" />
/// <reference types="@webgpu/types" />

declare const self: DedicatedWorkerGlobalScope;

let canvas: OffscreenCanvas | null = null;
let device: GPUDevice | null = null;
let context: GPUCanvasContext | null = null;

async function initWebGPU(offscreenCanvas: OffscreenCanvas) {
  canvas = offscreenCanvas;

  if (!navigator.gpu) {
    console.warn("WebGPU not supported on this browser.");
    return false;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.warn("No appropriate GPU adapter found.");
    return false;
  }

  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu') as GPUCanvasContext;

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'premultiplied'
  });

  return true;
}

function renderFrame(frame: VideoFrame, options: any) {
  if (!device || !context || !canvas) {
    frame.close();
    return;
  }

  // TODO: Build actual WebGPU command buffer, shader module, and render pipeline.
  // For V6 Phase 1 foundational mock, we clear the buffer and use the frame as a texture.

  const commandEncoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: textureView,
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: 'clear' as GPULoadOp,
        storeOp: 'store' as GPUStoreOp,
      },
    ],
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  // Drawing commands would go here (binding video texture).
  passEncoder.end();

  // Submit the commands to the queue
  device.queue.submit([commandEncoder.finish()]);

  // Clean up the VideoFrame object
  frame.close();
}

self.onmessage = async (e: MessageEvent) => {
  const { type, ...payload } = e.data;

  switch(type) {
    case 'INIT': {
      const success = await initWebGPU(payload.canvas);
      if (success) {
        self.postMessage({ type: 'INIT_SUCCESS' });
      } else {
        self.postMessage({ type: 'INIT_FAILED' });
      }
      break;
    }
    case 'DRAW_FRAME': {
      // In production, payload.frame is a VideoFrame sent via transfer list
      renderFrame(payload.frame, payload.options);
      break;
    }
    case 'RESIZE': {
      if (canvas && device && context) {
        canvas.width = payload.width;
        canvas.height = payload.height;
        // Re-configure context format
        context.configure({
          device,
          format: navigator.gpu.getPreferredCanvasFormat(),
          alphaMode: 'premultiplied'
        });
      }
      break;
    }
    case 'DISPOSE': {
      if (device) {
        device.destroy();
        device = null;
      }
      break;
    }
  }
};
