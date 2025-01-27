// === DOM MANIPULATION DEBUGGING TOOLKIT === //

// dom-manipulation.js dépend de
import { EventLeakDetector, EventDelegationTester } from './dom-events.js';

// Utilitaire pour tracer les modifications du DOM
const DOMTracker = {
    mutations: [],
    observer: null,
    EventLeakDetector : new EventLeakDetector(),

    // Démarrer le suivi des modifications
    startTracking() {

        this.EventLeakDetector.trackElement(document.body);

        this.observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {

                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                        this.EventLeakDetector.checkForDetachedElements(node);
                    });
                }

                const mutationInfo = {
                    type: mutation.type,
                    target: mutation.target,
                    timestamp: new Date().toISOString(),
                    details: this._getMutationDetails(mutation)
                };
                this.mutations.push(mutationInfo);
                console.log('%cDOM Mutation Detected:', 'color: #4CAF50; font-weight: bold;', mutationInfo);
            });
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

    // Obtenir les détails d'une mutation
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

    // Arrêter le suivi
    stopTracking() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    },

    // Obtenir l'historique des modifications
    getMutationHistory() {
        return this.mutations;
    },

    // Effacer l'historique
    clearHistory() {
        this.mutations = [];
    }
};

// Classe pour tester les manipulations DOM
class DOMManipulationTester {
    constructor() {
        this.snapshots = new Map();
        this.EventDelegationTester = new EventDelegationTester(document.body);
    };

    static DOMPerformanceChecker = {
        measurements: [],
    
        measure(callback, description) {
            // Vérifier les fuites d'événements avant et après l'opération
            const targetElements = document.querySelectorAll('*');
            const beforeLeaks = new Map();
            
            targetElements.forEach(element => {
                beforeLeaks.set(element, EventLeakDetector.checkForLeaks(element));
            });
    
            const start = performance.now();
            const result = callback();
            const end = performance.now();
    
            // Vérifier les fuites après l'opération
            const eventLeaks = [];
            targetElements.forEach(element => {
                const afterLeaks = EventLeakDetector.checkForLeaks(element);
                const beforeLeak = beforeLeaks.get(element);
                
                if (afterLeaks && (!beforeLeak || afterLeaks.length > beforeLeak.length)) {
                    eventLeaks.push({ element, leaks: afterLeaks });
                }
            });
    
            const measurement = {
                description,
                duration: end - start,
                timestamp: new Date(),
                reflows: this._countReflows(callback),
                eventLeaks // Ajouter les fuites d'événements aux mesures
            };
    
            this.measurements.push(measurement);
            return result;
        };

    // Prendre un snapshot d'un élément
    takeSnapshot(element, label) {

        const eventsLeaks = this.EventLeakDetector.checkForLeaks(element);

        this.snapshots.set(label, {
            html: element.cloneNode(true),
            timestamp: new Date(),
            attributes: this._getAttributes(element),
            style: window.getComputedStyle(element)
        });
    };

    // Comparer avec un snapshot précédent
    compareWithSnapshot(element, label) {
        const snapshot = this.snapshots.get(label);
        if (!snapshot) return null;

        const currentEventsLeaks = this.EventLeakDetector.checkForLeaks(element) || [];

        return {
            htmlChanged: element.innerHTML !== snapshot.html.innerHTML,
            attributesChanged: this._compareAttributes(element, snapshot.attributes),
            styleChanged: this._compareStyles(element, snapshot.style),
            eventsListenersChanged: this._compareEventsListeners(currentEventsLeaks, snapshot.eventsListeners),
        };
    };

    // Nouvelle méthode pour comparer les event listeners
    _compareEventListeners(current, snapshot) {
        const changes = {
            added: [],
            removed: []
        };

        current.forEach(listener => {
            if (!snapshot.find(l => l.type === listener.type)) {
                changes.added.push(listener.type);
            }
        });

        snapshot.forEach(listener => {
            if (!current.find(l => l.type === listener.type)) {
                changes.removed.push(listener.type);
            }
        });

        return changes;
    };

    // Obtenir les attributs d'un élément
    _getAttributes(element) {
        const attributes = {};
        for (let attr of element.attributes) {
            attributes[attr.name] = attr.value;
        }
        return attributes;
    };

    // Comparer les attributs
    _compareAttributes(element, snapshotAttrs) {
        const currentAttrs = this._getAttributes(element);
        const changes = {};
        
        // Vérifier les attributs modifiés ou ajoutés
        for (let [key, value] of Object.entries(currentAttrs)) {
            if (snapshotAttrs[key] !== value) {
                changes[key] = {
                    old: snapshotAttrs[key],
                    new: value
                };
            }
        }
        
        // Vérifier les attributs supprimés
        for (let key in snapshotAttrs) {
            if (!(key in currentAttrs)) {
                changes[key] = {
                    old: snapshotAttrs[key],
                    new: null
                };
            }
        }
        
        return changes;
    };

    // Comparer les styles
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
}
};

 // Compter les reflows
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
    };

    // Obtenir les mesures
    getMeasurements() {
        return this.measurements;
    }

    // Recommandations d'optimisation
    getOptimizationTips() {
        const tips = [];
        
        if (this.measurements.some(m => m.reflows > 2)) {
            tips.push("Considérez le regroupement des lectures/écritures DOM pour éviter les reflows multiples");
        }
        
        if (this.measurements.some(m => m.duration > 16)) {
            tips.push("Certaines opérations prennent plus d'une frame (16ms). Envisagez des optimisations.");
        }

        return tips;
    }
};

