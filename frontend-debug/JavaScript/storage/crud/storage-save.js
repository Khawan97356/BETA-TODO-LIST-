// storage-save.js

// Intégration de validateJSON
const validateJSON = (() => {
    const isValidJSONString = (str) => {
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    };

    const isValidJSONData = (data) => {
        try {
            if (typeof data === 'undefined') return false;
            if (data === null) return true;
            
            // Vérification des types primitifs
            if (typeof data === 'string' || 
                typeof data === 'number' || 
                typeof data === 'boolean') {
                return true;
            }

            // Vérification des objets et tableaux
            JSON.stringify(data);
            return true;
        } catch {
            return false;
        }
    };

    return (data) => {
        if (typeof data === 'string') {
            return isValidJSONString(data);
        }
        return isValidJSONData(data);
    };
})();

// Intégration de validateKeys
const validateKeys = (() => {
    const validateKey = (key) => {
        if (typeof key !== 'string') return false;
        if (key.length === 0 || key.length > 100) return false;
        return /^[a-zA-Z0-9_-]+$/.test(key);
    };

    const validateMultipleKeys = (keys) => {
        if (!Array.isArray(keys)) return false;
        return keys.every(key => validateKey(key));
    };

    return {
        validateKey,
        validateMultipleKeys
    };
})();

// Intégration de autoSave
const autoSave = (() => {
    const pendingSaves = new Map();
    const AUTO_SAVE_DELAY = 1000; // 1 seconde

    const scheduleAutoSave = (key, data, options) => {
        if (pendingSaves.has(key)) {
            clearTimeout(pendingSaves.get(key).timeoutId);
        }

        const timeoutId = setTimeout(async () => {
            try {
                await storageSaveService.saveItem(key, data, options);
                pendingSaves.delete(key);
            } catch (error) {
                console.error('Auto-save failed:', error);
            }
        }, AUTO_SAVE_DELAY);

        pendingSaves.set(key, {
            timeoutId,
            data,
            options
        });
    };

    const cancelAutoSave = (key) => {
        if (pendingSaves.has(key)) {
            clearTimeout(pendingSaves.get(key).timeoutId);
            pendingSaves.delete(key);
        }
    };

    const getAutoSaveStatus = (key) => {
        return pendingSaves.has(key);
    };

    return {
        scheduleAutoSave,
        cancelAutoSave,
        getAutoSaveStatus
    };
})();

