// DOM EVENTS DEBUGGING TOOLKIT === //

// memory-leaks.js dépend de
import { ... } from './code-optimization.js';


// === MEMORY LEAK DETECTOR === //

class MemoryLeakDetector {
    constructor() {
        this.memorySnapshots = [];
        this.trackedElements = new WeakMap();
        this.trackedIntervals = new Set();
        this.trackedTimeouts = new Set();
        this.trackedEventListeners = new WeakMap();
        this.init();
    }

    // Initialisation
    init() {
        this.setupPerformanceMonitoring();
        this.setupDOMObserver();
        this.patchGlobalTimers();
    }

    // Configuration du monitoring de performance
    setupPerformanceMonitoring() {
        if (window.performance && window.performance.memory) {
            setInterval(() => {
                this.takeMemorySnapshot();
            }, 10000); // Snapshot toutes les 10 secondes
        }
    }

    // Configuration de l'observateur DOM
    setupDOMObserver() {
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.removedNodes.forEach(node => {
                        this.checkForDetachedElements(node);
                    });
                }
            });
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Patch des timers globaux
    patchGlobalTimers() {
        // Patch setInterval
        const originalSetInterval = window.setInterval;
        const trackedIntervals = this.trackedIntervals;
        
        window.setInterval = function(fn, delay, ...args) {
            const intervalId = originalSetInterval.call(this, fn, delay, ...args);
            trackedIntervals.add({
                id: intervalId,
                stack: new Error().stack,
                timestamp: Date.now()
            });
            return intervalId;
        };

        // Patch setTimeout
        const originalSetTimeout = window.setTimeout;
        const trackedTimeouts = this.trackedTimeouts;
        
        window.setTimeout = function(fn, delay, ...args) {
            const timeoutId = originalSetTimeout.call(this, () => {
                trackedTimeouts.delete(timeoutId);
                fn.apply(this, args);
            }, delay);
            
            trackedTimeouts.add({
                id: timeoutId,
                stack: new Error().stack,
                timestamp: Date.now()
            });
            return timeoutId;
        };
    }

    // Prise d'un snapshot mémoire
    takeMemorySnapshot() {
        if (window.performance && window.performance.memory) {
            const snapshot = {
                timestamp: Date.now(),
                usedJSHeapSize: window.performance.memory.usedJSHeapSize,
                totalJSHeapSize: window.performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
            };
            
            this.memorySnapshots.push(snapshot);
            this.analyzeMemoryTrend();
        }
    }

    // Analyse de la tendance mémoire
    analyzeMemoryTrend() {
        if (this.memorySnapshots.length < 2) return;

        const latest = this.memorySnapshots[this.memorySnapshots.length - 1];
        const previous = this.memorySnapshots[this.memorySnapshots.length - 2];
        const memoryIncrease = latest.usedJSHeapSize - previous.usedJSHeapSize;
        
        if (memoryIncrease > 10000000) { // 10MB threshold
            console.warn('Possible memory leak detected:', {
                increase: ${(memoryIncrease / 1048576).toFixed(2)}MB,
                timestamp: new Date(latest.timestamp).toISOString()
            });
        }
    }

    // Vérification des éléments détachés
    checkForDetachedElements(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (this.trackedEventListeners.has(node)) {
                console.warn('Possible memory leak: Removed element still has event listeners:', node);
            }
            
            if (this.trackedElements.has(node)) {
                console.warn('Possible memory leak: Removed element is still referenced:', node);
            }
        }
    }

    // Suivi des event listeners
    trackEventListener(element, eventType, handler) {
        if (!this.trackedEventListeners.has(element)) {
            this.trackedEventListeners.set(element, new Map());
        }
        
        const elementListeners = this.trackedEventListeners.get(element);
        if (!elementListeners.has(eventType)) {
            elementListeners.set(eventType, new Set());
        }
        
        elementListeners.get(eventType).add(handler);
    }

    // Détection des closures non nettoyées
    detectClosureLeaks(func) {
        const functionString = func.toString();
        const matches = functionString.match(/this\.|[A-Za-z0-9_$]+\./g) || [];
        
        return matches.map(match => ({
            type: 'possible-closure-leak',
            variable: match.replace('.', ''),
            context: functionString
        }));
    }

    // Analyse globale des fuites
    analyzeLeaks() {
        return {
            memorySnapshots: this.getMemoryAnalysis(),
            detachedElements: this.getDetachedElements(),
            timerLeaks: this.getTimerLeaks(),
            eventListenerLeaks: this.getEventListenerLeaks()
        };
    }

    // Analyse de la mémoire
    getMemoryAnalysis() {
        if (this.memorySnapshots.length < 2) return null;

        const firstSnapshot = this.memorySnapshots[0];
        const lastSnapshot = this.memorySnapshots[this.memorySnapshots.length - 1];
        
        return {
            duration: lastSnapshot.timestamp - firstSnapshot.timestamp,
            memoryGrowth: lastSnapshot.usedJSHeapSize - firstSnapshot.usedJSHeapSize,
            trend: this.memorySnapshots.map(snapshot => ({
                timestamp: snapshot.timestamp,
                usage: snapshot.usedJSHeapSize
            }))
        };
    }

    // Récupération des éléments détachés
    getDetachedElements() {
        const detached = [];
        this.trackedElements.forEach((value, element) => {
            if (!document.contains(element)) {
                detached.push({
                    element: element.tagName,
                    id: element.id,
                    createdAt: value.timestamp
                });
            }
        });
        return detached;
    }

    // Analyse des fuites de timers
    getTimerLeaks() {
        const now = Date.now();
        return {
            intervals: Array.from(this.trackedIntervals).map(interval => ({
                id: interval.id,
                age: now - interval.timestamp,
                stack: interval.stack
            })),
            timeouts: Array.from(this.trackedTimeouts).map(timeout => ({
                id: timeout.id,
                age: now - timeout.timestamp,
                stack: timeout.stack
            }))
        };
    }

    // Analyse des fuites d'event listeners
    getEventListenerLeaks() {
        const leaks = [];
        this.trackedEventListeners.forEach((listeners, element) => {
            if (!document.contains(element)) {
                listeners.forEach((handlers, eventType) => {
                    leaks.push({
                        element: element.tagName,
                        eventType,
                        handlersCount: handlers.size
                    });
                });
            }
        });
        return leaks;
    }

    // Nettoyage des ressources
    cleanup() {
        this.observer.disconnect();
        this.trackedIntervals.forEach(interval => clearInterval(interval.id));
        this.trackedTimeouts.forEach(timeout => clearTimeout(timeout.id));
        this.trackedElements = new WeakMap();
        this.trackedEventListeners = new WeakMap();
        this.memorySnapshots = [];
    }
}

