// DOM EVENTS DEBUGGING TOOLKIT === //
// modern-browsers.js dépend de
import { PolyfillsManager, PolyfillUtils } from './polyfills.js';

// === MODERN BROWSER COMPATIBILITY CHECKER === //

class ModernBrowserChecker {
    constructor() {
        this.browserFeatures = new Map();
        this.warnings = [];
        this.polyfillsManager = new PolyfillsManager(); // Ajout du gestionnaire de polyfills
        this.initializeFeatureTests();
    }

    // Initialisation des tests de fonctionnalités
    initializeFeatureTests() {
        this.browserFeatures.set('ES6+', {
            name: 'ECMAScript 2015+',
            tests: {
                'Arrow Functions': () => {
                    try {
                        eval('() => {}');
                        return true;
                    } catch (e) {
                        if (!this.polyfillsManager.loadPolyfill('arrowFunctions')) {
                            return false;
                        }
                        return true;
                    }
                },
                'Promises': () => {
                    const hasPromise = typeof Promise !== 'undefined';
                    if (!hasPromise) {
                        return this.polyfillsManager.loadPolyfill('Promise');
                    }
                    return true;
                },
                'Async/Await': () => {
                    try {
                        eval('async () => {}');
                        return true;
                    } catch (e) {
                        if (!this.polyfillsManager.loadPolyfill('asyncAwait')) {
                            return false;
                        }
                        return true;
                    }
                },
                'Classes': () => {
                    try {
                        eval('class Test {}');
                        return true;
                    } catch (e) {
                        if (!this.polyfillsManager.loadPolyfill('classes')) {
                            return false;
                        }
                        return true;
                    }
                }
            }
        });

        this.browserFeatures.set('WebAPIs', {
            name: 'Modern Web APIs',
            tests: {
                'Fetch': () => {
                    const hasFetch = typeof fetch !== 'undefined';
                    if (!hasFetch) {
                        return this.polyfillsManager.loadPolyfill('fetch');
                    }
                    return true;
                },
                'WebSocket': () => typeof WebSocket !== 'undefined',
                'WebWorkers': () => typeof Worker !== 'undefined',
                'ServiceWorker': () => 'serviceWorker' in navigator,
                'WebGL': () => {
                    try {
                        const canvas = document.createElement('canvas');
                        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
                    } catch (e) {
                        return false;
                    }
                }
            }
        });

        this.browserFeatures.set('CSS', {
            name: 'Modern CSS Features',
            tests: {
                'Grid': () => this.testCSSProperty('grid'),
                'Flexbox': () => this.testCSSProperty('flex'),
                'CSS Variables': () => this.testCSSProperty('--test'),
                'Transform': () => this.testCSSProperty('transform'),
                'Animation': () => this.testCSSProperty('animation')
            }
        });

        this.browserFeatures.set('HTML5', {
            name: 'HTML5 Features',
            tests: {
                'Canvas': () => {
                    const canvas = document.createElement('canvas');
                    return !!(canvas.getContext && canvas.getContext('2d'));
                },
                'Video': () => !!document.createElement('video').canPlayType,
                'LocalStorage': () => {
                    try {
                        return 'localStorage' in window && window['localStorage'] !== null;
                    } catch (e) {
                        return false;
                    }
                },
                'WebComponents': () => {
                    const hasWebComponents = 'customElements' in window && 
                        'attachShadow' in Element.prototype && 
                        'getRootNode' in Element.prototype;
                    if (!hasWebComponents) {
                        return this.polyfillsManager.loadPolyfill('webComponents');
                    }
                    return true;
                },
                'Array.from': () => {
                    const hasArrayFrom = typeof Array.from === 'function';
                    if (!hasArrayFrom) {
                        return this.polyfillsManager.loadPolyfill('Array.from');
                    }
                    return true;
                }
            }
        });
    }

    // Test de propriété CSS
    testCSSProperty(property) {
        const element = document.createElement('div');
        return property in element.style;
    }

    // Détection du navigateur
    detectBrowser() {
        const userAgent = navigator.userAgent;
        let browser = {
            name: 'unknown',
            version: 'unknown',
            engine: 'unknown'
        };

        // Chrome
        if (/Chrome/.test(userAgent) && !/Edge/.test(userAgent)) {
            browser.name = 'Chrome';
            browser.version = userAgent.match(/Chrome\/(\d+)/)[1];
            browser.engine = 'Blink';
        }
        // Firefox
        else if (/Firefox/.test(userAgent)) {
            browser.name = 'Firefox';
            browser.version = userAgent.match(/Firefox\/(\d+)/)[1];
            browser.engine = 'Gecko';
        }
        // Safari
        else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) {
            browser.name = 'Safari';
            browser.version = userAgent.match(/Version\/(\d+)/)[1];
            browser.engine = 'WebKit';
        }
        // Edge (Chromium)
        else if (/Edg/.test(userAgent)) {
            browser.name = 'Edge';
            browser.version = userAgent.match(/Edg\/(\d+)/)[1];
            browser.engine = 'Blink';
        }

