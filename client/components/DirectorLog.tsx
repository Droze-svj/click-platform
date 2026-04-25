import React, { useEffect } from 'react';
import LogEmitter from '../utils/logEmitter';

const DirectorLog = () => {
    useEffect(() => {
        // logEmitter is a singleton instance, not a class with getInstance().
        const emitter = LogEmitter;
        const handler = (event: Event) => {
            const detail = (event as CustomEvent).detail;
            console.log(detail);
        };
        emitter.addEventListener('log', handler);
        return () => {
            emitter.removeEventListener('log', handler);
        };
    }, []);

    return <div>Director Log</div>;
};

export default DirectorLog;
