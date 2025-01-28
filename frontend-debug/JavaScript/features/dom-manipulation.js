// === DOM MANIPULATION DEBUGGING TOOLKIT === //

import { EventLeakDetector, EventDelegationTester } from './dom-events.js';

// Utilitaire pour tracer les modifications du DOM
const DOMTracker = {
    mutations: [],
    observer: null,
    eventLeakDetector: new EventLeakDetector(),
    delegationTester: new EventDelegationTester(document.body),

    // Démarrer le suivi des modifications
    startTracking() {
        // Configuration du MutationObserver
        this.observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                const mutationInfo = {
                    type: mutation.type,
                    target: mutation.target,
                    timestamp: new Date().toISOString(),
                    details: this._getMutationDetails(mutation)
                };
                this.mutations.push(mutationInfo);
                console.log('%cDOM Mutation Detected:', 'color: #4CAF50; font-weight: bold;', mutationInfo);

                // Vérifier les fuites d'événements pour les nouveaux éléments
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node instanceof HTMLElement) {
                            this.eventLeakDetector.trackElement(node);
                        }
                    });
                }
            });
        });

        // Configuration de la délégation d'événements pour les nouveaux éléments
        this.delegationTester.addDelegatedListener('*[data-track]', 'click', (e) => {
            console.log('Tracked element clicked:', e.target);
        });

        this.observer.observe(document.body, {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true,
            attributeOldValue: true,
            characterDataOldValue: true
        });
    },

    _getMutationDetails(mutation) {
        switch (mutation.type) {
            case 'childList':
                return {
                    added: Array.from(mutation.addedNodes),
                    removed: Array.from(mutation.removedNodes)
                };
            case 'attributes':
                return {
                    attribute: mutation.attributeName,
                    oldValue: mutation.oldValue,
                    newValue: mutation.target.getAttribute(mutation.attributeName)
                };
            case 'characterData':
                return {
                    oldValue: mutation.oldValue,
                    newValue: mutation.target.textContent
                };
        }
    },

    stopTracking() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    },

    getMutationHistory() {
        return this.mutations;
    },

    clearHistory() {
        this.mutations = [];
    },

    // Nouvelle méthode pour vérifier les fuites d'événements
    checkEventLeaks(element) {
        return this.eventLeakDetector.checkForLeaks(element);
    }
};

// Classe améliorée pour tester les manipulations DOM
class DOMManipulationTester {
    constructor() {
        this.snapshots = new Map();
        this.eventLeakDetector = new EventLeakDetector();
        this.delegationTester = new EventDelegationTester(document.body);
    }

    takeSnapshot(element, label) {
        // Tracker les événements avant le snapshot
        this.eventLeakDetector.trackElement(element);
        
        this.snapshots.set(label, {
            html: element.cloneNode(true),
            timestamp: new Date(),
            attributes: this._getAttributes(element),
            style: window.getComputedStyle(element),
            eventListeners: this.eventLeakDetector.checkForLeaks(element)
        });
    }

    compareWithSnapshot(element, label) {
        const snapshot = this.snapshots.get(label);
        if (!snapshot) return null;

        const currentEventListeners = this.eventLeakDetector.checkForLeaks(element);
        
        return {
            htmlChanged: element.innerHTML !== snapshot.html.innerHTML,
            attributesChanged: this._compareAttributes(element, snapshot.attributes),
            styleChanged: this._compareStyles(element, snapshot.style),
            eventListenersChanged: this._compareEventListeners(
                snapshot.eventListeners,
                currentEventListeners
            )
        };
    }

    _getAttributes(element) {
        const attributes = {};
        for (let attr of element.attributes) {
            attributes[attr.name] = attr.value;
        }
        return attributes;
    }

    _compareAttributes(element, snapshotAttrs) {
        const currentAttrs = this._getAttributes(element);
        const changes = {};
        
        for (let [key, value] of Object.entries(currentAttrs)) {
            if (snapshotAttrs[key] !== value) {
                changes[key] = {
                    old: snapshotAttrs[key],
                    new: value
                };
            }
        }
        
        for (let key in snapshotAttrs) {
            if (!(key in currentAttrs)) {
                changes[key] = {
                    old: snapshotAttrs[key],
                    new: null
                };
            }
        }
        
        return changes;
    }

    _compareStyles(element, snapshotStyle) {
        const currentStyle = window.getComputedStyle(element);
        const changes = {};

        for (let prop of currentStyle) {
            if (currentStyle[prop] !== snapshotStyle[prop]) {
                changes[prop] = {
                    old: snapshotStyle[prop],
                    new: currentStyle[prop]
                };
            }
        }

        return changes;
    }

