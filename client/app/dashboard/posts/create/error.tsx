'use client'

import ClickErrorRecovery from '@/components/click/ClickErrorRecovery'

export default function PostsCreateError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClickErrorRecovery {...props} scope="posts/create" />
}
