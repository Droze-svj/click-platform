import { Suspense } from 'react'
import { LegalPage } from '../../components/ui/legal-page'
import ContactForm from '../../components/contact/ContactForm'

export const metadata = {
  title: 'Contact — Click',
  description: 'Questions, support, billing, privacy or data requests: write to the Click team.',
}

export default function ContactPage() {
  return (
    <LegalPage kicker="Contact" title="Get in touch">
      <p className="text-surface-600 dark:text-surface-400 text-lg font-medium leading-relaxed mb-8 max-w-2xl">
        Questions, problems, billing, privacy or a request about your data: write to us here and we
        reply by email.
      </p>
      <Suspense fallback={null}>
        <ContactForm />
      </Suspense>
    </LegalPage>
  )
}
