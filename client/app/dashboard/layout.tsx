'use client'

import React, { useEffect } from 'react'
import LogEmitter from '../../utils/logEmitter'
import SidebarNav from '../../components/SidebarNav'
import GlobalCommandPalette from '../../components/GlobalCommandPalette'
import WorkflowRail from '../../components/WorkflowRail'
import OnboardingNudge from '../../components/OnboardingNudge'
import ClickPresence from '../../components/click/ClickPresence'
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
            <div className="dashboard-layout flex min-h-screen bg-[var(--page-bg)] overflow-x-hidden transition-colors duration-500">
                <SidebarNav />
                <main className="flex-1 min-w-0 pb-24 lg:pb-0 flex flex-col overflow-x-hidden">
                    <WorkflowRail />
                    <OnboardingNudge />
                    <div className="flex-1 min-w-0 overflow-x-hidden">
                        {children}
                    </div>
                </main>
                <GlobalCommandPalette />
                {/*
                  Ambient Click presence pill — fixed bottom-right, low
                  visual weight. Tells the user, at all times, what Click
                  is up to (learning / drafting / idle). Hidden on mobile
                  bottom-nav viewports so it doesn't fight the WorkflowRail.
                */}
                <div className="hidden md:block fixed bottom-6 right-6 z-40 pointer-events-none">
                    <div className="pointer-events-auto">
                        <ClickPresence />
                    </div>
                </div>
            </div>
        </LayoutPreferencesProvider>
    )
}

export default Layout
