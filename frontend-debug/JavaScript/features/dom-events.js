// === DOM EVENTS DEBUGGING TOOLKIT === //

// dom-events.js dépend de
import { ModernBrowserChecker, BrowserCompatUtils } from '../compatibility/modern-browsers.js';

// Utilitaire de logging des événements
const EventLogger = {
    // Stockage des listeners pour le débug
    eventRegistry: new Map(),
    BrowserChecker : new ModernBrowserChecker(),
    
    // Activation du mode debug
    startDebugging(element = document) {
        const report = this.BrowserChecker.checkCompatibility();
        if (!report.warnings.length > 0) {
            console.warn('Browser compatibility warnings:', report.warnings);
        }

        const events = [
            'click', 'dblclick', 'mouseenter', 'mouseleave', 
            'mouseover', 'mouseout', 'mousemove',
            'keydown', 'keyup', 'keypress',
            'focus', 'blur', 'change', 'input',
            'submit', 'reset',
            'scroll', 'resize',
            'touchstart', 'touchend', 'touchmove'
        ];

        if (BrowserCompatUtils.detectFeature('touch')) {
            events.push('touchstart', 'touchend', 'touchmove', 'touchcancel');
        }

        events.forEach(eventType => {
            const handler = (e) => {
                console.log('%c${eventType} Event Detected', 'color: #2196F3; font-weight: bold;', {
                    eventType: e.type,
                    target: e.target,
                    currentTarget: e.currentTarget,
                    timestamp: new Date().toISOString(),
                    event: e
                });
            };

            element.addEventListener(eventType, handler, true);
            
            // Enregistrer le listener pour pouvoir le retirer plus tard
            if (!this.eventRegistry.has(element)) {
                this.eventRegistry.set(element, new Map());
            }
            this.eventRegistry.get(element).set(eventType, handler);
        });
    },

    // Désactivation du mode debug
    stopDebugging(element = document) {
        if (this.eventRegistry.has(element)) {
            const elementEvents = this.eventRegistry.get(element);
            elementEvents.forEach((handler, eventType) => {
                element.removeEventListener(eventType, handler, true);
            });
            this.eventRegistry.delete(element);
        }
    }
};

// Classe pour tester la délégation d'événements
class EventDelegationTester {
    constructor(rootElement) {
        this.root = rootElement || document;
        this.delegatedHandlers = new Map();
        this.BrowserChecker = new ModernBrowserChecker();
    }

    addDelegatedListener(selector, eventType, handler) {
        if (BrowserCompatUtils.detectFeature('querySelector')) {
            console.warn('querySelector not supported in this browser');
            return;
        }


        const wrappedHandler = (e) => {
            const target = e.target.closest(selector);
            if (target) {
                handler.call(target, e);
            }
        };

        this.root.addEventListener(eventType, wrappedHandler);
        this.delegatedHandlers.set(handler, wrappedHandler);
    }

    removeDelegatedListener(eventType, handler) {
        const wrappedHandler = this.delegatedHandlers.get(handler);
        if (wrappedHandler) {
            this.root.removeEventListener(eventType, wrappedHandler);
            this.delegatedHandlers.delete(handler);
        }
    }
}

// Gestionnaire de performance des événements
const EventPerformanceMonitor = {
    measurements: new Map(),
    BrowserChecker : new ModernBrowserChecker(),
    
    startMeasuring(eventType) {
        if (BrowserCompatUtils.detectFeature('performance')) {
            console.warn('Performance API not supported in this browser');
            return;
        }
  
        this.measurements.set(eventType, {
            count: 0,
            totalTime: 0,
            maxTime: 0
        });

        const originalAddEventListener = EventTarget.prototype.addEventListener;
        
        EventTarget.prototype.addEventListener = function(type, listener, options) {
            if (type === eventType) {
                const wrappedListener = (event) => {
                    const start = performance.now();
                    listener.call(this, event);
                    const end = performance.now();
                    const duration = end - start;
                    
                    const stats = EventPerformanceMonitor.measurements.get(eventType);
                    stats.count++;
                    stats.totalTime += duration;
                    stats.maxTime = Math.max(stats.maxTime, duration);
                };
                
                originalAddEventListener.call(this, type, wrappedListener, options);
            } else {
                originalAddEventListener.call(this, type, listener, options);
            }
        };
    },

    getStats(eventType) {
        const stats = this.measurements.get(eventType);
        if (!stats) return null;

        return {
            averageTime: stats.totalTime / stats.count,
            maxTime: stats.maxTime,
            eventCount: stats.count
        };
    }
};

