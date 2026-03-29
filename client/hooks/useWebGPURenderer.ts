'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

export interface GPUAdapterInfo {
  vendor: string
  architecture: string
  isHardware: boolean
  backend: 'webgpu' | 'webgl2' | 'canvas2d'
}

export interface WebGPURenderer {
  isGPUActive: boolean
  adapterInfo: GPUAdapterInfo | null
  canvasRef: React.RefObject<HTMLCanvasElement>
  applyGPUFilters: (filterString: string) => void
}

/**
 * useWebGPURenderer — detects WebGPU support and falls back gracefully.
 *
 * Priority chain:  WebGPU → WebGL2 → Canvas 2D
 *
 * Usage: mount the returned canvasRef over the video element as a compositing
 * layer. Call applyGPUFilters(cssFilterString) each animation frame to draw
 * the current filter state through the GPU pipeline.
 */
export function useWebGPURenderer(enabled = true): WebGPURenderer {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isGPUActive, setIsGPUActive] = useState(false)
  const [adapterInfo, setAdapterInfo] = useState<GPUAdapterInfo | null>(null)

  // GPU device refs (not state — we don't want re-renders on every frame)
  // GPUDevice typed as `any` until @webgpu/types is officially in lib.dom.d.ts
  const gpuDeviceRef = useRef<any>(null)
  const gl2Ref = useRef<WebGL2RenderingContext | null>(null)
  const backendRef = useRef<'webgpu' | 'webgl2' | 'canvas2d'>('canvas2d')

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const init = async () => {
      const canvas = canvasRef.current
      if (!canvas) return

      // ── Try WebGPU first ──────────────────────────────────────────────
      if ('gpu' in navigator) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter({
            powerPreference: 'high-performance',
          })
          if (adapter && !cancelled) {
            const device: any = await adapter.requestDevice()
            gpuDeviceRef.current = device
            backendRef.current = 'webgpu'

            const info = await adapter.requestAdapterInfo().catch(() => null)
            const resolvedInfo: GPUAdapterInfo = {
              vendor: info?.vendor ?? 'Unknown GPU',
              architecture: info?.architecture ?? 'Unknown',
              isHardware: true,
              backend: 'webgpu',
            }
            setAdapterInfo(resolvedInfo)
            setIsGPUActive(true)
            return
          }
        } catch {
          // WebGPU init failed — fall through to WebGL2
        }
      }

      // ── Try WebGL2 fallback ───────────────────────────────────────────
      if (!cancelled) {
        try {
          const gl2 = canvas.getContext('webgl2')
          if (gl2) {
            gl2Ref.current = gl2
            backendRef.current = 'webgl2'
            const debugInfo = gl2.getExtension('WEBGL_debug_renderer_info')
            const vendor = debugInfo
              ? gl2.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
              : 'WebGL2 GPU'
            const arch = debugInfo
              ? gl2.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
              : 'Hardware Accelerated'
            setAdapterInfo({
              vendor,
              architecture: arch,
              isHardware: true,
              backend: 'webgl2',
            })
            setIsGPUActive(true)
            return
          }
        } catch {
          // WebGL2 init failed — fall through to software
        }
      }

      // ── Software Canvas 2D fallback ───────────────────────────────────
      if (!cancelled) {
        setAdapterInfo({
          vendor: 'Software Renderer',
          architecture: 'CPU',
          isHardware: false,
          backend: 'canvas2d',
        })
        setIsGPUActive(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [enabled])

  /**
   * applyGPUFilters — composites the current filter state onto the canvas.
   * For now this is a thin wrapper that sets the CSS filter on the canvas
   * itself (the browser's compositor handles GPU compositing automatically
   * for both WebGPU and WebGL2 canvases when `will-change: transform` is set).
   *
   * In a production build this would be replaced by a full shader pipeline.
   */
  const applyGPUFilters = useCallback((filterString: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.style.filter = filterString
  }, [])

  return { isGPUActive, adapterInfo, canvasRef, applyGPUFilters }
}
