// logging.js

function loggingService() {
    // Configuration des constantes
    const LOG_LEVELS = {
        DEBUG: 'debug',
        INFO: 'info',
        WARN: 'warn',
        ERROR: 'error'
    };

    const LOG_CONFIG = {
        MAX_LOGS: 1000,
        BATCH_SIZE: 50,
        AUTO_CLEANUP_THRESHOLD: 800,
        STORAGE_KEY: 'system_logs',
        DEBUG_KEY: 'debug_logs'
    };

    // Structure pour le stockage temporaire des logs
    let logBuffer = [];
    let isProcessing = false;

    // Fonction principale de logging
    function log(level, message, data = {}) {
        const logEntry = createLogEntry(level, message, data);
        bufferLog(logEntry);
        
        // Notification du moniteur en temps réel
        notifyMonitor(logEntry);

        // Traitement automatique si le buffer atteint sa limite
        if (logBuffer.length >= LOG_CONFIG.BATCH_SIZE) {
            processLogBuffer();
        }

        return logEntry;
    }

    // Création d'une entrée de log
    function createLogEntry(level, message, data) {
        return {
            id: generateLogId(),
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            context: {
                url: window.location.href,
                userAgent: navigator.userAgent,
                memory: getMemoryInfo()
            }
        };
    }

    // Génération d'un ID unique pour chaque log
    function generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Ajout d'un log au buffer
    function bufferLog(logEntry) {
        logBuffer.push(logEntry);
        
        // Déclencher le traitement si nécessaire
        if (!isProcessing) {
            processLogBuffer();
        }
    }

    // Traitement du buffer de logs
    async function processLogBuffer() {
        if (isProcessing || logBuffer.length === 0) return;

        isProcessing = true;
        const batchSize = LOG_CONFIG.BATCH_SIZE;
        
        try {
            while (logBuffer.length > 0) {
                const batch = logBuffer.splice(0, batchSize);
                await saveLogs(batch);
            }
        } catch (error) {
            handleLoggingError(error);
        } finally {
            isProcessing = false;
        }
    }

    // Sauvegarde des logs
    async function saveLogs(logs) {
        try {
            const currentLogs = JSON.parse(localStorage.getItem(LOG_CONFIG.STORAGE_KEY) || '[]');
            const updatedLogs = [...currentLogs, ...logs];

            // Vérification de la limite et nettoyage si nécessaire
            if (updatedLogs.length > LOG_CONFIG.AUTO_CLEANUP_THRESHOLD) {
                await cleanupOldLogs(updatedLogs);
            }

            localStorage.setItem(LOG_CONFIG.STORAGE_KEY, JSON.stringify(updatedLogs));
            
            // Mise à jour des logs de débogage si nécessaire
            updateDebugLogs(logs);

        } catch (error) {
            handleStorageError(error, logs);
        }
    }

    // Mise à jour des logs de débogage
    function updateDebugLogs(logs) {
        const debugLogs = logs.filter(log => log.level === LOG_LEVELS.DEBUG);
        if (debugLogs.length === 0) return;

        try {
            const currentDebugLogs = JSON.parse(localStorage.getItem(LOG_CONFIG.DEBUG_KEY) || '[]');
            const updatedDebugLogs = [...currentDebugLogs, ...debugLogs]
                .slice(-LOG_CONFIG.MAX_LOGS);

            localStorage.setItem(LOG_CONFIG.DEBUG_KEY, JSON.stringify(updatedDebugLogs));
        } catch (error) {
            console.warn('Failed to update debug logs:', error);
        }
    }

    // Nettoyage des anciens logs
    async function cleanupOldLogs(logs) {
        // Garder les logs les plus récents
        const trimmedLogs = logs.slice(-LOG_CONFIG.MAX_LOGS);
        
        // Archivage des logs supprimés si nécessaire
        const removedLogs = logs.slice(0, -LOG_CONFIG.MAX_LOGS);
        if (removedLogs.length > 0) {
            await archiveOldLogs(removedLogs);
        }

        return trimmedLogs;
    }

    // Archivage des anciens logs
    async function archiveOldLogs(logs) {
        const archiveKey = `log_archive_${Date.now()}`;
        try {
            localStorage.setItem(archiveKey, JSON.stringify(logs));
        } catch (error) {
            console.warn('Failed to archive old logs:', error);
        }
    }

    // Notification du moniteur
    function notifyMonitor(logEntry) {
        const event = new CustomEvent('storage_monitor', {
            detail: {
                type: 'log',
                log: logEntry,
                timestamp: new Date().toISOString()
            }
        });
        window.dispatchEvent(event);
    }

    // Obtention des informations mémoire
    function getMemoryInfo() {
        if (window.performance && window.performance.memory) {
            const memory = window.performance.memory;
            return {
                usedJSHeapSize: memory.usedJSHeapSize,
                totalJSHeapSize: memory.totalJSHeapSize,
                jsHeapSizeLimit: memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    // Gestion des erreurs de logging
    function handleLoggingError(error) {
        console.error('Logging error:', error);
        
        // Tentative de sauvegarde d'urgence
        try {
            const emergencyKey = `emergency_log_${Date.now()}`;
            localStorage.setItem(emergencyKey, JSON.stringify({
                error: error.message,
                buffer: logBuffer,
                timestamp: new Date().toISOString()
            }));
        } catch (e) {
            console.error('Emergency logging failed:', e);
        }
    }

    // Gestion des erreurs de stockage
    function handleStorageError(error, logs) {
        // Tentative de nettoyage et de nouvelle sauvegarde
        try {
            cleanupStorage();
            localStorage.setItem(LOG_CONFIG.STORAGE_KEY, JSON.stringify(logs));
        } catch (e) {
            console.error('Storage cleanup failed:', e);
            // Fallback vers le stockage de session si localStorage est plein
            sessionStorage.setItem('overflow_logs', JSON.stringify(logs));
        }
    }

    // Nettoyage du stockage
    function cleanupStorage() {
        const keys = Object.keys(localStorage);
        const logKeys = keys.filter(key => key.startsWith('log_'));
        
        // Suppression des anciens logs
        logKeys
            .sort()
            .slice(0, Math.floor(logKeys.length / 2))
            .forEach(key => localStorage.removeItem(key));
    }

    // Interface publique
    return {
        debug: (message, data) => log(LOG_LEVELS.DEBUG, message, data),
        info: (message, data) => log(LOG_LEVELS.INFO, message, data),
        warn: (message, data) => log(LOG_LEVELS.WARN, message, data),
        error: (message, data) => log(LOG_LEVELS.ERROR, message, data),
        
        getLogs: () => JSON.parse(localStorage.getItem(LOG_CONFIG.STORAGE_KEY) || '[]'),
        getDebugLogs: () => JSON.parse(localStorage.getItem(LOG_CONFIG.DEBUG_KEY) || '[]'),
        
        clearLogs: () => {
            localStorage.removeItem(LOG_CONFIG.STORAGE_KEY);
            localStorage.removeItem(LOG_CONFIG.DEBUG_KEY);
        },

        LOG_LEVELS,
        LOG_CONFIG
    };
}

export default loggingService;