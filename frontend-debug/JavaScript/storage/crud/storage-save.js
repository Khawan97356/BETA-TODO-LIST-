// storage-save.js

import { validateJSON } from '../../structure/validation-json.js';
import { validateKeys } from '../../structure/keys-validator.js';
import { autoSave } from '../../sync/auto-save.js';



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
     * Validation étendue des clés
     * @param {string} key - Clé à valider
     * @returns {boolean} Résultat de la validation
     */
    function validateKey(key) {
        return validateKeys.isValidKey(key) && key.length <= SAVE_CONFIG.MAX_KEY_LENGTH;
    }

    /**
     * Configuration de l'auto-sauvegarde
     * @param {Object} options - Options d'auto-sauvegarde
     */
    function setupAutoSave(options = {}) {
        autoSave.configure({
            interval: options.interval || 5000,
            maxAttempts: options.maxAttempts || SAVE_CONFIG.RETRY_ATTEMPTS,
            onSave: async (key, data) => {
                try {
                    await saveItem(key, data, { createBackup: true });
                    return true;
                } catch (error) {
                    console.error('Auto-save failed:', error);
                    return false;
                }
            }
        });
    }

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
            createBackup = true,
            enableAutoSave = true
        } = options;

        try {
            // Validation de la clé
            if (!validateKey(key) || key.length > SAVE_CONFIG.MAX_KEY_LENGTH) {
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

            if (enableAutoSave) {
                autoSave.register(key, processedData);
            }

            // Tentative de sauvegarde avec retry
            const result = await retryOperation(() => {
                localStorage.setItem(key, processedData);
                return true;
            });

            if (validate) {
                const savedData = localStorage.getItem(key);
                if (!validateJSON(savedData)) {
                    throw new Error(SAVE_ERRORS.VALIDATION_FAILED);
                }
            }

            logSaveOperation(key, true);

            // Notification du changement
            notifyStorageChange('save', { key, size: processedData.length });

            return {
                success: true,
                key,
                size: processedData.length,
                compressed: processedData !== jsonData,
                timestamp: new Date().toISOString(),
                autoSaveEnabled: enableAutoSave
            };
                } catch (error) {
            logSaveOperation(key, false, error.message);
            throw error;
        }
    }

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

        // Validation des clés avant le traitement par lots
        const invalidKeys = items.filter(item => !validateKey(item.key));
        if (invalidKeys.length > 0) {
            throw new Error(`Invalid keys found: ${invalidKeys.map(item => item.key).join(', ')}`);
        }

        // Traitement par lots
        for (let i = 0; i < items.length; i += SAVE_CONFIG.BATCH_SIZE) {
            const batch = items.slice(i, i + SAVE_CONFIG.BATCH_SIZE);
            
            await Promise.all(batch.map(async ({ key, data }) => {
                try {
                    const result = await saveItem(key, data, {...options,
                        enableAutoSave: options.enableAutoSave && autoSave.isSupported
                });
                    results.success.push({ key, result });
                } catch (error) {
                    results.failed.push({ key, error: error.message });
                }
            }));

            // Syncronisation de l'auto-sauvegarde apres chaque lot
            if (options.enableAutoSave) {
                await autoSave.syncAll();
            }
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
        setupAutoSave,
        getSaveLogs: () => JSON.parse(localStorage.getItem(SAVE_CONFIG.SAVE_LOG_KEY) || '[]'),
        validateKey,
        SAVE_ERRORS,
        SAVE_CONFIG
    };
})();

export default storageSaveService;