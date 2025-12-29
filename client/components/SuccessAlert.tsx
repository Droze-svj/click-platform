'use client'

interface SuccessAlertProps {
  message: string
  onClose?: () => void
}

export default function SuccessAlert({ message, onClose }: SuccessAlertProps) {
  return (
    <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xl">✅</span>
        <span>{message}</span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-green-600 hover:text-green-800 font-bold"
        >
          ×
        </button>
      )}
    </div>
  )
}







