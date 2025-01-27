// error-handling.js
import { logError } from './logging.js';
function errorHandlingService() {
    // Configuration des constantes
    const ERROR_TYPES = {
        VALIDATION: 'VALIDATION_ERROR',
        STORAGE: 'STORAGE_ERROR',
        INTEGRITY: 'INTEGRITY_ERROR',
        SYNC: 'SYNC_ERROR',
        SYSTEM: 'SYSTEM_ERROR',
        NETWORK: 'NETWORK_ERROR',
        TIMEOUT: 'TIMEOUT_ERROR'
    };

    const ERROR_SEVERITY = {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
    };

    // frontend-debug/backend/services/error-handling.js

export const errorHandling = {
    // Types d'erreurs
    errorTypes: {
        VALIDATION: 'VALIDATION_ERROR',
        AUTH: 'AUTHENTICATION_ERROR',
        NOT_FOUND: 'NOT_FOUND_ERROR',
        SERVER: 'SERVER_ERROR'
    },

    // Gestionnaire d'erreurs
    handleError: (error) => {
        const timestamp = new Date().toISOString();
        
        // Format standard des erreurs
        return {
            success: false,
            error: {
                type: error.type || 'UNKNOWN_ERROR',
                message: error.message,
                timestamp
            }
        };
    },

    // Logger d'erreurs
    logError: (error) => {
        console.error([${new Date().toISOString()}] Error:, {
            type: error.type,
            message: error.message,
            stack: error.stack
        });
    },

    // Création d'erreur formatée
    createError: (type, message) => {
        return {
            type,
            message,
            timestamp: new Date().toISOString()
        };
    }
};

    // Gestionnaire principal des erreurs
    function handleError(error, context = {}) {
        const errorDetails = analyzeError(error);
        const enrichedError = enrichErrorData(errorDetails, context);
        
        // Log de l'erreur
        logError(enrichedError);

        // Notification du système de monitoring
        notifyMonitor(enrichedError);

        // Actions de récupération si nécessaire
        const recovery = attemptRecovery(enrichedError);

        return {
            error: enrichedError,
            handled: true,
            recovery,
            timestamp: new Date().toISOString()
        };
    }

    // Analyse de l'erreur
    function analyzeError(error) {
        const errorInfo = {
            type: determineErrorType(error),
            message: error.message || 'Unknown error',
            stack: error.stack,
            severity: calculateSeverity(error),
            timestamp: new Date().toISOString()
        };

        return {
            ...errorInfo,
            fingerprint: generateErrorFingerprint(errorInfo)
        };
    }

    // Détermination du type d'erreur
    function determineErrorType(error) {
        if (error.name === 'QuotaExceededError') return ERROR_TYPES.STORAGE;
        if (error.name === 'SecurityError') return ERROR_TYPES.SYSTEM;
        if (error.name === 'SyntaxError') return ERROR_TYPES.VALIDATION;
        if (error.name === 'NetworkError') return ERROR_TYPES.NETWORK;
        if (error.name === 'TimeoutError') return ERROR_TYPES.TIMEOUT;
        
        // Analyse du message d'erreur pour une classification plus précise
        const message = error.message.toLowerCase();
        if (message.includes('storage')) return ERROR_TYPES.STORAGE;
        if (message.includes('validation')) return ERROR_TYPES.VALIDATION;
        if (message.includes('integrity')) return ERROR_TYPES.INTEGRITY;
        if (message.includes('sync')) return ERROR_TYPES.SYNC;

        return ERROR_TYPES.SYSTEM;
    }

    // Calcul de la sévérité
    function calculateSeverity(error) {
        const type = determineErrorType(error);
        
        const severityMap = {
            [ERROR_TYPES.VALIDATION]: ERROR_SEVERITY.LOW,
            [ERROR_TYPES.STORAGE]: ERROR_SEVERITY.MEDIUM,
            [ERROR_TYPES.INTEGRITY]: ERROR_SEVERITY.HIGH,
            [ERROR_TYPES.SYNC]: ERROR_SEVERITY.MEDIUM,
            [ERROR_TYPES.SYSTEM]: ERROR_SEVERITY.HIGH,
            [ERROR_TYPES.NETWORK]: ERROR_SEVERITY.MEDIUM,
            [ERROR_TYPES.TIMEOUT]: ERROR_SEVERITY.LOW
        };

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
            storage: getStorageState()
        };
    }

    // Obtention de l'état du stockage
    function getStorageState() {
        try {
            return {
                quotaUsed: calculateStorageUsage(),
                keys: Object.keys(localStorage).length,
                availableSpace: estimateAvailableSpace()
            };
        } catch (error) {
            return { error: 'Unable to get storage state' };
        }
    }

    // Calcul de l'utilisation du stockage
    function calculateStorageUsage() {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            total += localStorage.getItem(key).length;
        }
        return total;
    }

    // Estimation de l'espace disponible
    function estimateAvailableSpace() {
        try {
            let testKey = 'storage-test';
            let testString = 'a';
            let size = 0;

            while (true) {
                localStorage.setItem(testKey, testString);
                size = testString.length;
                testString += testString;
            }
        } catch (e) {
            localStorage.removeItem('storage-test');
            return size;
        }
    }

    // Logging des erreurs
    function logError(error) {
        try {
            const errorLogKey = 'error_log';
            const currentLog = JSON.parse(localStorage.getItem(errorLogKey) || '[]');
            
            currentLog.push(error);
            
            // Limite de la taille du log
            if (currentLog.length > 100) {
                currentLog.shift();
            }

            localStorage.setItem(errorLogKey, JSON.stringify(currentLog));
            
            // Émission d'événement pour le moniteur
            dispatchErrorEvent('error_logged', error);

        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
    }

    // Notification du moniteur
    function notifyMonitor(error) {
        const event = new CustomEvent('storage_monitor', {
            detail: {
                type: 'error',
                error,
                timestamp: new Date().toISOString()
            }
        });
        window.dispatchEvent(event);
    }

    // Tentative de récupération
    function attemptRecovery(error) {
        const recoveryActions = {
            [ERROR_TYPES.STORAGE]: cleanupStorage,
            [ERROR_TYPES.INTEGRITY]: repairDataIntegrity,
            [ERROR_TYPES.SYNC]: resyncData
        };

        const recoveryAction = recoveryActions[error.type];
        if (recoveryAction) {
            try {
                return recoveryAction();
            } catch (recoveryError) {
                return { success: false, error: recoveryError.message };
            }
        }

        return { success: false, reason: 'No recovery action available' };
    }

    // Actions de récupération spécifiques
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
        return { success: true, repairedItems: corruptedData.length };
    }

    function resyncData() {
        const syncEvent = new CustomEvent('storage_sync_required');
        window.dispatchEvent(syncEvent);
        return { success: true, action: 'sync_triggered' };
    }

    // Génération d'une empreinte unique pour l'erreur
    function generateErrorFingerprint(error) {
        const fingerprintData = `${error.type}:${error.message}:${error.severity}`;
        return btoa(fingerprintData).slice(0, 8);
    }

    // Interface publique
    return {
        handleError,
        getErrorLog: () => JSON.parse(localStorage.getItem('error_log') || '[]'),
        ERROR_TYPES,
        ERROR_SEVERITY
    };
}

export default errorHandlingService;