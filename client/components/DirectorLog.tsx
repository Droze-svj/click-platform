import React, { useEffect } from 'react';
import LogEmitter from '../utils/logEmitter';

const DirectorLog = () => {
    useEffect(() => {
        const emitter = LogEmitter.getInstance();

        emitter.addEventListener('log', (event) => {
            console.log(event.detail);
        });

        return () => {
            emitter.removeEventListener('log', (event) => {
                console.log(event.detail);
            });
        };
    }, []);

    return <div>Director Log</div>;
};

export default DirectorLog;
