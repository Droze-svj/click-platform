'use client'

import ClickErrorRecovery from '@/components/click/ClickErrorRecovery'

export default function ProjectsError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ClickErrorRecovery {...props} scope="projects" />
}
