// polyfills.js

// Gestionnaire principal des polyfills
export class PolyfillsManager {
    constructor() {
        this.polyfills = new Map();
        this.loadedPolyfills = new Set();
        this.initializePolyfills();
    }

    // Initialisation des polyfills disponibles
    initializePolyfills() {
        // Array Polyfills
        this.polyfills.set('Array.from', {
            test: () => typeof Array.from === 'function',
            implement: () => {
                if (!Array.from) {
                    Array.from = (function() {
                        const toStr = Object.prototype.toString;
                        const isCallable = fn => typeof fn === 'function';
                        const toInteger = value => {
                            const number = Number(value);
                            return isNaN(number) ? 0 : number;
                        };

                        return function from(arrayLike) {
                            const items = Object(arrayLike);
                            if (arrayLike == null) {
                                throw new TypeError('Array.from requires an array-like object');
                            }

                            const mapFn = arguments.length > 1 ? arguments[1] : void undefined;
                            if (typeof mapFn !== 'undefined' && !isCallable(mapFn)) {
                                throw new TypeError('Map function must be a function');
                            }

                            const len = toInteger(items.length);
                            const A = isCallable(this) ? Object(new this(len)) : new Array(len);

                            for (let i = 0; i < len; i++) {
                                const value = items[i];
                                if (mapFn) {
                                    A[i] = mapFn.call(arguments[2], value, i);
                                } else {
                                    A[i] = value;
                                }
                            }
                            A.length = len;
                            return A;
                        };
                    })();
                }
            }
        });

        // Promise Polyfill
        this.polyfills.set('Promise', {
            test: () => typeof Promise === 'function',
            implement: () => {
                if (!window.Promise) {
                    window.Promise = function(executor) {
                        let state = 'pending';
                        let value = null;
                        let handlers = [];

                        function resolve(result) {
                            if (state !== 'pending') return;
                            state = 'fulfilled';
                            value = result;
                            handlers.forEach(handle);
                            handlers = null;
                        }

                        function reject(error) {
                            if (state !== 'pending') return;
                            state = 'rejected';
                            value = error;
                            handlers.forEach(handle);
                            handlers = null;
                        }

                        function handle(handler) {
                            if (state === 'pending') {
                                handlers.push(handler);
                            } else {
                                if (state === 'fulfilled' && typeof handler.onFulfilled === 'function') {
                                    handler.onFulfilled(value);
                                }
                                if (state === 'rejected' && typeof handler.onRejected === 'function') {
                                    handler.onRejected(value);
                                }
                            }
                        }

                        this.then = function(onFulfilled, onRejected) {
                            return new Promise((resolve, reject) => {
                                handle({
                                    onFulfilled: function(result) {
                                        resolve(result);
                                    },
                                    onRejected: function(error) {
                                        reject(error);
                                    }
                                });
                            });
                        };

                        executor(resolve, reject);
                    };
                }
            }
        });
    }

    // Chargement conditionnel des polyfills
    loadPolyfill(name) {
        if (this.polyfills.has(name)) {
            const polyfill = this.polyfills.get(name);
            if (!polyfill.test()) {
                polyfill.implement();
                this.loadedPolyfills.add(name);
                return true;
            }
        }
        return false;
    }

    // Chargement de tous les polyfills nécessaires
    loadAllPolyfills() {
        const loaded = [];
        this.polyfills.forEach((polyfill, name) => {
            if (this.loadPolyfill(name)) {
                loaded.push(name);
            }
        });
        return loaded;
    }
}

// Utilitaires pour les polyfills
export const PolyfillUtils = {
    // Vérification de support d'une fonctionnalité
    checkSupport(feature) {
        const features = {
            'Promise': () => typeof Promise === 'function',
            'Array.from': () => typeof Array.from === 'function'
        };

        return features[feature] ? features[feature]() : false;
    },

    // Chargement dynamique de polyfill
    loadPolyfillScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
};

export default {
    PolyfillsManager,
    PolyfillUtils
};