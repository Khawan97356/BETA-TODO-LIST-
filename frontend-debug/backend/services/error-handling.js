// error-handling.js
import { logError } from './logging.js';

// Types d'erreurs standardisés
const ERROR_TYPES = {
    VALIDATION: 'VALIDATION_ERROR',
    STORAGE: 'STORAGE_ERROR',
    INTEGRITY: 'INTEGRITY_ERROR',
    SYNC: 'SYNC_ERROR',
    SYSTEM: 'SYSTEM_ERROR',
    NETWORK: 'NETWORK_ERROR',
    TIMEOUT: 'TIMEOUT_ERROR',
    AUTH: 'AUTHENTICATION_ERROR',
    NOT_FOUND: 'NOT_FOUND_ERROR',
    SERVER: 'SERVER_ERROR'
};

// Niveaux de sévérité
const ERROR_SEVERITY = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
};

// Fonction principale d'export pour la gestion des erreurs
export const handleError = (error, context = {}) => {
    const errorService = errorHandlingService();
    return errorService.handleError(error, context);
};

function errorHandlingService() {
    // Gestionnaire principal des erreurs
    function handleError(error, context = {}) {
        try {
            const errorDetails = analyzeError(error);
            const enrichedError = enrichErrorData(errorDetails, context);
            
            // Utilisation du nouveau système de logging
            logError(enrichedError, context);

            // Notification du système de monitoring
            notifyMonitor(enrichedError);

            // Tentative de récupération
            const recovery = attemptRecovery(enrichedError);

            return formatErrorResponse(enrichedError, recovery);
        } catch (handlingError) {
            // En cas d'échec du traitement de l'erreur
            console.error('Error handling failed:', handlingError);
            return createFallbackError(error);
        }
    }

    // Analyse détaillée de l'erreur
    function analyzeError(error) {
        return {
            type: determineErrorType(error),
            message: error.message || 'Unknown error occurred',
            stack: error.stack,
            severity: calculateSeverity(error),
            timestamp: new Date().toISOString(),
            fingerprint: generateErrorFingerprint(error)
        };
    }

    // Détermination du type d'erreur
    function determineErrorType(error) {
        if (!error) return ERROR_TYPES.SYSTEM;

        // Vérification du type d'erreur par nom
        const errorTypeMap = {
            QuotaExceededError: ERROR_TYPES.STORAGE,
            SecurityError: ERROR_TYPES.SYSTEM,
            SyntaxError: ERROR_TYPES.VALIDATION,
            NetworkError: ERROR_TYPES.NETWORK,
            TimeoutError: ERROR_TYPES.TIMEOUT,
            AuthenticationError: ERROR_TYPES.AUTH,
            NotFoundError: ERROR_TYPES.NOT_FOUND
        };

        if (error.name && errorTypeMap[error.name]) {
            return errorTypeMap[error.name];
        }

        // Analyse du message d'erreur
        const message = (error.message || '').toLowerCase();
        const messagePatterns = {
            'storage': ERROR_TYPES.STORAGE,
            'validation': ERROR_TYPES.VALIDATION,
            'integrity': ERROR_TYPES.INTEGRITY,
            'sync': ERROR_TYPES.SYNC,
            'network': ERROR_TYPES.NETWORK,
            'timeout': ERROR_TYPES.TIMEOUT,
            'auth': ERROR_TYPES.AUTH,
            'not found': ERROR_TYPES.NOT_FOUND,
            'server': ERROR_TYPES.SERVER
        };

        for (const [pattern, type] of Object.entries(messagePatterns)) {
            if (message.includes(pattern)) return type;
        }

        return ERROR_TYPES.SYSTEM;
    }

    // Calcul de la sévérité de l'erreur
    function calculateSeverity(error) {
        const severityMap = {
            [ERROR_TYPES.VALIDATION]: ERROR_SEVERITY.LOW,
            [ERROR_TYPES.STORAGE]: ERROR_SEVERITY.MEDIUM,
            [ERROR_TYPES.INTEGRITY]: ERROR_SEVERITY.HIGH,
            [ERROR_TYPES.SYNC]: ERROR_SEVERITY.MEDIUM,
            [ERROR_TYPES.SYSTEM]: ERROR_SEVERITY.HIGH,
            [ERROR_TYPES.NETWORK]: ERROR_SEVERITY.MEDIUM,
            [ERROR_TYPES.TIMEOUT]: ERROR_SEVERITY.LOW,
            [ERROR_TYPES.AUTH]: ERROR_SEVERITY.HIGH,
            [ERROR_TYPES.NOT_FOUND]: ERROR_SEVERITY.LOW,
            [ERROR_TYPES.SERVER]: ERROR_SEVERITY.HIGH
        };

        const type = determineErrorType(error);
        return severityMap[type] || ERROR_SEVERITY.MEDIUM;
    }

    // Enrichissement des données d'erreur
    function enrichErrorData(error, context) {
        return {
            ...error,
            context: {
                ...context,
                url: window.location.href,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            },
            system: {
                storage: getStorageState(),
                performance: getPerformanceMetrics()
            }
        };
    }

    // Obtention de l'état du stockage
    function getStorageState() {
        try {
            return {
                quotaUsed: calculateStorageUsage(),
                availableSpace: estimateAvailableSpace(),
                keys: Object.keys(localStorage).length
            };
        } catch (error) {
            return { error: 'Unable to get storage state' };
        }
    }

    // Métriques de performance
    function getPerformanceMetrics() {
        if (!window.performance) return null;
        
        return {
            memory: performance.memory ? {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize
            } : null,
            timing: {
                loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
                domReady: performance.timing.domComplete - performance.timing.domLoading
            }
        };
    }

    // Notification du moniteur
    function notifyMonitor(error) {
        const event = new CustomEvent('error_monitor', {
            detail: {
                type: 'error_occurred',
                error,
                timestamp: new Date().toISOString()
            }
        });
        window.dispatchEvent(event);
    }

    // Tentative de récupération
    function attemptRecovery(error) {
        const recoveryStrategies = {
            [ERROR_TYPES.STORAGE]: cleanupStorage,
            [ERROR_TYPES.INTEGRITY]: repairDataIntegrity,
            [ERROR_TYPES.SYNC]: resyncData
        };

        const strategy = recoveryStrategies[error.type];
        if (strategy) {
            try {
                return strategy();
            } catch (recoveryError) {
                return {
                    success: false,
                    error: recoveryError.message
                };
            }
        }

        return {
            success: false,
            reason: 'No recovery strategy available'
        };
    }

    // Stratégies de récupération
    function cleanupStorage() {
        const nonEssentialKeys = Object.keys(localStorage)
            .filter(key => !key.startsWith('essential_'));
        
        nonEssentialKeys.forEach(key => localStorage.removeItem(key));
        return { success: true, action: 'storage_cleaned' };
    }

    function repairDataIntegrity() {
        const corruptedData = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            try {
                JSON.parse(localStorage.getItem(key));
            } catch {
                corruptedData.push(key);
            }
        }

        corruptedData.forEach(key => localStorage.removeItem(key));
        return {
            success: true,
            repairedItems: corruptedData.length
        };
    }

    function resyncData() {
        window.dispatchEvent(new CustomEvent('storage_sync_required'));
        return { success: true, action: 'sync_triggered' };
    }

    // Formatage de la réponse d'erreur
    function formatErrorResponse(error, recovery) {
        return {
            success: false,
            error: {
                type: error.type,
                message: error.message,
                severity: error.severity,
                fingerprint: error.fingerprint,
                timestamp: error.timestamp
            },
            recovery,
            handled: true
        };
    }

    // Erreur de repli
    function createFallbackError(originalError) {
        return {
            success: false,
            error: {
                type: ERROR_TYPES.SYSTEM,
                message: 'Error handling failed',
                originalError: originalError.message,
                timestamp: new Date().toISOString()
            },
            handled: false
        };
    }

    // Interface publique
    return {
        handleError,
        ERROR_TYPES,
        ERROR_SEVERITY
    };
}

export default errorHandlingService;


// Exemple d'utilisation
try {
    // Code qui peut générer une erreur
} catch (error) {
    const result = handleError(error, {
        component: 'UserProfile',
        action: 'updateData'
    });
    // Gérer le résultat
}