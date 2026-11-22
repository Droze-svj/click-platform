'use client'

import React, { useEffect } from 'react'
// Side effect: lib/api attaches the session token to raw axios/fetch API calls.
import '../../lib/api'
import LogEmitter from '../../utils/logEmitter'
import SidebarNav from '../../components/SidebarNav'
import DashboardHeader from '../../components/dashboard/DashboardHeader'
import ClickDynamicIsland from '../../components/click/ClickDynamicIsland'
import ClickAmbientCanvas from '../../components/click/ClickAmbientCanvas'
import GlobalCommandPalette from '../../components/GlobalCommandPalette'
import WorkflowRail from '../../components/WorkflowRail'
import OnboardingNudge from '../../components/OnboardingNudge'
import UpgradeGateListener from '../../components/UpgradeGateListener'
import AIHealthBanner from '../../components/AIHealthBanner'
import { LayoutPreferencesProvider } from '../../contexts/LayoutPreferencesContext'

const Layout = ({ children }: { children: React.ReactNode }) => {
    useEffect(() => {
        LogEmitter.log('System Initialized')

        return () => {
            LogEmitter.log('System Terminated')
        }
    }, [])

    return (
        // overflow-x-hidden at the root + on the main column prevents the
        // jargon-era pages (Tasks/Membership/Settings/Projects) from
        // letting their decorative absolute-positioned floating cards
        // bleed past the viewport edge. The cards are still drawn
        // (they're scenic, not informational), they're just clipped to
        // the visible area instead of forcing a horizontal scrollbar
        // that hides actual content like stat cards and CTAs.
        <LayoutPreferencesProvider>
            <div className="dashboard-layout relative flex min-h-screen bg-[var(--page-bg)] overflow-x-clip transition-colors duration-500">
                <ClickAmbientCanvas variant="app" />
                <div className="relative z-10 flex flex-1 min-w-0">
                    <SidebarNav />
                    <main className="flex-1 min-w-0 pb-24 lg:pb-0 flex flex-col overflow-x-clip">
                        <DashboardHeader />
                        {/* App-wide warning when AI providers are unconfigured
                            (every AI feature is returning canned fallback output).
                            Renders nothing in normal "live AI" mode. */}
                        <AIHealthBanner />
                        <WorkflowRail />
                        <OnboardingNudge />
                        <div className="flex-1 min-w-0">
                            {children}
                        </div>
                    </main>
                </div>
                <ClickDynamicIsland />
                <GlobalCommandPalette />
                {/* App-wide paywall: any gated API call triggers this once. */}
                <UpgradeGateListener />
            </div>
        </LayoutPreferencesProvider>
    )
}

export default Layout