// Utilitaires de prévention des fuites mémoire
const LeakPreventionUtils = {
    // Nettoyage sécurisé des event listeners
    safeRemoveEventListeners(element) {
        const clone = element.cloneNode(true);
        element.parentNode?.replaceChild(clone, element);
        return clone;
    },

    // Nettoyage des références circulaires
    breakCircularReferences(obj) {
        const seen = new WeakSet();
        
        function breakCircular(obj) {
            if (obj && typeof obj === 'object') {
                if (seen.has(obj)) {
                    return null;
                }
                seen.add(obj);
                
                Object.keys(obj).forEach(key => {
                    const value = obj[key];
                    if (value && typeof value === 'object') {
                        obj[key] = breakCircular(value);
                    }
                });
            }
            return obj;
        }

        return breakCircular(obj);
    },

    // Création d'un wrapper pour les event listeners
    createEventListenerWrapper(element, eventType, handler) {
        const wrapper = function(...args) {
            handler.apply(this, args);
        };
        element.addEventListener(eventType, wrapper);
        return wrapper;
    }
};

// Export des utilitaires
export {
    MemoryLeakDetector,
    LeakPreventionUtils
};

// Exemple d'utilisation
function startMemoryMonitoring() {
    const detector = new MemoryLeakDetector();
    
    // Analyse périodique
    setInterval(() => {
        const leakReport = detector.analyzeLeaks();
        console.log('Memory Leak Report:', leakReport);
    }, 30000);

    return detector;
}

// Démarrer la détection des fuites mémoire
const detector = startMemoryMonitoring();

// Utiliser les utilitaires de prévention
const element = document.querySelector('#myElement');
const safeElement = LeakPreventionUtils.safeRemoveEventListeners(element);

// Nettoyer les références circulaires
const obj = { /* objet complexe */ };
const cleanObj = LeakPreventionUtils.breakCircularReferences(obj);