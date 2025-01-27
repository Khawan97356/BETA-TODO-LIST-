 // === ES6+ SUPPORT CHECKER === //

class ES6PlusSupportChecker {
    constructor() {
        this.features = new Map();
        this.initializeFeatures();
    }

    // Initialisation des tests de fonctionnalités ES6+
    initializeFeatures() {
        // ES6 (ES2015) Features
        this.features.set('ES6', {
            'Let/Const': () => {
                try {
                    eval('let a = 1; const b = 2;');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'Arrow Functions': () => {
                try {
                    eval('(() => {})()');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'Classes': () => {
                try {
                    eval('class Test { constructor() {} }');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'Template Literals': () => {
                try {
                    eval('test ${1}');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'Destructuring': () => {
                try {
                    eval('const { a } = { a: 1 }');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'Default Parameters': () => {
                try {
                    eval('(function(a = 1) {})()');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'Rest/Spread': () => {
                try {
                    eval('const [...a] = [1,2,3]');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'Map/Set': () => {
                return typeof Map === 'function' && typeof Set === 'function';
            },
            'Promise': () => {
                return typeof Promise === 'function';
            }
        });

        // ES7 (ES2016) Features
        this.features.set('ES7', {
            'Array.includes': () => {
                return Array.prototype.includes !== undefined;
            },
            'Exponentiation': () => {
                try {
                    eval('2 ** 3');
                    return true;
                } catch (e) {
                    return false;
                }
            }
        });

        // ES8 (ES2017) Features
        this.features.set('ES8', {
            'Async/Await': () => {
                try {
                    eval('async () => await Promise.resolve()');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'Object.values': () => {
                return typeof Object.values === 'function';
            },
            'Object.entries': () => {
                return typeof Object.entries === 'function';
            },
            'String Padding': () => {
                return String.prototype.padStart !== undefined && 
                       String.prototype.padEnd !== undefined;
            }
        });

        // ES9 (ES2018) Features
        this.features.set('ES9', {
            'Rest/Spread Properties': () => {
                try {
                    eval('const {...obj} = {a: 1}');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'Promise.finally': () => {
                return Promise.prototype.finally !== undefined;
            },
            'Regex Named Groups': () => {
                try {
                    eval('/(?<year>\\d{4})/');
                    return true;
                } catch (e) {
                    return false;
                }
            }
        });

        // ES10 (ES2019) Features
        this.features.set('ES10', {
            'Array.flat': () => {
                return Array.prototype.flat !== undefined;
            },
            'Array.flatMap': () => {
                return Array.prototype.flatMap !== undefined;
            },
            'Object.fromEntries': () => {
                return typeof Object.fromEntries === 'function';
            },
            'String.trimStart': () => {
                return String.prototype.trimStart !== undefined;
            }
        });

        // ES11 (ES2020) Features
        this.features.set('ES11', {
            'Optional Chaining': () => {
                try {
                    eval('const obj = {}; obj?.prop');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'Nullish Coalescing': () => {
                try {
                    eval('const x = null ?? "default"');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'BigInt': () => {
                return typeof BigInt === 'function';
            },
            'Promise.allSettled': () => {
                return typeof Promise.allSettled === 'function';
            }
        });
    }

    // Vérification des fonctionnalités
    checkFeatures() {
        const results = new Map();
        
        this.features.forEach((versionFeatures, version) => {
            const versionResults = {
                supported: [],
                unsupported: []
            };

            Object.entries(versionFeatures).forEach(([feature, test]) => {
                if (test()) {
                    versionResults.supported.push(feature);
                } else {
                    versionResults.unsupported.push(feature);
                }
            });

            results.set(version, versionResults);
        });

        return results;
    }

    // Analyse de la compatibilité
    analyzeCompatibility() {
        const results = this.checkFeatures();
        const analysis = {
            summary: {},
            recommendations: [],
            compatibility: {}
        };

        results.forEach((versionResults, version) => {
            const total = versionResults.supported.length + versionResults.unsupported.length;
            const supportPercentage = (versionResults.supported.length / total) * 100;

            analysis.summary[version] = {
                supported: versionResults.supported.length,
                unsupported: versionResults.unsupported.length,
                percentage: supportPercentage.toFixed(2) + '%'
            };

            if (versionResults.unsupported.length > 0) {
                analysis.recommendations.push(
                    Consider using transpilation for ${version} features: ${versionResults.unsupported.join(', ')}
                );
            }

            analysis.compatibility[version] = {
                supported: versionResults.supported,
                unsupported: versionResults.unsupported
            };
        });

        return analysis;
    }

    // Génération d'un rapport de compatibilité
    generateReport() {
        const analysis = this.analyzeCompatibility();
        return {
            overview: {
                timestamp: new Date().toISOString(),
                environmentInfo: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform
                }
            },
            analysis: analysis,
            recommendations: this.generateRecommendations(analysis)
        };
    }

    // Génération de recommandations spécifiques
    generateRecommendations(analysis) {
        const recommendations = [];

        if (analysis.recommendations.length > 0) {
            recommendations.push({
                type: 'Transpilation',
                message: 'Consider using Babel or similar tools for better browser compatibility',
                features: analysis.recommendations
            });
        }

        const es6Support = analysis.summary.ES6;
        if (es6Support && es6Support.percentage < 100) {
            recommendations.push({
                type: 'Polyfills',
                message: 'Consider using core-js or similar polyfills for missing ES6+ features',
                impact: 'High'
            });
        }

        return recommendations;
    }
}

// Utilitaires pour ES6+ Support
const ES6Utils = {
    // Vérification de fonctionnalité spécifique
    checkFeature(feature) {
        const features = {
            'async/await': () => {
                try {
                    eval('async () => await Promise.resolve()');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'modules': () => {
                try {
                    new Function('import("")');
                    return true;
                } catch (e) {
                    return false;
                }
            },
            'decorators': () => {
                try {
                    eval('@decorator class Test {}');
                    return true;
                } catch (e) {
                    return false;
                }
            }
        };

        return features[feature] ? features[feature]() : false;
    },

    // Suggestion de polyfills
    suggestPolyfills(missingFeatures) {
        const suggestions = new Map();
        
        missingFeatures.forEach(feature => {
            switch(feature) {
                case 'Promise':
                    suggestions.set(feature, 'core-js/features/promise');
                    break;
                case 'Map':
                    suggestions.set(feature, 'core-js/features/map');
                    break;
                case 'Set':
                    suggestions.set(feature, 'core-js/features/set');
                    break;
                // Ajoutez d'autres suggestions selon les besoins
            }
        });

        return suggestions;
    }
};

// Export des utilitaires
export {
    ES6PlusSupportChecker,
    ES6Utils
};

// Exemple d'utilisation
function checkES6Support() {
    const checker = new ES6PlusSupportChecker();
    const report = checker.generateReport();
    console.log('ES6+ Support Report:', report);
    return report;
}

// Vérifier le support ES6+
// const report = checkES6Support();

// Vérifier une fonctionnalité spécifique
// if (!ES6Utils.checkFeature('async/await')) {
    // console.warn('async/await not supported in this browser');
// }