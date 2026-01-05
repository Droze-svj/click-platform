'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { logWebGLError, measurePerformance } from '../utils/errorHandler'

interface VideoFilter {
  brightness: number
  contrast: number
  saturation: number
  hue: number
  blur: number
  sepia: number
  vignette: number
  sharpen: number
  noise: number
  temperature: number
  tint: number
  highlights: number
  shadows: number
  clarity: number
  dehaze: number
}

interface WebGLVideoRendererProps {
  videoElement: HTMLVideoElement | null
  filters: VideoFilter
  width: number
  height: number
  onFrameRendered?: () => void
}

export default function WebGLVideoRenderer({
  videoElement,
  filters,
  width,
  height,
  onFrameRendered
}: WebGLVideoRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const textureRef = useRef<WebGLTexture | null>(null)
  const animationFrameRef = useRef<number>()
  const [isInitialized, setIsInitialized] = useState(false)

  // WebGL shader sources
  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `

  const fragmentShaderSource = `
    precision mediump float;

    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_brightness;
    uniform float u_contrast;
    uniform float u_saturation;
    uniform float u_hue;
    uniform float u_blur;
    uniform float u_sepia;
    uniform float u_vignette;
    uniform float u_sharpen;
    uniform float u_noise;
    uniform float u_temperature;
    uniform float u_tint;
    uniform float u_highlights;
    uniform float u_shadows;
    uniform float u_clarity;
    uniform float u_dehaze;

    varying vec2 v_texCoord;

    // RGB to HSL conversion
    vec3 rgb2hsl(vec3 color) {
      float maxVal = max(max(color.r, color.g), color.b);
      float minVal = min(min(color.r, color.g), color.b);
      float delta = maxVal - minVal;

      float h = 0.0;
      float s = 0.0;
      float l = (maxVal + minVal) / 2.0;

      if (delta != 0.0) {
        s = l < 0.5 ? delta / (maxVal + minVal) : delta / (2.0 - maxVal - minVal);

        if (color.r == maxVal) {
          h = (color.g - color.b) / delta;
        } else if (color.g == maxVal) {
          h = 2.0 + (color.b - color.r) / delta;
        } else {
          h = 4.0 + (color.r - color.g) / delta;
        }

        h *= 60.0;
        if (h < 0.0) h += 360.0;
      }

      return vec3(h, s, l);
    }

    // HSL to RGB conversion
    vec3 hsl2rgb(vec3 hsl) {
      float h = hsl.x / 360.0;
      float s = hsl.y;
      float l = hsl.z;

      if (s == 0.0) {
        return vec3(l, l, l);
      }

      float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
      float p = 2.0 * l - q;

      float r = hue2rgb(p, q, h + 1.0/3.0);
      float g = hue2rgb(p, q, h);
      float b = hue2rgb(p, q, h - 1.0/3.0);

      return vec3(r, g, b);
    }

    float hue2rgb(float p, float q, float t) {
      if (t < 0.0) t += 1.0;
      if (t > 1.0) t -= 1.0;
      if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
      if (t < 1.0/2.0) return q;
      if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
      return p;
    }

    // Gaussian blur function
    vec4 gaussianBlur(sampler2D tex, vec2 uv, vec2 resolution) {
      float blurSize = u_blur / 100.0;
      vec4 color = vec4(0.0);
      float total = 0.0;

      for (int x = -2; x <= 2; x++) {
        for (int y = -2; y <= 2; y++) {
          vec2 offset = vec2(float(x), float(y)) * blurSize / resolution;
          float weight = exp(-(float(x*x) + float(y*y)) / (2.0 * blurSize * blurSize));
          color += texture2D(tex, uv + offset) * weight;
          total += weight;
        }
      }

      return color / total;
    }

    // Sharpen filter
    vec4 sharpen(sampler2D tex, vec2 uv, vec2 resolution) {
      float sharpenAmount = u_sharpen / 100.0;
      vec4 center = texture2D(tex, uv);
      vec4 up = texture2D(tex, uv + vec2(0.0, 1.0) / resolution.y);
      vec4 down = texture2D(tex, uv + vec2(0.0, -1.0) / resolution.y);
      vec4 left = texture2D(tex, uv + vec2(-1.0, 0.0) / resolution.x);
      vec4 right = texture2D(tex, uv + vec2(1.0, 0.0) / resolution.x);

      vec4 laplacian = center * 4.0 - (up + down + left + right);
      return center + laplacian * sharpenAmount;
    }

    // Vignette effect
    float vignette(vec2 uv, float strength) {
      vec2 center = vec2(0.5, 0.5);
      float dist = distance(uv, center);
      return 1.0 - dist * dist * strength;
    }

    // Noise function
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec2 uv = v_texCoord;
      vec4 color = texture2D(u_texture, uv);

      // Apply blur if enabled
      if (u_blur > 0.0) {
        color = gaussianBlur(u_texture, uv, u_resolution);
      }

      // Apply sharpening
      if (u_sharpen > 0.0) {
        color = sharpen(u_texture, uv, u_resolution);
      }

      // Convert to HSL for color adjustments
      vec3 hsl = rgb2hsl(color.rgb);

      // Apply saturation
      hsl.y *= (u_saturation / 100.0);

      // Apply hue shift
      hsl.x = mod(hsl.x + u_hue, 360.0);

      // Convert back to RGB
      vec3 rgb = hsl2rgb(hsl);

      // Apply brightness and contrast
      rgb = (rgb - 0.5) * (u_contrast / 100.0) + 0.5;
      rgb += (u_brightness - 100.0) / 100.0;

      // Apply temperature (warm/cool)
      if (u_temperature > 100.0) {
        rgb.r *= 1.0 + (u_temperature - 100.0) / 200.0;
        rgb.b *= 1.0 - (u_temperature - 100.0) / 400.0;
      } else {
        rgb.b *= 1.0 + (100.0 - u_temperature) / 200.0;
        rgb.r *= 1.0 - (100.0 - u_temperature) / 400.0;
      }

      // Apply tint (green/magenta)
      if (u_tint > 0.0) {
        rgb.g *= 1.0 + u_tint / 200.0;
        rgb.r *= 1.0 - u_tint / 400.0;
        rgb.b *= 1.0 - u_tint / 400.0;
      } else {
        rgb.r *= 1.0 - u_tint / 400.0;
        rgb.b *= 1.0 + u_tint / 200.0;
      }

      // Apply highlights and shadows
      if (u_highlights != 0.0) {
        float highlightFactor = u_highlights / 100.0;
        rgb = mix(rgb, vec3(1.0), highlightFactor * (1.0 - rgb));
      }

      if (u_shadows != 0.0) {
        float shadowFactor = u_shadows / 100.0;
        rgb = mix(rgb, vec3(0.0), -shadowFactor * rgb);
      }

      // Apply clarity (local contrast enhancement)
      if (u_clarity != 0.0) {
        vec4 blurred = gaussianBlur(u_texture, uv, u_resolution);
        float clarityFactor = u_clarity / 100.0;
        rgb = mix(rgb, (rgb - blurred.rgb) * 2.0 + 0.5, clarityFactor);
      }

      // Apply dehaze (reduce atmospheric haze)
      if (u_dehaze != 0.0) {
        float dehazeFactor = u_dehaze / 100.0;
        float luminance = dot(rgb, vec3(0.299, 0.587, 0.114));
        rgb = mix(rgb, rgb / (1.0 - luminance * dehazeFactor), dehazeFactor);
      }

      // Apply sepia
      if (u_sepia > 0.0) {
        float sepiaFactor = u_sepia / 100.0;
        vec3 sepiaColor = vec3(
          rgb.r * 0.393 + rgb.g * 0.769 + rgb.b * 0.189,
          rgb.r * 0.349 + rgb.g * 0.686 + rgb.b * 0.168,
          rgb.r * 0.272 + rgb.g * 0.534 + rgb.b * 0.131
        );
        rgb = mix(rgb, sepiaColor, sepiaFactor);
      }

      // Apply vignette
      if (u_vignette > 0.0) {
        float vignetteStrength = u_vignette / 100.0;
        float vignetteAmount = vignette(uv, vignetteStrength);
        rgb *= vignetteAmount;
      }

      // Apply noise
      if (u_noise > 0.0) {
        float noiseAmount = u_noise / 100.0;
        vec3 noise = vec3(
          random(uv + vec2(0.0, 0.0)) - 0.5,
          random(uv + vec2(1.0, 0.0)) - 0.5,
          random(uv + vec2(0.0, 1.0)) - 0.5
        ) * noiseAmount * 0.1;
        rgb += noise;
      }

      // Clamp final color
      rgb = clamp(rgb, 0.0, 1.0);

      gl_FragColor = vec4(rgb, color.a);
    }
  `

  // Initialize WebGL
  const initWebGL = useCallback(() => {

    const canvas = canvasRef.current
    if (!canvas) {
      return false
    }

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      console.warn('WebGL not supported, falling back to canvas rendering')
      return false
    }

    glRef.current = gl as WebGLRenderingContext

    // Create shaders

    const vertexShader = createShader(glRef.current, glRef.current.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = createShader(glRef.current, glRef.current.FRAGMENT_SHADER, fragmentShaderSource)

    if (!vertexShader || !fragmentShader) {
      console.error('Failed to create shaders')
      return false
    }

    // Create program
    const program = createProgram(glRef.current, vertexShader, fragmentShader)
    if (!program) {
      console.error('Failed to create program')
      return false
    }

    programRef.current = program

    // Create buffer for quad
    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]), gl.STATIC_DRAW)

    const texCoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0,
    ]), gl.STATIC_DRAW)

    // Create texture
    const texture = gl.createTexture()
    textureRef.current = texture

    setIsInitialized(true)
    return true
  }, [])

  // Create shader helper
  const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) return null

    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }

    return shader
  }

  // Create program helper
  const createProgram = (gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) => {
    const program = gl.createProgram()
    if (!program) return null

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program))
      gl.deleteProgram(program)
      return null
    }

    return program
  }

  // Update texture from video
  const updateTexture = useCallback((gl: WebGLRenderingContext, video: HTMLVideoElement) => {
    const texture = textureRef.current
    if (!texture || !glRef.current) return

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }, [])

  // Render frame
  const render = useCallback(async () => {
    const startTime = performance.now()

    try {
      const gl = glRef.current
      const program = programRef.current
      const video = videoElement

      if (!gl || !program || !video || !isInitialized) {
        return
      }

    // Update canvas size
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = width
      canvas.height = height
    }

    gl.viewport(0, 0, width, height)

    // Clear
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Check for WebGL errors after clear
    const clearError = gl.getError()
    if (clearError !== gl.NO_ERROR) {
      logWebGLError('clear', clearError)
      return
    }

    // Use program
    gl.useProgram(program)

    // Set up attributes
    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord')

    // Position buffer
    gl.enableVertexAttribArray(positionLocation)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]), gl.STATIC_DRAW)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    // Texture coordinate buffer
    gl.enableVertexAttribArray(texCoordLocation)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      0, 0,
      1, 1,
      1, 0,
    ]), gl.STATIC_DRAW)
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)

    // Update texture
    updateTexture(gl, video)

    // Set uniforms
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
    const brightnessLocation = gl.getUniformLocation(program, 'u_brightness')
    const contrastLocation = gl.getUniformLocation(program, 'u_contrast')
    const saturationLocation = gl.getUniformLocation(program, 'u_saturation')
    const hueLocation = gl.getUniformLocation(program, 'u_hue')
    const blurLocation = gl.getUniformLocation(program, 'u_blur')
    const sepiaLocation = gl.getUniformLocation(program, 'u_sepia')
    const vignetteLocation = gl.getUniformLocation(program, 'u_vignette')
    const sharpenLocation = gl.getUniformLocation(program, 'u_sharpen')
    const noiseLocation = gl.getUniformLocation(program, 'u_noise')
    const temperatureLocation = gl.getUniformLocation(program, 'u_temperature')
    const tintLocation = gl.getUniformLocation(program, 'u_tint')
    const highlightsLocation = gl.getUniformLocation(program, 'u_highlights')
    const shadowsLocation = gl.getUniformLocation(program, 'u_shadows')
    const clarityLocation = gl.getUniformLocation(program, 'u_clarity')
    const dehazeLocation = gl.getUniformLocation(program, 'u_dehaze')

    gl.uniform2f(resolutionLocation, width, height)
    gl.uniform1f(brightnessLocation, filters.brightness)
    gl.uniform1f(contrastLocation, filters.contrast)
    gl.uniform1f(saturationLocation, filters.saturation)
    gl.uniform1f(hueLocation, filters.hue)
    gl.uniform1f(blurLocation, filters.blur)
    gl.uniform1f(sepiaLocation, filters.sepia)
    gl.uniform1f(vignetteLocation, filters.vignette)
    gl.uniform1f(sharpenLocation, filters.sharpen)
    gl.uniform1f(noiseLocation, filters.noise)
    gl.uniform1f(temperatureLocation, filters.temperature || 100)
    gl.uniform1f(tintLocation, filters.tint || 0)
    gl.uniform1f(highlightsLocation, filters.highlights || 0)
    gl.uniform1f(shadowsLocation, filters.shadows || 0)
    gl.uniform1f(clarityLocation, filters.clarity || 0)
    gl.uniform1f(dehazeLocation, filters.dehaze || 0)

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    // Check for WebGL errors after draw
    const drawError = gl.getError()
    if (drawError !== gl.NO_ERROR) {
      logWebGLError('drawArrays', drawError)
      return
    }

    onFrameRendered?.()

    // Performance monitoring
    const renderTime = performance.now() - startTime
    if (renderTime > 16.67) { // Slower than 60fps
    }
  } catch (error) {
    logWebGLError('render', error)
  }
}, [videoElement, filters, width, height, isInitialized, updateTexture, onFrameRendered])

  // Animation loop
  useEffect(() => {
    if (!isInitialized || !videoElement) return

    const animate = () => {
      render()
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isInitialized, videoElement, render])

  // Initialize WebGL on mount
  useEffect(() => {
    initWebGL()
  }, [initWebGL])

  // Update canvas size
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = width
      canvas.height = height
    }
  }, [width, height])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full object-contain bg-black"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
