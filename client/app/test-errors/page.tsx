'use client'

import React, { useState } from 'react'

// Force dynamic rendering to avoid SSR issues with localStorage
export const dynamic = 'force-dynamic'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { logError, logNetworkError, logTemplateError } from '../../utils/errorHandler'
import { extractApiError } from '../../utils/apiResponse'
import { retryHandler } from '../../utils/retryHandler'

export default function TestErrorsPage() {
  const [testResults, setTestResults] = useState<string[]>([])

  const addResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`])
  }

  const testBasicError = () => {
    try {
      throw new Error('Test error for basic error handling')
    } catch (error) {
      logError(error as Error, 'TestErrorsPage', 'testBasicError')
      addResult('Basic error logged successfully')
    }
  }

  const testNetworkError = () => {
    logNetworkError('http://test.com/api/data', 'fetchUserData', new Error('Network timeout'))
    addResult('Network error logged successfully')
  }

  const testTemplateError = () => {
    logTemplateError('template-123', 'render', new Error('Template syntax error'))
    addResult('Template error logged successfully')
  }

  const testApiErrorExtraction = () => {
    const mockError = {
      response: {
        status: 404,
        data: { error: 'Resource not found', code: 'NOT_FOUND' }
      }
    }

    const extracted = extractApiError(mockError)
    addResult(`API error extracted: ${JSON.stringify(extracted)}`)
  }

  const testRetryMechanism = async () => {
    let attemptCount = 0

    const failingFunction = async () => {
      attemptCount++
      if (attemptCount < 3) {
        throw new Error(`Attempt ${attemptCount} failed`)
      }
      return `Success on attempt ${attemptCount}`
    }

    try {
      const result = await retryHandler.executeWithRetry(
        failingFunction,
        {
          maxRetries: 3,
          baseDelay: 100,
          onRetry: (attempt, error) => {
            addResult(`Retry attempt ${attempt} after error: ${error.message}`)
          }
        }
      )
      addResult(`Retry succeeded: ${result}`)
    } catch (error) {
      addResult(`Retry failed after all attempts: ${(error as Error).message}`)
    }
  }

  const testUnhandledError = () => {
    // This will trigger the global error handler
    setTimeout(() => {
      throw new Error('Unhandled error from setTimeout')
    }, 100)
    addResult('Unhandled error scheduled (will appear in console)')
  }

  const testPromiseRejection = () => {
    // This will trigger the unhandled rejection handler
    Promise.reject(new Error('Unhandled promise rejection test'))
    addResult('Unhandled promise rejection created')
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Error Handling Test Page</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Error Logging Tests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={testBasicError} className="w-full">
              Test Basic Error Logging
            </Button>
            <Button onClick={testNetworkError} className="w-full">
              Test Network Error Logging
            </Button>
            <Button onClick={testTemplateError} className="w-full">
              Test Template Error Logging
            </Button>
            <Button onClick={testApiErrorExtraction} className="w-full">
              Test API Error Extraction
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recovery & Monitoring Tests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={testRetryMechanism} className="w-full">
              Test Retry Mechanism
            </Button>
            <Button onClick={testUnhandledError} className="w-full" variant="destructive">
              Test Unhandled Error
            </Button>
            <Button onClick={testPromiseRejection} className="w-full" variant="destructive">
              Test Promise Rejection
            </Button>
            <Button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full"
              variant="outline"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg max-h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-gray-500">No tests run yet. Click buttons above to test error handling.</p>
            ) : (
              <div className="space-y-1 font-mono text-sm">
                {testResults.map((result, index) => (
                  <div key={index} className="text-gray-700 dark:text-gray-300">
                    {result}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 text-sm text-gray-500 text-center">
        Check the browser console and Error Monitoring Dashboard (Ctrl+Shift+E) for detailed error logs.
      </div>
    </div>
  )
}
