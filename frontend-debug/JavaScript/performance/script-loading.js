// === SCRIPT LOADING PERFORMANCE ANALYZER === //

class ScriptLoadAnalyzer {
    constructor() {
        this.metrics = new Map();
        this.resourceTimings = [];
        this.initializeObservers();
    }

    // Initialisation des observateurs
    initializeObservers() {
        // Observer de performance
        this.performanceObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach(entry => {
                if (entry.entryType === 'resource' && entry.initiatorType === 'script') {
                    this.resourceTimings.push(this.analyzeResourceTiming(entry));
                }
            });
        });

        try {
            this.performanceObserver.observe({ entryTypes: ['resource'] });
        } catch (e) {
            console.warn('PerformanceObserver not supported:', e);
        }
    }

    // Analyse du timing de chargement d'un script
    analyzeResourceTiming(entry) {
        return {
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            timing: {
                dns: entry.domainLookupEnd - entry.domainLookupStart,
                tcp: entry.connectEnd - entry.connectStart,
                request: entry.responseStart - entry.requestStart,
                response: entry.responseEnd - entry.responseStart,
            },
            size: entry.transferSize,
            compression: entry.transferSize ? 
                ((1 - entry.transferSize / entry.decodedBodySize) * 100).toFixed(2) + '%' : 
                'N/A'
        };
    }

    // Analyse des attributs de script
    analyzeScriptAttributes(scriptElement) {
        return {
            async: scriptElement.hasAttribute('async'),
            defer: scriptElement.hasAttribute('defer'),
            type: scriptElement.type || 'text/javascript',
            src: scriptElement.src || 'inline',
            position: this.getScriptPosition(scriptElement),
            crossOrigin: scriptElement.crossOrigin,
            integrity: scriptElement.integrity
        };
    }

    // Déterminer la position du script dans le document
    getScriptPosition(scriptElement) {
        const scripts = Array.from(document.getElementsByTagName('script'));
        const index = scripts.indexOf(scriptElement);
        
        if (scriptElement.parentNode === document.head) {
            return head (${index});
        } else if (scriptElement.parentNode === document.body) {
            return body (${index});
        }
        return other (${index});
    }

    // Analyse des dépendances
    analyzeDependencies() {
        const scripts = Array.from(document.getElementsByTagName('script'));
        const dependencies = new Map();

        scripts.forEach(script => {
            if (script.src) {
                const content = this.fetchScriptContent(script.src);
                dependencies.set(script.src, this.detectDependencies(content));
            }
        });

        return dependencies;
    }

    // Détection des dépendances dans le contenu du script
    detectDependencies(content) {
        const deps = {
            imports: [],
            requires: [],
            globalVars: []
        };

        // Analyse des imports ES6
        const importRegex = /import .+ from ['"](.+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            deps.imports.push(match[1]);
        }

        // Analyse des requires
        const requireRegex = /require\(['"](.+)['"]\)/g;
        while ((match = requireRegex.exec(content)) !== null) {
            deps.requires.push(match[1]);
        }

        // Analyse des variables globales
        const globalVarRegex = /window\.(\w+)/g;
        while ((match = globalVarRegex.exec(content)) !== null) {
            deps.globalVars.push(match[1]);
        }

        return deps;
    }

    // Récupération asynchrone du contenu du script
    async fetchScriptContent(url) {
        try {
            const response = await fetch(url);
            return await response.text();
        } catch (e) {
            console.warn(Could not fetch script content from ${url}:, e);
            return '';
        }
    }

    // Génération de recommandations
    generateRecommendations() {
        const recommendations = [];
        const scripts = Array.from(document.getElementsByTagName('script'));

        // Vérification de la position des scripts
        const bodyScripts = scripts.filter(s => s.parentNode === document.body);
        if (bodyScripts.length > 0) {
            recommendations.push({
                type: 'position',
                severity: 'medium',
                message: 'Consider moving non-critical scripts to the end of the body'
            });
        }

        // Vérification des attributs async/defer
        const synchronousScripts = scripts.filter(s => !s.async && !s.defer);
        if (synchronousScripts.length > 0) {
            recommendations.push({
                type: 'loading',
                severity: 'high',
                message: 'Use async or defer for non-critical scripts'
            });
        }

        // Vérification de la taille des scripts
        this.resourceTimings.forEach(timing => {
            if (timing.size > 50000) { // 50KB
                recommendations.push({
                    type: 'size',
                    severity: 'medium',
                    message: Large script detected (${timing.name}): Consider splitting or lazy loading
                });
            }
        });

        return recommendations;
    }

    // Génération du rapport complet
    generateReport() {
        return {
            scriptsAnalysis: Array.from(document.getElementsByTagName('script')).map(script => ({
                attributes: this.analyzeScriptAttributes(script),
                timing: this.resourceTimings.find(t => t.name === script.src) || null
            })),
            recommendations: this.generateRecommendations(),
            dependencies: this.analyzeDependencies(),
            metrics: {
                totalScripts: document.getElementsByTagName('script').length,
                totalSize: this.resourceTimings.reduce((acc, curr) => acc + (curr.size || 0), 0),
                averageLoadTime: this.resourceTimings.reduce((acc, curr) => acc + curr.duration, 0) / 
                    this.resourceTimings.length || 0
            }
        };
    }
}

// Utilitaire pour optimiser le chargement des scripts
const ScriptLoadOptimizer = {
    // Chargement dynamique de script
    loadScript(url, options = {}) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            
            if (options.async) script.async = true;
            if (options.defer) script.defer = true;
            if (options.module) script.type = 'module';
            if (options.crossOrigin) script.crossOrigin = options.crossOrigin;
            if (options.integrity) script.integrity = options.integrity;

            script.onload = resolve;
            script.onerror = reject;

            (options.parent || document.body).appendChild(script);
        });
    },

    // Préchargement de script
    preloadScript(url) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'script';
        link.href = url;
        document.head.appendChild(link);
    },

    // Chargement conditionnel
    loadScriptConditionally(url, condition) {
        if (condition()) {
            return this.loadScript(url);
        }
        return Promise.resolve(null);
    }
};

// Export des utilitaires
export {
    ScriptLoadAnalyzer,
    ScriptLoadOptimizer
};

// Exemple d'utilisation
function analyzeScriptLoading() {
    const analyzer = new ScriptLoadAnalyzer();
    const report = analyzer.generateReport();
    console.log('Script Loading Analysis:', report);
    return report;
}

// Analyser le chargement des scripts
// const analyzer = new ScriptLoadAnalyzer();
// const report = analyzer.generateReport();

// Charger un script de manière optimisée
//ScriptLoadOptimizer.loadScript('script.js', {
    // async: true,
    // defer: true
// }).then(() => {
    // console.log('Script loaded successfully');
// });