const storageSaveService = (() => {
    // Configuration des constantes
    const SAVE_CONFIG = {
        MAX_KEY_LENGTH: 100,
        MAX_VALUE_SIZE: 5 * 1024 * 1024, // 5MB
        COMPRESSION_THRESHOLD: 1024 * 1024, // 1MB
        BATCH_SIZE: 50,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000,
        SAVE_LOG_KEY: 'save_operations_log'
    };

    // Codes d'erreur
    const SAVE_ERRORS = {
        INVALID_KEY: 'INVALID_SAVE_KEY',
        INVALID_DATA: 'INVALID_DATA_FORMAT',
        STORAGE_FULL: 'STORAGE_QUOTA_EXCEEDED',
        COMPRESSION_FAILED: 'COMPRESSION_FAILED',
        INTEGRITY_CHECK_FAILED: 'INTEGRITY_CHECK_FAILED',
        VALIDATION_FAILED: 'VALIDATION_FAILED'
    };

    /**
     * Sauvegarde d'un élément avec validation et compression
     * @param {string} key - Clé de l'élément
     * @param {any} data - Données à sauvegarder
     * @param {Object} options - Options de sauvegarde
     * @returns {Promise<Object>} Résultat de la sauvegarde
     */
    async function saveItem(key, data, options = {}) {
        const {
            compress = true,
            validate = true,
            checkIntegrity = true,
            createBackup = true
        } = options;

        try {
            // Validation de la clé
            if (!validateKeys.validateKey(key) || key.length > SAVE_CONFIG.MAX_KEY_LENGTH) {
                throw new Error(SAVE_ERRORS.INVALID_KEY);
            }

            // Validation des données
            if (validate && !validateJSON(data)) {
                throw new Error(SAVE_ERRORS.INVALID_DATA);
            }

            // Conversion en chaîne JSON
            const jsonData = JSON.stringify(data);

            // Vérification de la taille
            if (new Blob([jsonData]).size > SAVE_CONFIG.MAX_VALUE_SIZE) {
                throw new Error(SAVE_ERRORS.STORAGE_FULL);
            }

            // Compression si nécessaire
            let processedData = jsonData;
            if (compress && jsonData.length > SAVE_CONFIG.COMPRESSION_THRESHOLD) {
                processedData = await compressData(jsonData);
            }

            // Création d'une sauvegarde si demandée
            if (createBackup) {
                await createBackupBeforeSave(key);
            }

            // Tentative de sauvegarde avec retry
            const result = await retryOperation(() => {
                localStorage.setItem(key, processedData);
                return true;
            });

            // Vérification d'intégrité post-sauvegarde
            if (checkIntegrity) {
                const isValid = await verifyDataIntegrity(key, processedData);
                if (!isValid) {
                    throw new Error(SAVE_ERRORS.INTEGRITY_CHECK_FAILED);
                }
            }

            // Log de l'opération
            logSaveOperation(key, true);

            // Notification du changement
            notifyStorageChange('save', { key, size: processedData.length });

            return {
                success: true,
                key,
                size: processedData.length,
                compressed: processedData !== jsonData,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logSaveOperation(key, false, error.message);
            throw error;
        }
    }

    /**
     * Vérifie l'intégrité des données sauvegardées
     * @param {string} key - Clé à vérifier
     * @param {string} data - Données à vérifier
     * @returns {Promise<boolean>} Résultat de la vérification
     */
    async function verifyDataIntegrity(key, data) {
        try {
            const savedData = localStorage.getItem(key);
            return savedData === data;
        } catch {
            return false;
        }
    }

    /**
     * Compression des données
     * @param {string} data - Données à compresser
     * @returns {Promise<string>} Données compressées
     */
    async function compressData(data) {
        try {
            const compressionStream = new CompressionStream('gzip');
            const blob = new Blob([data]);
            const compressedStream = blob.stream().pipeThrough(compressionStream);
            const compressedBlob = await new Response(compressedStream).blob();
            return await compressedBlob.text();
        } catch (error) {
            throw new Error(SAVE_ERRORS.COMPRESSION_FAILED);
        }
    }

    /**
     * Création d'une sauvegarde avant modification
     * @param {string} key - Clé à sauvegarder
     */
    async function createBackupBeforeSave(key) {
        try {
            const existingData = localStorage.getItem(key);
            if (existingData) {
                const backupKey = `backup_${key}_${Date.now()}`;
                localStorage.setItem(backupKey, existingData);
            }
        } catch (error) {
            console.warn('Backup creation failed:', error);
        }
    }

    /**
     * Sauvegarde en lot
     * @param {Array<Object>} items - Éléments à sauvegarder
     * @param {Object} options - Options de sauvegarde
     * @returns {Promise<Object>} Résultats de sauvegarde
     */
    async function batchSave(items, options = {}) {
        const results = {
            success: [],
            failed: []
        };

        // Traitement par lots
        for (let i = 0; i < items.length; i += SAVE_CONFIG.BATCH_SIZE) {
            const batch = items.slice(i, i + SAVE_CONFIG.BATCH_SIZE);
            
            await Promise.all(batch.map(async ({ key, data }) => {
                try {
                    const result = await saveItem(key, data, options);
                    results.success.push({ key, result });
                } catch (error) {
                    results.failed.push({ key, error: error.message });
                }
            }));
        }

        // Log du résultat global
        logBatchOperation(results);

        return results;
    }

    /**
     * Opération avec retry automatique
     * @param {Function} operation - Opération à exécuter
     * @returns {Promise<any>} Résultat de l'opération
     */
    async function retryOperation(operation) {
        let lastError;

        for (let attempt = 1; attempt <= SAVE_CONFIG.RETRY_ATTEMPTS; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                if (attempt < SAVE_CONFIG.RETRY_ATTEMPTS) {
                    await new Promise(resolve => 
                        setTimeout(resolve, SAVE_CONFIG.RETRY_DELAY * attempt)
                    );
                }
            }
        }

        throw lastError;
    }

    /**
     * Log des opérations de sauvegarde
     * @param {string} key - Clé sauvegardée
     * @param {boolean} success - Succès de l'opération
     * @param {string} error - Message d'erreur éventuel
     */
    function logSaveOperation(key, success, error = null) {
        try {
            const logs = JSON.parse(localStorage.getItem(SAVE_CONFIG.SAVE_LOG_KEY) || '[]');
            logs.push({
                key,
                success,
                error,
                timestamp: new Date().toISOString()
            });

            if (logs.length > 1000) logs.shift();
            localStorage.setItem(SAVE_CONFIG.SAVE_LOG_KEY, JSON.stringify(logs));

        } catch (error) {
            console.warn('Failed to log save operation:', error);
        }
    }

    /**
     * Log des opérations par lot
     * @param {Object} results - Résultats de l'opération par lot
     */
    function logBatchOperation(results) {
        const batchLog = {
            timestamp: new Date().toISOString(),
            totalOperations: results.success.length + results.failed.length,
            successCount: results.success.length,
            failureCount: results.failed.length,
            details: results
        };

        dispatchMonitoringEvent('batch_save', batchLog);
    }

    /**
     * Notification des changements
     * @param {string} action - Type d'action
     * @param {Object} details - Détails de l'action
     */
    function notifyStorageChange(action, details) {
        window.dispatchEvent(new CustomEvent('storage_monitor', {
            detail: {
                action,
                ...details,
                timestamp: new Date().toISOString()
            }
        }));
    }

    /**
     * Émission d'événements pour le monitoring
     * @param {string} type - Type d'événement
     * @param {Object} data - Données de l'événement
     */
    function dispatchMonitoringEvent(type, data) {
        window.dispatchEvent(new CustomEvent('storage_monitor', {
            detail: {
                type,
                data,
                timestamp: new Date().toISOString()
            }
        }));
    }

    // Interface publique
    return {
        saveItem,
        batchSave,
        getSaveLogs: () => JSON.parse(localStorage.getItem(SAVE_CONFIG.SAVE_LOG_KEY) || '[]'),
        SAVE_ERRORS,
        SAVE_CONFIG,
        autoSave
    };
})();

export default storageSaveService;