// DOM EVENTS DEBUGGING TOOLKIT === //
// code-optimization.js dépend de
import { ... } from '../compatibility/es6-support.js';


// === CODE OPTIMIZATION ANALYZER === //

class CodeOptimizer {
    constructor() {
        this.metrics = new Map();
        this.patterns = new Map();
        this.initializePatterns();
    }

    // Initialisation des patterns à détecter
    initializePatterns() {
        this.patterns.set('loopOptimization', {
            test: /for\s*\([^)]+\)/g,
            analyze: this.analyzeLoops.bind(this)
        });
        
        this.patterns.set('domCaching', {
            test: /document\.querySelector|document\.getElementById/g,
            analyze: this.analyzeDOMQueries.bind(this)
        });
        
        this.patterns.set('eventDelegation', {
            test: /addEventListener\(/g,
            analyze: this.analyzeEventListeners.bind(this)
        });
        
        this.patterns.set('functionComplexity', {
            test: /function\s+\w+\s*\([^)]\)\s{/g,
            analyze: this.analyzeFunctionComplexity.bind(this)
        });
    }

    // Analyse des boucles
    analyzeLoops(code) {
        const issues = [];
        const loops = code.match(this.patterns.get('loopOptimization').test) || [];
        
        loops.forEach(loop => {
            // Vérifier la longueur du tableau dans la condition
            if (loop.includes('.length')) {
                issues.push({
                    type: 'loop-length-caching',
                    severity: 'medium',
                    message: 'Cache array length outside loop for better performance',
                    suggestion: 'const len = array.length; for(let i = 0; i < len; i++)'
                });
            }

            // Vérifier l'utilisation de break/continue
            if (code.includes('break') || code.includes('continue')) {
                issues.push({
                    type: 'loop-break-continue',
                    severity: 'low',
                    message: 'Consider using array methods instead of break/continue',
                    suggestion: 'Use .filter(), .map(), .some(), or .every()'
                });
            }
        });

        return issues;
    }

    // Analyse des requêtes DOM
    analyzeDOMQueries(code) {
        const issues = [];
        const queries = code.match(this.patterns.get('domCaching').test) || [];
        
        if (queries.length > 3) {
            issues.push({
                type: 'dom-query-frequency',
                severity: 'high',
                message: 'Multiple DOM queries detected. Consider caching elements',
                suggestion: 'const element = document.querySelector(...); // Use element multiple times'
            });
        }

        return issues;
    }

    // Analyse des event listeners
    analyzeEventListeners(code) {
        const issues = [];
        const listeners = code.match(this.patterns.get('eventDelegation').test) || [];
        
        if (listeners.length > 5) {
            issues.push({
                type: 'event-delegation',
                severity: 'medium',
                message: 'Multiple event listeners detected. Consider event delegation',
                suggestion: 'Use parent.addEventListener and event.target'
            });
        }

        return issues;
    }

