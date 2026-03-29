/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web'

declare const self: DedicatedWorkerGlobalScope;

// Set correct WASM paths for Next.js explicitly if needed
ort.env.wasm.wasmPaths = '/_next/static/wasm/'

let session: ort.InferenceSession | null = null

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data

  switch(type) {
    case 'INIT': {
      try {
        // Here we would load a lightweight model like Silero VAD
        // const modelData = await fetch('/models/silero_vad.onnx').then(r => r.arrayBuffer())
        // session = await ort.InferenceSession.create(modelData, { executionProviders: ['wasm'] })

        // Simulating the loading phase of the 1MB WASM model for Phase 1 MVP
        setTimeout(() => {
          self.postMessage({ type: 'READY' })
        }, 800)
      } catch (err) {
        self.postMessage({ type: 'ERROR', error: String(err) })
      }
      break;
    }

    case 'PROCESS_AUDIO': {
      if (!payload?.audioData) {
        self.postMessage({ type: 'ERROR', error: 'No audio data provided' })
        return
      }

      // Simulate the ONNX inference loop:
      // const tensor = new ort.Tensor('float32', payload.audioData, [1, payload.audioData.length])
      // const results = await session.run({ input: tensor })

      // Analyze the raw audio amplitude or model output to determine speech segments

      // Output format: Array of { start: number, end: number, isSpeech: boolean }
      const mockSegments = [
        { start: 0, end: 2.5, isSpeech: true },
        { start: 2.5, end: 3.2, isSpeech: false }, // Silence detected
        { start: 3.2, end: 8.0, isSpeech: true },
        { start: 8.0, end: 9.5, isSpeech: false },
        { start: 9.5, end: 15.0, isSpeech: true }
      ]

      self.postMessage({ type: 'VAD_RESULT', segments: mockSegments })
      break;
    }
  }
}
