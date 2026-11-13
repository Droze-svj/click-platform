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
const LAST_UPDATED = new Date('2026-11-13')

export default function DataDeletionPage() {
  return (
    <LegalPage kicker="Legal & Privacy" title="Deleting your data" updated={LAST_UPDATED}>
      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-surface-700 dark:text-surface-300 leading-relaxed">

        <div className="p-4 rounded-xl bg-surface-100 dark:bg-white/5 not-prose text-sm text-surface-600 dark:text-slate-400">
          <p>
            You can download your data or delete your account and everything in it yourself, from the
            app, at any time. This page explains exactly what each option does.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">1. Delete your account in the app</h2>
          <ol className="list-decimal pl-6 space-y-2 text-sm">
            <li>Sign in at <Link href="/login" className="text-primary-500 underline">the Click login page</Link>.</li>
            <li>Open <strong>Settings &rarr; Account &amp; Security</strong>.</li>
            <li>Under <strong>Your data</strong>, choose <strong>Delete account permanently</strong>, enter your password and confirm.</li>
          </ol>
          <p className="text-sm">
            Deletion happens immediately and can&apos;t be undone. If you pay for a plan, Click cancels it
            at Whop first so you aren&apos;t charged again; if that can&apos;t be done automatically, the app
            asks you to cancel it on Whop and nothing is deleted until you do. You are signed out on
            every device. In the same place, <strong>Download my data</strong> gives you a copy of
            everything first.
          </p>
          <p className="text-sm">
            <strong>Deactivate account</strong> (under Danger zone) is different: it signs you out and
            blocks the account but keeps your data, and support can reverse it.
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
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">3. If you can&apos;t sign in</h2>
          <p>
            Contact us through the <Link href="/contact" className="text-primary-500 underline">contact page</Link> and
            say you want your account and data erased. Write from the email address registered to your
            account so we can confirm the request is yours, and include your Facebook confirmation code if
            you have one. We run the same deletion described below and reply once it is complete.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">4. What deletion removes</h2>
          <p className="text-sm">Deleting your account removes:</p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>your account record, which ends every signed-in session,</li>
            <li>your videos, clips and other uploaded or rendered files,</li>
            <li>your content, captions, scripts, scheduled posts, drafts and templates,</li>
            <li>the tokens for social accounts you connected,</li>
            <li>your settings, style preferences, notifications, content provenance records, and the security and error logs tied to your account,</li>
            <li>workspaces and teams you own that have no other members (in shared ones, you are removed and the team keeps its space).</li>
          </ul>
          <p className="text-sm">
            Kept: payment and subscription records, for accounting. They are linked to an internal
            account number only, which no longer belongs to anyone once the account is gone. Card
            payments themselves are held by Whop, our merchant of record, under Whop&apos;s own
            retention rules. Copies already published to social platforms are controlled by those
            platforms.
          </p>
        </section>

      </div>
    </LegalPage>
  )
}
