import Link from 'next/link'
import { LegalPage } from '../../components/ui/legal-page'

export const metadata = {
  title: 'Deleting your data — Click',
  description: 'How to deactivate your Click account, remove Click from Facebook or Instagram, and ask for your data to be erased.',
}

// Every statement on this page must match what the code actually does today.
// An earlier draft promised an in-app "Permanently Delete Account" button, a
// "Disconnect All" control and an instant purge of OAuth tokens and media —
// none of which existed. This page is also the status URL the Meta data-deletion
// callback returns (POST /api/privacy/facebook-data-deletion), so reviewers
// read it. If deletion behaviour changes, change this page in the same commit.
const LAST_UPDATED = new Date('2026-09-14')

export default function DataDeletionPage() {
  return (
    <LegalPage kicker="Legal & Privacy" title="Deleting your data" updated={LAST_UPDATED}>
      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-surface-700 dark:text-surface-300 leading-relaxed">

        <div className="p-4 rounded-xl bg-surface-100 dark:bg-white/5 not-prose text-sm text-surface-600 dark:text-slate-400">
          <p>
            You can stop using Click at any time, and you can ask us to erase your data. This page
            explains exactly what each option does today, including what it does not yet do.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">1. Deactivate your account in the app</h2>
          <ol className="list-decimal pl-6 space-y-2 text-sm">
            <li>Sign in at <Link href="/login" className="text-primary-500 underline">the Click login page</Link>.</li>
            <li>Open <strong>Settings &rarr; Account &amp; Security</strong>.</li>
            <li>Under <strong>Danger zone</strong>, choose <strong>Deactivate account</strong> and confirm with your password.</li>
          </ol>
          <p className="text-sm">
            Deactivation signs you out and blocks access to the account. It does <strong>not</strong> erase
            your data, and it can be reversed by contacting support. To have your data erased, follow
            section 3.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">2. Remove Click from Facebook or Instagram</h2>
          <p>If you connected a Facebook or Instagram account to Click, you can remove Click from Facebook:</p>
          <ol className="list-decimal pl-6 space-y-2 text-sm">
            <li>In Facebook, go to <strong>Settings &amp; privacy &rarr; Settings</strong>.</li>
            <li>Open <strong>Apps and websites</strong> and find <strong>Click</strong>.</li>
            <li>Choose <strong>Remove</strong>, then send the data deletion request Facebook offers.</li>
          </ol>
          <p className="text-sm">
            Facebook then sends Click a signed request. Click checks the signature, records your request,
            and returns a confirmation code, which Facebook shows you. Keep that code. These requests are
            currently handled by hand: recording one does not erase anything automatically.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">3. Ask us to erase your data</h2>
          <p>
            Contact us through the <Link href="/contact" className="text-primary-500 underline">contact page</Link> and
            say you want your account and data erased. Write from the email address registered to your
            account so we can confirm the request is yours, and include your Facebook confirmation code if
            you have one. We will reply once the erasure is complete.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">4. What erasure removes</h2>
          <p className="text-sm">Click&apos;s account-erasure routine currently removes:</p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>your account record,</li>
            <li>your content items and scheduled posts,</li>
            <li>security and error logs tied to your account.</li>
          </ul>
          <p className="text-sm">
            The following are <strong>not yet removed automatically</strong> by that routine, so we remove
            them by hand when processing your request: tokens for connected social accounts, uploaded and
            rendered media files, generated captions, content provenance records, and your saved style
            preferences.
          </p>
          <p className="text-sm">
            Payment records are held by Whop, our merchant of record, under Whop&apos;s own retention rules.
          </p>
        </section>

      </div>
    </LegalPage>
  )
}
