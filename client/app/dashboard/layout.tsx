import React, { useEffect } from 'react';
import LogEmitter from '../utils/logEmitter';

const Layout = () => {
    useEffect(() => {
        const emitter = LogEmitter.getInstance();

        emitter.log('System Initialized');

        return () => {
            emitter.log('System Terminated');
        };
    }, []);

    return <div>Layout</div>;
};

export default Layout;
