/// <reference lib="webworker" />
/// <reference types="@webgpu/types" />

// `self` is a built-in in Worker context — the webworker lib reference above
// types it as DedicatedWorkerGlobalScope. Re-declaring it triggered TS2451.

let canvas: OffscreenCanvas | null = null;
let device: GPUDevice | null = null;
let context: GPUCanvasContext | null = null;
let pipeline: GPURenderPipeline | null = null;
let sampler: GPUSampler | null = null;

const vertexShaderSource = `
  struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
  };

  @vertex
  fn main(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 4>(
      vec2<f32>(-1.0,  1.0),
      vec2<f32>( 1.0,  1.0),
      vec2<f32>(-1.0, -1.0),
      vec2<f32>( 1.0, -1.0)
    );
    var uv = array<vec2<f32>, 4>(
      vec2<f32>(0.0, 0.0),
      vec2<f32>(1.0, 0.0),
      vec2<f32>(0.0, 1.0),
      vec2<f32>(1.0, 1.0)
    );
    var output: VertexOutput;
    output.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
    output.uv = uv[vertexIndex];
    return output;
  }
`;

const fragmentShaderSource = `
  @group(0) @binding(0) var mySampler: sampler;
  @group(0) @binding(1) var myTexture: texture_2d<f32>;

  struct Options {
    brightness: f32,
    contrast: f32,
    backgroundRemoval: f32, // 0.0 or 1.0
    styleTransfer: f32,    // 0.0 or 1.0
  };
  @group(0) @binding(2) var<uniform> options: Options;

  @fragment
  fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    var color = textureSample(myTexture, mySampler, uv);

    // 1. Background Removal (Chroma Key Heuristic for VFX Pipeline)
    if (options.backgroundRemoval > 0.5) {
      let greenBase = vec3<f32>(0.0, 1.0, 0.0);
      let dist = distance(color.rgb, greenBase);
      if (dist < 0.4) {
        discard;
      }
    }

    // 2. Style Transfer / Color Grading Matrix
    if (options.styleTransfer > 0.5) {
      // Apply a cinematic teal-and-orange grade
      color.r = color.r * 1.1 + 0.05;
      color.b = color.b * 0.9 + 0.1;
    }

    // 3. Brightness/Contrast
    color.rgb = (color.rgb - 0.5) * options.contrast + 0.5 + options.brightness;

    return color;
  }
`;

async function initWebGPU(offscreenCanvas: OffscreenCanvas) {
  canvas = offscreenCanvas;
  if (!navigator.gpu) return false;

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;

  device = await adapter.requestDevice();
  context = canvas.getContext('webgpu') as GPUCanvasContext;

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format: presentationFormat, alphaMode: 'premultiplied' });

  sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

  const shaderModule = device.createShaderModule({ code: vertexShaderSource + fragmentShaderSource });
  pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shaderModule, entryPoint: 'main' },
    fragment: {
      module: shaderModule,
      entryPoint: 'main',
      targets: [{ format: presentationFormat }],
    },
    primitive: { topology: 'triangle-strip' },
  });

  return true;
}

function renderFrame(frame: VideoFrame, renderOptions: any = {}) {
  if (!device || !context || !pipeline || !sampler) {
    frame.close();
    return;
  }

  const texture = device.importExternalTexture({ source: frame });
  
  // Create uniform buffer for options
  const optionsData = new Float32Array([
    (renderOptions.brightness ?? 0) / 100,
    (renderOptions.contrast ?? 100) / 100,
    renderOptions.backgroundRemoval ? 1.0 : 0.0,
    renderOptions.styleTransfer ? 1.0 : 0.0,
  ]);
  const uniformBuffer = device.createBuffer({
    size: optionsData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, optionsData);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: texture },
      { binding: 2, resource: { buffer: uniformBuffer } },
    ],
  });

  const commandEncoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: textureView,
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
      loadOp: 'clear' as GPULoadOp,
      storeOp: 'store' as GPUStoreOp,
    }],
  });

  renderPass.setPipeline(pipeline);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.draw(4);
  renderPass.end();

  device.queue.submit([commandEncoder.finish()]);
  frame.close();
}

self.onmessage = async (e: MessageEvent) => {
  const { type, ...payload } = e.data;
  switch(type) {
    case 'INIT': 
      const success = await initWebGPU(payload.canvas);
      self.postMessage({ type: success ? 'INIT_SUCCESS' : 'INIT_FAILED' });
      break;
    case 'DRAW_FRAME':
      renderFrame(payload.frame, payload.options);
      break;
    case 'RESIZE':
      if (canvas && device && context) {
        canvas.width = payload.width;
        canvas.height = payload.height;
        context.configure({ device, format: navigator.gpu.getPreferredCanvasFormat(), alphaMode: 'premultiplied' });
      }
      break;
    case 'DISPOSE':
      if (device) { device.destroy(); device = null; }
      break;
  }
};
