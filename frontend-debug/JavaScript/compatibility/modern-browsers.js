// DOM EVENTS DEBUGGING TOOLKIT === //
// modern-browsers.js dépend de
import { PolyfillsManager, PolyfillUtils } from './polyfills.js';


// === MODERN BROWSER COMPATIBILITY CHECKER === //

class ModernBrowserChecker {
    constructor() {
        this.browserFeatures = new Map();
        this.warnings = [];
        this.polyfillsManager = new PolyfillsManager();
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
                        return false;
                    }
                },
                'Promises': () => typeof Promise !== 'undefined',
                'Async/Await': () => {
                    try {
                        eval('async () => {}');
                        return true;
                    } catch (e) {
                        return false;
                    }
                },
                'Classes': () => {
                    try {
                        eval('class Test {}');
                        return true;
                    } catch (e) {
                        return false;
                    }
                }
            }
        });

        this.browserFeatures.set('WebAPIs', {
            name: 'Modern Web APIs',
            tests: {
                'Fetch': () => typeof fetch !== 'undefined',
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
                    return 'customElements' in window && 
                           'attachShadow' in Element.prototype && 
                           'getRootNode' in Element.prototype;
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

    // Vérification des fonctionnalités
    checkFeatures() {
        const results = new Map();
        
        this.browserFeatures.forEach((category, categoryKey) => {
            const categoryResults = {
                name: category.name,
                supported: [],
                unsupported: []
            };

            Object.entries(category.tests).forEach(([feature, test]) => {
                if (test()) {
                    categoryResults.supported.push(feature);
                } else {
                    categoryResults.unsupported.push(feature);
                    this.warnings.push("${feature} n'est pas supporté dans ce navigateur");

                    PolyfillUtils.loadPolyfill(feature);
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
            recommendations: this.generateRecommendations(browser, features)
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
                recommendations.push(Fonctionnalités ${category.name} non supportées : ${category.unsupported.join(', ')});
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
            polyfillsStatus: PolyfillUtils.getPolyfillsStatus()
        };
    }
}

// Utilitaires pour la compatibilité navigateur
const BrowserCompatUtils = {
    // Détection du support des fonctionnalités spécifiques
    detectFeature(feature) {
        if (PolyfillUtils.isPolyfilled(feature)) {
            return true;
        }
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

    // Polyfill conditionnel
    conditionalPolyfill(feature, polyfill) {
        if (!this.detectFeature(feature)) {
            return PolyfillUtils.applyPolyfill(feature, polyfill);
        }
        return true;
    }
};

// Export des utilitaires
export {
    ModernBrowserChecker,
    BrowserCompatUtils
};

// Exemple d'utilisation
function checkBrowserCompatibility() {
    const checker = new ModernBrowserChecker();
    const report = checker.generateReport();
    console.log('Browser Compatibility Report:', report);
    return report;
}

// Vérifier la compatibilité du navigateur
//const checker = new ModernBrowserChecker();
//const report = checker.generateReport();

// Utiliser les utilitaires
//const hasWebP = BrowserCompatUtils.detectFeature('webp');
//if (!hasWebP) {
    // Fallback pour les navigateurs sans support WebP
//}