// Sanitizer pour les manipulations DOM
const DOMSanitizer = {
    // Nettoyer le HTML
    sanitizeHTML(dirty) {
        const clean = DOMPurify.sanitize(dirty, {
            ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'em', 'strong', 'a'],
            ALLOWED_ATTR: ['href', 'target', 'class']
        });
        return clean;
    },

    // Vérifier la sécurité d'une manipulation
    validateOperation(element, operation) {
        const risks = [];
        
        if (operation.includes('innerHTML')) {
            risks.push('innerHTML peut être dangereux, préférez textContent ou createElement');
        }
        
        if (operation.includes('eval')) {
            risks.push('eval() est dangereux et devrait être évité');
        }

        return risks;
    }
};

// Exemple d'utilisation
function runDOMTests() {
    // Démarrer le tracking
    DOMTracker.startTracking();
    
    // Créer un testeur
    const tester = new DOMManipulationTester();
    
    // Tester une manipulation
    const element = document.createElement('div');

    tester.tesEventDelegation('.test-class', 'click' , () => {
        console.log('Delegated click handled');
    });
    

    tester.takeSnapshot(element, 'initial');
    
    DOMPerformanceChecker.measure(() => {
        element.innerHTML = '<p>Test content</p>';
        element.addEventListener('click', () => {});
    }, 'innerHTML update');
    
    // Vérifier les changements
    console.log(tester.compareWithSnapshot(element, 'initial'));
    console.log('Event leaks:', EventLeakDetector.checkForLeaks(element));
    
    // Vérifier les performances
    console.log(DOMPerformanceChecker.getMeasurements());
}

// Export des utilitaires
export {
    DOMTracker,
    DOMManipulationTester,
    DOMPerformanceChecker,
    DOMSanitizer,
    runDOMTests
};

// Activer le suivi des modifications
// DOMTracker.startTracking();

// Tester des manipulations
// const tester = new DOMManipulationTester();
// const element = document.querySelector('#myElement');

// Prendre un snapshot
// tester.takeSnapshot(element, 'before');

// Mesurer une opération
//DOMPerformanceChecker.measure(() => {
    // Votre manipulation DOM ici
    //element.innerHTML = '<p>Nouveau contenu</p>';
//}, 'Mise à jour du contenu');

// Comparer avec le snapshot
// const changes = tester.compareWithSnapshot(element, 'before');