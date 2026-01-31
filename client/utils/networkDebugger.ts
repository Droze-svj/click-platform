// Network debugging utility for comprehensive request/response monitoring

interface NetworkRequest {
  id: string
  url: string
  method: string
  headers: Record<string, string>
  body?: any
  startTime: number
  endTime?: number
  duration?: number
  status?: number
  statusText?: string
  response?: any
  error?: any
  size?: number
  cached?: boolean
  initiator?: string
}

class NetworkDebugger {
  private requests: Map<string, NetworkRequest> = new Map()
  private maxRequests = 100
  private enabled = false

  constructor() {
    this.init()
  }

  private init() {
    if (typeof window === 'undefined') return

    // Enable if in development or explicitly enabled
    this.enabled = process.env.NODE_ENV === 'development' ||
                   localStorage.getItem('network_debug') === 'true'

    if (!this.enabled) return

    this.interceptFetch()
    this.interceptXHR()
    this.monitorResourceTiming()
  }

  private sendDebugLog(message: string, data: any) {
    console.log('NetworkDebugger:', message, data)
    // Use local debug API instead of external service
    fetch('/api/debug/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        component: 'NetworkDebugger',
        message: `network_${message}`,
        data: {
          ...data,
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run-network-debug'
        }
      }),
    }).catch(() => {})
    // #endregion
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private interceptFetch() {
    const originalFetch = window.fetch

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!this.enabled) return originalFetch(input, init)

      const requestId = this.generateRequestId()
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = init?.method || 'GET'

      const request: NetworkRequest = {
        id: requestId,
        url,
        method,
        headers: init?.headers as Record<string, string> || {},
        body: init?.body,
        startTime: Date.now(),
        initiator: 'fetch'
      }

      this.requests.set(requestId, request)

      this.sendDebugLog('request_start', {
        id: requestId,
        url,
        method,
        headers: request.headers,
        hasBody: !!init?.body,
        bodySize: init?.body ? JSON.stringify(init.body).length : 0
      })

      try {
        const response = await originalFetch(input, init)
        const endTime = Date.now()
        const duration = endTime - request.startTime

        // Clone response to read body
        const clonedResponse = response.clone()
        let responseBody: any = null

        try {
          const contentType = response.headers.get('content-type')
          if (contentType?.includes('application/json')) {
            responseBody = await clonedResponse.json()
          } else if (contentType?.includes('text/')) {
            responseBody = await clonedResponse.text()
          }
        } catch (e) {
          // Ignore body parsing errors
        }

        const updatedRequest: NetworkRequest = {
          ...request,
          endTime,
          duration,
          status: response.status,
          statusText: response.statusText,
          response: responseBody,
          size: responseBody ? JSON.stringify(responseBody).length : 0,
          cached: response.headers.get('x-cache') === 'HIT' || false
        }

        this.requests.set(requestId, updatedRequest)

        this.sendDebugLog('request_success', {
          id: requestId,
          url,
          method,
          status: response.status,
          statusText: response.statusText,
          duration,
          size: updatedRequest.size,
          cached: updatedRequest.cached,
          responseType: typeof responseBody,
          headers: Object.fromEntries(response.headers.entries())
        })

        // Return original response
        return response
      } catch (error) {
        const endTime = Date.now()
        const duration = endTime - request.startTime

        const updatedRequest: NetworkRequest = {
          ...request,
          endTime,
          duration,
          error: {
            message: (error as Error).message,
            name: (error as Error).name,
            stack: (error as Error).stack
          }
        }

        this.requests.set(requestId, updatedRequest)

        this.sendDebugLog('request_error', {
          id: requestId,
          url,
          method,
          duration,
          error: updatedRequest.error
        })

        throw error
      }
    }
  }

  private interceptXHR() {
    const originalOpen = XMLHttpRequest.prototype.open
    const originalSend = XMLHttpRequest.prototype.send

    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
      if (!networkDebugger.enabled) return (originalOpen as any).call(this, method, url, ...args)

      const requestId = networkDebugger.generateRequestId()
      const urlString = typeof url === 'string' ? url : url.href

      ;(this as any).__networkRequestId = requestId

      const request: NetworkRequest = {
        id: requestId,
        url: urlString,
        method: method.toUpperCase(),
        headers: {},
        startTime: Date.now(),
        initiator: 'xhr'
      }

      networkDebugger.requests.set(requestId, request)

      networkDebugger.sendDebugLog('xhr_request_start', {
        id: requestId,
        url: urlString,
        method: method.toUpperCase()
      })

      return (originalOpen as any).apply(this, [method, url, ...args])
    }

    XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
      if (!networkDebugger.enabled || !(this as any).__networkRequestId) {
        return originalSend.call(this, body)
      }

      const requestId = (this as any).__networkRequestId
      const request = networkDebugger.requests.get(requestId)

      if (request) {
        request.body = body
        networkDebugger.requests.set(requestId, request)
      }

      // Override readyState change handler
      const originalOnReadyStateChange = this.onreadystatechange
      this.onreadystatechange = function() {
        if (this.readyState === 4) {
          const endTime = Date.now()
          const duration = endTime - (request?.startTime || 0)

          const updatedRequest: NetworkRequest = {
            ...(request || {} as NetworkRequest),
            endTime,
            duration,
            status: this.status,
            statusText: this.statusText,
            response: this.responseType === 'json' ? this.response : this.responseText,
            size: this.response ? JSON.stringify(this.response).length : 0
          }

          networkDebugger.requests.set(requestId, updatedRequest)

          if (this.status >= 200 && this.status < 300) {
            networkDebugger.sendDebugLog('xhr_request_success', {
              id: requestId,
              url: request?.url,
              method: request?.method,
              status: this.status,
              statusText: this.statusText,
              duration,
              size: updatedRequest.size
            })
          } else {
            networkDebugger.sendDebugLog('xhr_request_error', {
              id: requestId,
              url: request?.url,
              method: request?.method,
              status: this.status,
              statusText: this.statusText,
              duration,
              error: this.statusText || 'XHR Error'
            })
          }
        }

        if (originalOnReadyStateChange) {
          (originalOnReadyStateChange as any).call(this)
        }
      }

      return originalSend.call(this, body)
    }
  }

  private monitorResourceTiming() {
    if (!this.enabled) return

    // Monitor resource loading performance
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()

      entries.forEach((entry) => {
        const resourceEntry = entry as PerformanceResourceTiming

        this.sendDebugLog('resource_timing', {
          url: resourceEntry.name,
          duration: resourceEntry.duration,
          size: resourceEntry.transferSize,
          type: resourceEntry.initiatorType,
          cached: resourceEntry.transferSize === 0,
          timing: {
            dnsLookup: resourceEntry.domainLookupEnd - resourceEntry.domainLookupStart,
            tcpConnect: resourceEntry.connectEnd - resourceEntry.connectStart,
            serverResponse: resourceEntry.responseStart - resourceEntry.requestStart,
            responseDownload: resourceEntry.responseEnd - resourceEntry.responseStart
          }
        })
      })
    })

    try {
      observer.observe({ entryTypes: ['resource'] })
    } catch (e) {
      // Resource timing API might not be supported
    }
  }

  public getRequests(): NetworkRequest[] {
    return Array.from(this.requests.values()).slice(-this.maxRequests)
  }

  public getRequestById(id: string): NetworkRequest | undefined {
    return this.requests.get(id)
  }

  public clearRequests() {
    this.requests.clear()
    this.sendDebugLog('requests_cleared', { timestamp: Date.now() })
  }

  public enable() {
    this.enabled = true
    localStorage.setItem('network_debug', 'true')
    this.sendDebugLog('network_debug_enabled', { timestamp: Date.now() })
  }

  public disable() {
    this.enabled = false
    localStorage.removeItem('network_debug')
    this.sendDebugLog('network_debug_disabled', { timestamp: Date.now() })
  }

  public isEnabled(): boolean {
    return this.enabled
  }
}

// Global instance
export const networkDebugger = new NetworkDebugger()

// Utility functions for manual debugging
export const enableNetworkDebugging = () => networkDebugger.enable()
export const disableNetworkDebugging = () => networkDebugger.disable()
export const getNetworkRequests = () => networkDebugger.getRequests()
export const clearNetworkRequests = () => networkDebugger.clearRequests()

// Auto-enable in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Enable network debugging by default in development
  setTimeout(() => {
    networkDebugger.enable()
  }, 1000)
}



