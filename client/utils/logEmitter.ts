import sys

class LogEmitter extends EventTarget {
    constructor() {
        super();
    }

    log(message: string) {
        this.dispatchEvent(new CustomEvent('log', { detail: message }));
    }
}

export default new LogEmitter();
