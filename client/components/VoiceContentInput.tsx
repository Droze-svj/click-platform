'use client'

import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Square, Loader2 } from 'lucide-react'

interface VoiceContentInputProps {
  onTranscript: (text: string) => void
  onError?: (error: string) => void
  disabled?: boolean
}

export default function VoiceContentInput({ onTranscript, onError, disabled }: VoiceContentInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    // Initialize speech recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (event: any) => {
          let interimTranscript = ''
          let finalTranscript = ''

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' '
            } else {
              interimTranscript += transcript
            }
          }

          setTranscript(finalTranscript + interimTranscript)
        }

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          setIsRecording(false)
          if (onError) {
            onError(`Speech recognition error: ${event.error}`)
          }
        }

        recognition.onend = () => {
          setIsRecording(false)
        }

        recognitionRef.current = recognition
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [onError])

  const startRecording = () => {
    if (recognitionRef.current && !isRecording) {
      try {
        recognitionRef.current.start()
        setIsRecording(true)
        setTranscript('')
      } catch (error: any) {
        console.error('Failed to start recording:', error)
        if (onError) {
          onError('Failed to start voice recording. Please check your microphone permissions.')
        }
      }
    }
  }

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
      setIsProcessing(true)
      
      // Process transcript after a short delay
      setTimeout(() => {
        if (transcript.trim()) {
          onTranscript(transcript.trim())
        }
        setIsProcessing(false)
        setTranscript('')
      }, 500)
    }
  }

  const isSupported = typeof window !== 'undefined' && 
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  if (!isSupported) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {!isRecording ? (
        <button
          onClick={startRecording}
          disabled={disabled || isProcessing}
          className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          title="Start voice input"
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 animate-pulse transition-all"
          title="Stop recording"
        >
          <Square className="w-5 h-5" />
        </button>
      )}
      
      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
          <span>Recording...</span>
        </div>
      )}
      
      {transcript && !isRecording && (
        <div className="text-xs text-gray-600 max-w-xs truncate">
          {transcript.substring(0, 50)}...
        </div>
      )}
    </div>
  )
}