        return browser;
    }

    // Vérification des fonctionnalités avec gestion des polyfills
    checkFeatures() {
        const results = new Map();
        
        this.browserFeatures.forEach((category, categoryKey) => {
            const categoryResults = {
                name: category.name,
                supported: [],
                unsupported: [],
                polyfilled: []
            };

            Object.entries(category.tests).forEach(([feature, test]) => {
                if (test()) {
                    if (this.polyfillsManager.loadedPolyfills.has(feature)) {
                        categoryResults.polyfilled.push(feature);
                    } else {
                        categoryResults.supported.push(feature);
                    }
                } else {
                    categoryResults.unsupported.push(feature);
                    this.warnings.push(`${feature} n'est pas supporté dans ce navigateur`);
                }
            });

            results.set(categoryKey, categoryResults);
        });

        return results;
    }

    // Vérification de la compatibilité générale
    checkCompatibility() {
        const browser = this.detectBrowser();
        const features = this.checkFeatures();
        
        return {
            browser,
            features,
            warnings: this.warnings,
            recommendations: this.generateRecommendations(browser, features),
            polyfills: Array.from(this.polyfillsManager.loadedPolyfills)
        };
    }

    // Génération des recommandations
    generateRecommendations(browser, features) {
        const recommendations = [];

        // Recommandations basées sur le navigateur
        if (browser.name === 'Chrome' && parseInt(browser.version) < 85) {
            recommendations.push('Mise à jour de Chrome recommandée pour de meilleures performances');
        }
        if (browser.name === 'Firefox' && parseInt(browser.version) < 80) {
            recommendations.push('Mise à jour de Firefox recommandée pour une meilleure sécurité');
        }
        if (browser.name === 'Safari' && parseInt(browser.version) < 14) {
            recommendations.push('Mise à jour de Safari recommandée pour un meilleur support des standards web');
        }

        // Recommandations basées sur les fonctionnalités manquantes
        features.forEach((category) => {
            if (category.unsupported.length > 0) {
                recommendations.push(`Fonctionnalités ${category.name} non supportées : ${category.unsupported.join(', ')}`);
            }
            if (category.polyfilled.length > 0) {
                recommendations.push(`Fonctionnalités ${category.name} supportées via polyfill : ${category.polyfilled.join(', ')}`);
            }
        });

        return recommendations;
    }

    // Vérification de la sécurité du navigateur
    checkSecurity() {
        return {
            httpsSupport: window.location.protocol === 'https:',
            contentSecurityPolicy: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
            cookieSecure: navigator.cookieEnabled,
            webCrypto: typeof window.crypto !== 'undefined' && typeof window.crypto.subtle !== 'undefined'
        };
    }

    // Génération du rapport complet
    generateReport() {
        const compatibility = this.checkCompatibility();
        const security = this.checkSecurity();
        
        return {
            browserInfo: compatibility.browser,
            featureSupport: compatibility.features,
            security,
            warnings: compatibility.warnings,
            recommendations: compatibility.recommendations,
            polyfillsLoaded: Array.from(this.polyfillsManager.loadedPolyfills)
        };
    }
}

// Utilitaires pour la compatibilité navigateur
const BrowserCompatUtils = {
    // Détection du support des fonctionnalités spécifiques
    detectFeature(feature) {
        const features = {
            webp: () => {
                const canvas = document.createElement('canvas');
                if (canvas.getContext && canvas.getContext('2d')) {
                    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
                }
                return false;
            },
            webgl: () => {
                try {
                    const canvas = document.createElement('canvas');
                    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
                } catch (e) {
                    return false;
                }
            },
            webrtc: () => {
                return navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
            }
        };

        return features[feature] ? features[feature]() : false;
    },

    // Polyfill conditionnel utilisant PolyfillUtils
    conditionalPolyfill(feature, polyfill) {
        return PolyfillUtils.checkSupport(feature) || polyfill();
    }
};

// Export des utilitaires
export {
    ModernBrowserChecker,
    BrowserCompatUtils
};

// Exemple d'utilisation avec gestion des polyfills
function checkBrowserCompatibility() {
    const checker = new ModernBrowserChecker();
    // Charger d'abord les polyfills nécessaires
    checker.polyfillsManager.loadAllPolyfills();
    // Générer ensuite le rapport
    const report = checker.generateReport();
    console.log('Browser Compatibility Report:', report);
    return report;
}