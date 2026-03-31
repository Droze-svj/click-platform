'use client'

import React, { useEffect } from 'react';
import LogEmitter from '../../utils/logEmitter';

const Layout = () => {
    useEffect(() => {
        LogEmitter.log('System Initialized');

        return () => {
            LogEmitter.log('System Terminated');
        };
    }, []);

    return <div>Layout</div>;
};

export default Layout;
