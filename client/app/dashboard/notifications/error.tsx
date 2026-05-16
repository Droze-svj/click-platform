'use client'

import ClickErrorRecovery from '@/components/click/ClickErrorRecovery'

export default function NotificationsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClickErrorRecovery {...props} scope="notifications" />
}
