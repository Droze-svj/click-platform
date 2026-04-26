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
        <div className="dashboard-layout flex min-h-screen bg-[#020205]">
            <SidebarNav />
            <main className="flex-1 min-w-0 pb-24 lg:pb-0 flex flex-col">
                <WorkflowRail />
                <div className="flex-1 min-w-0">
                    {children}
                </div>
            </main>
            <GlobalCommandPalette />
        </div>
    )
}

export default Layout