    // Analyse de la complexité des fonctions
    analyzeFunctionComplexity(code) {
        const issues = [];
        
        // Analyse de la profondeur des imbrications
        const nestingDepth = (code.match(/{/g) || []).length;
        if (nestingDepth > 4) {
            issues.push({
                type: 'function-complexity',
                severity: 'high',
                message: 'High function complexity detected',
                suggestion: 'Break down into smaller functions'
            });
        }

        return issues;
    }

    // Analyse de la performance du code
    analyzePerformance(code) {
        const startTime = performance.now();
        try {
            // Exécution sécurisée du code
            new Function(code);
        } catch (e) {
            console.warn('Code execution failed:', e);
        }
        const endTime = performance.now();

        return {
            executionTime: endTime - startTime,
            memoryUsage: this.getMemoryUsage()
        };
    }

    // Récupération de l'utilisation mémoire
    getMemoryUsage() {
        if (window.performance && window.performance.memory) {
            return {
                totalHeapSize: window.performance.memory.totalJSHeapSize,
                usedHeapSize: window.performance.memory.usedJSHeapSize
            };
        }
        return null;
    }

    // Optimisation automatique du code
    optimizeCode(code) {
        let optimizedCode = code;

        // Optimisation des boucles
        optimizedCode = this.optimizeLoops(optimizedCode);
        
        // Optimisation des requêtes DOM
        optimizedCode = this.optimizeDOMQueries(optimizedCode);
        
        // Optimisation des event listeners
        optimizedCode = this.optimizeEventListeners(optimizedCode);

        return optimizedCode;
    }

    // Optimisation des boucles
    optimizeLoops(code) {
        return code.replace(
            /for\s*\(let i = 0;\s*i < array\.length;\s*i\+\+\)/g,
            'for(let i = 0, len = array.length; i < len; i++)'
        );
    }

    // Optimisation des requêtes DOM
    optimizeDOMQueries(code) {
        // Détection des requêtes DOM répétées
        const queries = new Set();
        const queryRegex = /document\.querySelector\(['"](.*?)['"]\)/g;
        let match;
        
        while ((match = queryRegex.exec(code)) !== null) {
            queries.add(match[1]);
        }

        // Ajout de variables pour le caching
        let optimizedCode = code;
        queries.forEach(query => {
            const varName = $${query.replace(/[^a-zA-Z]/g, '')};
            optimizedCode = const ${varName} = document.querySelector('${query}');\n${optimizedCode};
            optimizedCode = optimizedCode.replace(
                new RegExp(document\\.querySelector\\(['"]${query}['"]\), 'g'),
                varName
            );
        });

        return optimizedCode;
    }

    // Optimisation des event listeners
    optimizeEventListeners(code) {
        // Remplacement des listeners multiples par de la délégation
        return code.replace(
            /(\w+)\.addEventListener\('(\w+)',\s*function/g,
            'document.addEventListener(\'$2\', function(e) { if(e.target.matches(\'$1\'))'
        );
    }

    // Génération du rapport d'optimisation
    generateReport(code) {
        const issues = [];
        
        // Analyse avec tous les patterns
        this.patterns.forEach((pattern, name) => {
            const patternIssues = pattern.analyze(code);
            issues.push(...patternIssues);
        });

        // Analyse de performance
        const performance = this.analyzePerformance(code);

        return {
            issues,
            performance,
            suggestions: this.generateSuggestions(issues),
            optimizedCode: this.optimizeCode(code)
        };
    }

    // Génération des suggestions d'optimisation
    generateSuggestions(issues) {
        const suggestions = new Set();
        
        issues.forEach(issue => {
            if (issue.severity === 'high') {
                suggestions.add(issue.suggestion);
            }
        });

        return Array.from(suggestions);
    }
}

// Utilitaires d'optimisation
const OptimizationUtils = {
    // Debounce pour les fonctions appelées fréquemment
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle pour limiter la fréquence d'appel
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Memoization pour les fonctions pures
    memoize(fn) {
        const cache = new Map();
        return (...args) => {
            const key = JSON.stringify(args);
            if (cache.has(key)) return cache.get(key);
            const result = fn.apply(this, args);
            cache.set(key, result);
            return result;
        };
    }
};

// Export des utilitaires
export {
    CodeOptimizer,
    OptimizationUtils
};

// Exemple d'utilisation
function analyzeCodeOptimization(code) {
    const optimizer = new CodeOptimizer();
    const report = optimizer.generateReport(code);
    console.log('Code Optimization Report:', report);
    return report;
}

// Analyser et optimiser du code
// const optimizer = new CodeOptimizer();
// const code = `
    // for(let i = 0; i < array.length; i++) {
       //  document.querySelector('.item').innerHTML += array[i];
    // }
// `;
// const report = optimizer.generateReport(code);
// console.log(report.optimizedCode);

// Utiliser les utilitaires d'optimisation
// const debouncedFn = OptimizationUtils.debounce(() => {
    // Code à exécuter
// }, 250);