// Testeur d'événements personnalisés
class CustomEventTester {
    constructor() {
        this.events = new Set();
        this.BrowserChecker = new ModernBrowserChecker();
    }

    createEvent(eventName, detail = {}) {

        if (BrowserCompatUtils.detectFeature('CustomEvent')) {
            console.warn('CustomEvent not supported in this browser');
            return null;
        }
        const event = new CustomEvent(eventName, { 
            detail,
            bubbles: true,
            cancelable: true 
        });
        this.events.add(eventName);
        return event;
    }

    dispatchTestEvent(element, eventName, detail = {}) {
        const event = this.createEvent(eventName, detail);
        return element.dispatchEvent(event);
    }

    listRegisteredEvents() {
        return Array.from(this.events);
    }
}

// Détecteur de fuites de mémoire liées aux événements
const EventLeakDetector = {
    listeners: new WeakMap(),
    BrowserChecker : new ModernBrowserChecker(),
    

    trackElement(element) {
        if (!BrowserCompatUtils.detectFeature('weakmap')) {
            console.warn('WeakMap not supported in this browser');
            return;        
        }


        this.listeners.set(element, new Set());
        
        const originalAddEventListener = element.addEventListener;
        const originalRemoveEventListener = element.removeEventListener;
        
        element.addEventListener = function(type, listener, options) {
            const listenerSet = EventLeakDetector.listeners.get(this);
            listenerSet.add({ type, listener, options });
            originalAddEventListener.call(this, type, listener, options);
        };
        
        element.removeEventListener = function(type, listener, options) {
            const listenerSet = EventLeakDetector.listeners.get(this);
            listenerSet.delete({ type, listener, options });
            originalRemoveEventListener.call(this, type, listener, options);
        };
    },
    
    checkForLeaks(element) {
        const listeners = this.listeners.get(element);
        if (listeners && listeners.size > 0) {
            console.warn('Potential event listener leak detected:', 
                Array.from(listeners).map(l => l.type));
            return Array.from(listeners);
        }
        return null;
    }
};

// Exemple d'utilisation et tests
function runEventTests() {
    const browserChecker = new ModernBrowserChecker();
    const report = browserChecker.checkCompatibility();

    console.log('Browser Compatibility Report:', report);

    if (!report.warnings.length > 0) {

    // Test basique des événements
    const testButton = document.createElement('button');
    testButton.textContent = 'Test Button';
    testButton.addEventListener('click', () => console.log('Button clicked'));
    
    // Test de la délégation
    const delegationTester = new EventDelegationTester(document.body);
    delegationTester.addDelegatedListener('.test-button', 'click', 
        (e) => console.log('Delegated click handled'));
    
    // Test des performances
    EventPerformanceMonitor.startMeasuring('click');
    
    // Test des événements personnalisés
    const customEventTester = new CustomEventTester();
    customEventTester.dispatchTestEvent(document, 'test-event', { foo: 'bar' });
    
    // Détection des fuites
    EventLeakDetector.trackElement(testButton);

} else {
    console.warn('Some feature might not work in this browser', report.warnings);
}
}

// Export des utilitaires
export {
    EventLogger,
    EventDelegationTester,
    EventPerformanceMonitor,
    CustomEventTester,
    EventLeakDetector,
    runEventTests
};



// Activer le logging des événements
// EventLogger.startDebugging();

// Tester la délégation
//const delegationTester = new EventDelegationTester(document.body);

// Surveiller les performances des événements click
// EventPerformanceMonitor.startMeasuring('click');

// Tester des événements personnalisés
// const customEventTester = new CustomEventTester();

// Détecter les fuites d'événements
// const element = document.querySelector('#myElement');
// EventLeakDetector.trackElement(element);