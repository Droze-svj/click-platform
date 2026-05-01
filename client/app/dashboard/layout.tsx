'use client'

import React, { useEffect } from 'react'
import LogEmitter from '../../utils/logEmitter'
import SidebarNav from '../../components/SidebarNav'
import GlobalCommandPalette from '../../components/GlobalCommandPalette'
import WorkflowRail from '../../components/WorkflowRail'

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
        <div className="dashboard-layout flex min-h-screen bg-[var(--page-bg)] overflow-x-hidden transition-colors duration-500">
            <SidebarNav />
            <main className="flex-1 min-w-0 pb-24 lg:pb-0 flex flex-col overflow-x-hidden">
                <WorkflowRail />
                <div className="flex-1 min-w-0 overflow-x-hidden">
                    {children}
                </div>
            </main>
            <GlobalCommandPalette />
        </div>
    )
}

export default Layout
