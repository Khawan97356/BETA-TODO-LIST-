// === DOM EVENTS DEBUGGING TOOLKIT === //

// Imports nécessaires
import { ModernBrowserChecker, BrowserCompatUtils } from '../compatibility/modern-browsers.js';
import { PolyfillsManager, PolyfillUtils } from '../compatibility/polyfills.js';

// Initialisation des outils de compatibilité
const browserChecker = new ModernBrowserChecker();
const polyfillsManager = new PolyfillsManager();

// Utilitaire de logging des événements
const EventLogger = {
    eventRegistry: new Map(),
    
    async startDebugging(element = document) {
        // Vérifier la compatibilité avant de commencer
        const compatibility = browserChecker.checkCompatibility();
        
        const events = [
            'click', 'dblclick', 'mouseenter', 'mouseleave', 
            'mouseover', 'mouseout', 'mousemove',
            'keydown', 'keyup', 'keypress',
            'focus', 'blur', 'change', 'input',
            'submit', 'reset',
            'scroll', 'resize',
            'touchstart', 'touchend', 'touchmove'
        ];

        events.forEach(eventType => {
            const handler = (e) => {
                console.log(`%c${eventType} Event Detected`, 'color: #2196F3; font-weight: bold;', {
                    eventType: e.type,
                    target: e.target,
                    currentTarget: e.currentTarget,
                    timestamp: new Date().toISOString(),
                    event: e
                });
            };

            element.addEventListener(eventType, handler, true);
            
            if (!this.eventRegistry.has(element)) {
                this.eventRegistry.set(element, new Map());
            }
            this.eventRegistry.get(element).set(eventType, handler);
        });
    },

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
        // Vérifier la compatibilité du navigateur
        const compatibility = browserChecker.checkCompatibility();
        
        this.root = rootElement || document;
        this.delegatedHandlers = new Map();

        // Vérifier le support de closest()
        if (!Element.prototype.closest) {
            polyfillsManager.loadPolyfill('Element.closest');
        }
    }

    addDelegatedListener(selector, eventType, handler) {
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
    
    startMeasuring(eventType) {
        // Vérifier le support de l'API Performance
        if (!window.performance) {
            console.warn('Performance API non supportée');
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
        
        // Vérifier le support des CustomEvent
        if (typeof CustomEvent !== 'function') {
            polyfillsManager.loadPolyfill('CustomEvent');
        }
    }

    createEvent(eventName, detail = {}) {
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
    
    trackElement(element) {
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

// Fonction d'initialisation du système
async function initializeEventSystem() {
    try {
        // Vérifier la compatibilité
        const compatibility = browserChecker.checkCompatibility();
        
        // Charger les polyfills nécessaires
        await polyfillsManager.loadAllPolyfills();

        if (compatibility.warnings.length > 0) {
            console.warn('Avertissements de compatibilité:', compatibility.warnings);
        }

        return true;
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        return false;
    }
}

// Fonction de test
async function runEventTests() {
    const isInitialized = await initializeEventSystem();
    if (!isInitialized) {
        console.error('Échec de l\'initialisation du système d\'événements');
        return;
    }

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
}

// Export des utilitaires
export {
    EventLogger,
    EventDelegationTester,
    EventPerformanceMonitor,
    CustomEventTester,
    EventLeakDetector,
    runEventTests,
    initializeEventSystem
};

// Initialisation automatique lors du chargement du DOM
document.addEventListener('DOMContentLoaded', async () => {
    await initializeEventSystem();
});