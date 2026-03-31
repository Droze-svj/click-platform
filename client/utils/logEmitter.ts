
class LogEmitter extends EventTarget {
    constructor() {
        super();
    }

    log(message: string) {
        this.dispatchEvent(new CustomEvent('log', { detail: message }));
    }
}

const logEmitter = new LogEmitter();
export default logEmitter;
