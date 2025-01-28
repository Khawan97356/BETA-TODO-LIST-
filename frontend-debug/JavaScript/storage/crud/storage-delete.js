// storage-delete.js

// Intégration de dataLoader
const dataLoader = (() => {
    return {
        load: async (key) => {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (error) {
                console.error('Error loading data:', error);
                return null;
            }
        },
        verify: async (key) => {
            try {
                const data = localStorage.getItem(key);
                return data !== null;
            } catch (error) {
                console.error('Error verifying data:', error);
                return false;
            }
        }
    };
})();

// Intégration de checkDataIntegrity
const checkDataIntegrity = (() => {
    const validateStructure = (data) => {
        if (!data) return false;
        if (typeof data === 'string') {
            try {
                JSON.parse(data);
                return true;
            } catch {
                return false;
            }
        }
        return typeof data === 'object' && data !== null;
    };

    const checkSize = (data) => {
        const size = new Blob([JSON.stringify(data)]).size;
        return size <= 5242880; // 5MB limite de localStorage
    };

    return async (data) => {
        try {
            return validateStructure(data) && checkSize(data);
        } catch (error) {
            console.error('Data integrity check failed:', error);
            return false;
        }
    };
})();

const storageDeleteService = (() => {
    // Constants pour la configuration
    const DELETE_CONFIG = {
        BATCH_SIZE: 50,
        TIMEOUT: 5000,
        BACKUP_PREFIX: 'backup_',
        DELETE_LOG_KEY: 'delete_operations_log'
    };

    // Codes d'erreur spécifiques à la suppression
    const DELETE_ERRORS = {
        INVALID_KEY: 'INVALID_DELETE_KEY',
        KEY_NOT_FOUND: 'KEY_NOT_FOUND',
        INTEGRITY_CHECK_FAILED: 'INTEGRITY_CHECK_FAILED',
        BACKUP_FAILED: 'BACKUP_CREATION_FAILED',
        BATCH_DELETE_FAILED: 'BATCH_DELETE_FAILED',
        VALIDATION_FAILED: 'VALIDATION_FAILED'
    };

    /**
     * Valide une clé de stockage
     * @param {string} key - Clé à valider
     * @returns {boolean} Résultat de la validation
     */
    function validateKey(key) {
        return typeof key === 'string' && 
               key.length > 0 && 
               key.length <= 100 &&
               /^[a-zA-Z0-9_-]+$/.test(key);
    }

    /**
     * Supprime un élément du localStorage avec validation et sauvegarde
     * @param {string} key - Clé de l'élément à supprimer
     * @param {Object} options - Options de suppression
     * @returns {Promise<Object>} Résultat de l'opération
     */
    async function deleteItem(key, options = {}) {
        const {
            createBackup = true,
            verifyIntegrity = true,
            notifyChange = true
        } = options;

        try {
            // Validation de la clé
            if (!validateKey(key)) {
                throw new Error(DELETE_ERRORS.INVALID_KEY);
            }

            // Vérification de l'existence et chargement des données
            const item = await dataLoader.load(key);
            if (item === null) {
                throw new Error(DELETE_ERRORS.KEY_NOT_FOUND);
            }

            // Vérification de l'intégrité si demandée
            if (verifyIntegrity) {
                const isValid = await checkDataIntegrity(item);
                if (!isValid) {
                    throw new Error(DELETE_ERRORS.INTEGRITY_CHECK_FAILED);
                }
            }

            // Création d'une sauvegarde si demandée
            if (createBackup) {
                await createItemBackup(key, JSON.stringify(item));
            }

            // Suppression de l'élément
            await secureDelete(key);

            // Logging de l'opération
            logDeleteOperation(key, true);

            // Notification du changement si demandée
            if (notifyChange) {
                notifyStorageChange('delete', { key });
            }

            return {
                success: true,
                key,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logDeleteOperation(key, false, error.message);
            throw error;
        }
    }

    /**
     * Suppression en lot d'éléments
     * @param {Array<string>} keys - Liste des clés à supprimer
     * @param {Object} options - Options de suppression
     * @returns {Promise<Object>} Résultats de l'opération
     */
    async function batchDelete(keys, options = {}) {
        const results = {
            success: [],
            failed: []
        };

        // Traitement par lots
        for (let i = 0; i < keys.length; i += DELETE_CONFIG.BATCH_SIZE) {
            const batch = keys.slice(i, i + DELETE_CONFIG.BATCH_SIZE);
            
            await Promise.all(batch.map(async (key) => {
                try {
                    await deleteItem(key, options);
                    results.success.push(key);
                } catch (error) {
                    results.failed.push({ key, error: error.message });
                }
            }));

            // Pause entre les lots pour éviter la surcharge
            if (i + DELETE_CONFIG.BATCH_SIZE < keys.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Log du résultat global
        logBatchOperation(results);

        return results;
    }

    /**
     * Crée une sauvegarde d'un élément avant suppression
     * @param {string} key - Clé de l'élément
     * @param {string} value - Valeur de l'élément
     * @returns {Promise<string>} Clé de la sauvegarde
     */
    async function createItemBackup(key, value) {
        try {
            const backupKey = `${DELETE_CONFIG.BACKUP_PREFIX}${key}_${Date.now()}`;
            const backupData = {
                originalKey: key,
                value,
                timestamp: new Date().toISOString(),
                metadata: {
                    backupType: 'pre_delete',
                    originalSize: value.length
                }
            };

            localStorage.setItem(backupKey, JSON.stringify(backupData));
            return backupKey;

        } catch (error) {
            throw new Error(DELETE_ERRORS.BACKUP_FAILED);
        }
    }

    /**
     * Suppression sécurisée avec vérification
     * @param {string} key - Clé à supprimer
     * @returns {Promise<boolean>} Succès de l'opération
     */
    async function secureDelete(key) {
        const item = localStorage.getItem(key);
        if (!item) return true;

        try {
            // Réécriture multiple pour sécurité
            for (let i = 0; i < 3; i++) {
                const dummy = '*'.repeat(item.length);
                localStorage.setItem(key, dummy);
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            localStorage.removeItem(key);
            return true;

        } catch (error) {
            console.error('Secure delete failed:', error);
            return false;
        }
    }

    /**
     * Log des opérations de suppression
     * @param {string} key - Clé supprimée
     * @param {boolean} success - Succès de l'opération
     * @param {string} error - Message d'erreur éventuel
     */
    function logDeleteOperation(key, success, error = null) {
        try {
            const logs = JSON.parse(localStorage.getItem(DELETE_CONFIG.DELETE_LOG_KEY) || '[]');
            logs.push({
                key,
                success,
                error,
                timestamp: new Date().toISOString()
            });

            // Garder seulement les 1000 derniers logs
            if (logs.length > 1000) {
                logs.splice(0, logs.length - 1000);
            }
            
            localStorage.setItem(DELETE_CONFIG.DELETE_LOG_KEY, JSON.stringify(logs));

        } catch (error) {
            console.warn('Failed to log delete operation:', error);
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

        // Émission d'événement pour le monitoring
        dispatchMonitoringEvent('batch_delete', batchLog);
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
        deleteItem,
        batchDelete,
        secureDelete,
        getDeleteLogs: () => JSON.parse(localStorage.getItem(DELETE_CONFIG.DELETE_LOG_KEY) || '[]'),
        DELETE_ERRORS,
        DELETE_CONFIG
    };
})();

export default storageDeleteService;