    _compareEventListeners(oldListeners, newListeners) {
        const changes = {
            added: [],
            removed: []
        };

        if (!oldListeners || !newListeners) return null;

        // Vérifier les nouveaux écouteurs
        newListeners.forEach(listener => {
            if (!oldListeners.find(old => 
                old.type === listener.type && 
                old.listener === listener.listener
            )) {
                changes.added.push(listener);
            }
        });

        // Vérifier les écouteurs supprimés
        oldListeners.forEach(listener => {
            if (!newListeners.find(newL => 
                newL.type === listener.type && 
                newL.listener === listener.listener
            )) {
                changes.removed.push(listener);
            }
        });

        return changes;
    }

    // Nouvelle méthode pour ajouter des tests de délégation
    addDelegationTest(selector, eventType, handler) {
        this.delegationTester.addDelegatedListener(selector, eventType, handler);
    }
}

// Vérificateur de performance DOM amélioré
const DOMPerformanceChecker = {
    measurements: [],
    eventLeakChecks: [],

    measure(callback, description) {
        const start = performance.now();
        const result = callback();
        const end = performance.now();

        const measurement = {
            description,
            duration: end - start,
            timestamp: new Date(),
            reflows: this._countReflows(callback),
            eventLeaks: this._checkEventLeaks()
        };

        this.measurements.push(measurement);
        return result;
    },

    _countReflows(callback) {
        let reflows = 0;
        const original = Element.prototype.getBoundingClientRect;

        Element.prototype.getBoundingClientRect = function() {
            reflows++;
            return original.apply(this);
        };

        callback();

        Element.prototype.getBoundingClientRect = original;
        return reflows;
    },

    _checkEventLeaks() {
        const elements = document.querySelectorAll('*');
        const leaks = [];
        
        elements.forEach(element => {
            const elementLeaks = EventLeakDetector.checkForLeaks(element);
            if (elementLeaks && elementLeaks.length > 0) {
                leaks.push({ element, leaks: elementLeaks });
            }
        });

        return leaks;
    },

    getMeasurements() {
        return this.measurements;
    },

    getOptimizationTips() {
        const tips = [];
        
        if (this.measurements.some(m => m.reflows > 2)) {
            tips.push("Considérez le regroupement des lectures/écritures DOM pour éviter les reflows multiples");
        }
        
        if (this.measurements.some(m => m.duration > 16)) {
            tips.push("Certaines opérations prennent plus d'une frame (16ms). Envisagez des optimisations.");
        }

        if (this.measurements.some(m => m.eventLeaks.length > 0)) {
            tips.push("Des fuites d'événements ont été détectées. Vérifiez la suppression des écouteurs d'événements.");
        }

        return tips;
    }
};

// Sanitizer pour les manipulations DOM
const DOMSanitizer = {
    sanitizeHTML(dirty) {
        const clean = DOMPurify.sanitize(dirty, {
            ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a'],
            ALLOWED_ATTR: ['href', 'target', 'class']
        });
        return clean;
    },

    validateOperation(element, operation) {
        const risks = [];
        
        if (operation.includes('innerHTML')) {
            risks.push('innerHTML peut être dangereux, préférez textContent ou createElement');
        }
        
        if (operation.includes('eval')) {
            risks.push('eval() est dangereux et devrait être évité');
        }

        // Vérifier les écouteurs d'événements
        const eventLeaks = EventLeakDetector.checkForLeaks(element);
        if (eventLeaks && eventLeaks.length > 0) {
            risks.push('Des écouteurs d\'événements non nettoyés ont été détectés');
        }

        return risks;
    }
};

// Fonction de test améliorée
function runDOMTests() {
    DOMTracker.startTracking();
    
    const tester = new DOMManipulationTester();
    const testElement = document.createElement('div');
    document.body.appendChild(testElement);
    
    // Test initial
    tester.takeSnapshot(testElement, 'initial');
    
    // Test avec délégation d'événements
    tester.addDelegationTest('.test-class', 'click', (e) => {
        console.log('Test delegation clicked', e);
    });
    
    // Test de performance avec vérification des fuites
    DOMPerformanceChecker.measure(() => {
        testElement.innerHTML = '<p class="test-class">Test content</p>';
        testElement.addEventListener('click', () => console.log('test'));
    }, 'DOM update with event listener');
    
    // Vérification des changements
    const changes = tester.compareWithSnapshot(testElement, 'initial');
    console.log('Changes detected:', changes);
    
    // Vérification des performances et optimisations
    console.log('Performance measurements:', DOMPerformanceChecker.getMeasurements());
    console.log('Optimization tips:', DOMPerformanceChecker.getOptimizationTips());
    
    // Nettoyage
    document.body.removeChild(testElement);
    DOMTracker.stopTracking();
}

// Export des utilitaires
export {
    DOMTracker,
    DOMManipulationTester,
    DOMPerformanceChecker,
    DOMSanitizer,
    runDOMTests
};