// storage-read.js
import { dataLoader } from '../../sync/data-loader.js';
import { checkDataIntegrity } from '../../structure/data-integrity.js';
import { data } from 'autoprefixer';

const storageReadService = (() => {
    // Configuration des constantes
    const READ_CONFIG = {
        CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
        BATCH_SIZE: 50,
        MAX_RETRIES: 3,
        TIMEOUT: 3000,
        READ_LOG_KEY: 'read_operations_log'
    };

    // Cache en mémoire
    const memoryCache = new Map();
    const cacheTimestamps = new Map();

    // Codes d'erreur
    const READ_ERRORS = {
        INVALID_KEY: 'INVALID_READ_KEY',
        KEY_NOT_FOUND: 'KEY_NOT_FOUND',
        PARSE_ERROR: 'JSON_PARSE_ERROR',
        INTEGRITY_ERROR: 'DATA_INTEGRITY_ERROR',
        TIMEOUT_ERROR: 'READ_TIMEOUT_ERROR',
        CACHE_ERROR: 'CACHE_ACCESS_ERROR'
    };

    /**
     * Vérifie l'intégrité des données
     * @param {string} key - Clé de l'élément
     * @param {string} value - Valeur de l'élément
     * @returns {Promise<boolean>} Résultat de la vérification
     */
    async function verifyDataIntegrity(key, value) {
        try {
            const integrityResult = await checkDataIntegrity(value);
            return integrityResult.isValid;
        } catch (error) {
            console.error('Integrity check error:', error);
            return false;
        }
    }

    /**
     * Validation et synchronisation des données
     * @param {string} key - Clé à valider
     * @returns {Promise<boolean>} Résultat de la validation
     */
    async function validateAndSync(key) {
        try {
            // Vérifie si une synchronisation est nécessaire
            await dataLoader.checkSync(key);
            return true;
        } catch (error) {
            console.warn('Sync validation failed:', error);
            return false;
        }
    }

    /**
     * Lecture d'un élément avec validation et cache
     * @param {string} key - Clé à lire
     * @param {Object} options - Options de lecture
     * @returns {Promise<Object>} Données lues
     */
    async function readItem(key, options = {}) {
        const {
            useCache = true,
            validateData = true,
            checkIntegrity = true,
            timeout = READ_CONFIG.TIMEOUT,
            syncRead = false
        } = options;

        try {
            // Validation de la clé
            if (!validateKey(key)) {
                throw new Error(READ_ERRORS.INVALID_KEY);
            }

            // Vérification du cache
            if (useCache && isValidCache(key)) {
                return {
                    data: memoryCache.get(key),
                    source: 'cache',
                    timestamp: cacheTimestamps.get(key)
                };
            }

            // Synchronisation si demandée
            let data;
            if (syncRead) {
                await validateAndSync(key);
            } else {
                data = await readWithTimeout(key, timeout);
            }

            if (data === null) {
            // Validation JSON si demandée
            if (validateData && !validateJSON(data)) {
                throw new Error(READ_ERRORS.PARSE_ERROR);
            }

            // Vérification de l'intégrité si demandée
            if (checkIntegrity) {
                const isValid = await verifyDataIntegrity(key, data);
                if (!isValid) {
                    throw new Error(READ_ERRORS.INTEGRITY_ERROR);
                }
            }

            // Mise en cache
            updateCache(key, data);

            // Log de l'opération
            logReadOperation(key, true);

            return {
                data: JSON.parse(data),
                source: syncRead ? 'sync' : 'storage',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logReadOperation(key, false, error.message);
            throw error;
        }
    }

    /**
     * Lecture avec timeout
     * @param {string} key - Clé à lire
     * @param {number} timeout - Délai maximum
     * @returns {Promise<string>} Données lues
     */
    function readWithTimeout(key, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(READ_ERRORS.TIMEOUT_ERROR));
            }, timeout);

            try {
                const data = localStorage.getItem(key);
                clearTimeout(timeoutId);

                if (data === null) {
                    reject(new Error(READ_ERRORS.KEY_NOT_FOUND));
                } else {
                    resolve(data);
                }
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * Lecture en lot d'éléments
     * @param {Array<string>} keys - Liste des clés à lire
     * @param {Object} options - Options de lecture
     * @returns {Promise<Object>} Résultats de lecture
     */
    async function batchRead(keys, options = {}) {
        const results = {
            success: [],
            failed: []
        };

        // Vérification initiale des données
        if (options.syncRead) {
            await dataLoader.batchSync(keys);
        }

        // Traitement par lots
        for (let i = 0; i < keys.length; i += READ_CONFIG.BATCH_SIZE) {
            const batch = keys.slice(i, i + READ_CONFIG.BATCH_SIZE);
            
            await Promise.all(batch.map(async (key) => {
                try {
                    const result = await readItem(key, options);
                    results.success.push({ key, ...result });
                } catch (error) {
                    results.failed.push({ key, error: error.message });
                }
            }));

            // Synchronisation apres chaque lot si demandée
            if (options.syncRead) {
                await dataLoader.syncChanges();
            }
        }

        // Log du résultat global
        logBatchOperation(results);

        return results;
    }

    /**
     * Vérification de la validité du cache
     * @param {string} key - Clé à vérifier
     * @returns {boolean} Validité du cache
     */
    function isValidCache(key) {
        if (!memoryCache.has(key) || !cacheTimestamps.has(key)) {
            return false;
        }

        const timestamp = cacheTimestamps.get(key);
        const age = Date.now() - timestamp;
        return age < READ_CONFIG.CACHE_DURATION;
    }

    /**
     * Mise à jour du cache
     * @param {string} key - Clé à mettre en cache
     * @param {string} data - Données à mettre en cache
     */
    function updateCache(key, data) {
        try {
            const parsedData = JSON.parse(data);

            const isvalid = await checkDataIntegrity(data)
            if (!isvalid.isValid) {
                memoryCache.set(key, JSON.parse(data));
                cacheTimestamps.set(key, Date.now());
            } else {
                console.warn('Cache update skipped due to integrity check failure');
            }
            
        } catch (error) {
            console.warn('Cache update failed:', error);
        }
    }

    /**
     * Log des opérations de lecture
     * @param {string} key - Clé lue
     * @param {boolean} success - Succès de l'opération
     * @param {string} error - Message d'erreur éventuel
     */
    function logReadOperation(key, success, error = null) {
        try {
            const logs = JSON.parse(localStorage.getItem(READ_CONFIG.READ_LOG_KEY) || '[]');
            logs.push({
                key,
                success,
                error,
                timestamp: new Date().toISOString()
            });

            // Limitation de la taille des logs
            if (logs.length > 1000) logs.shift();
            
            localStorage.setItem(READ_CONFIG.READ_LOG_KEY, JSON.stringify(logs));

        } catch (error) {
            console.warn('Failed to log read operation:', error);
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
        dispatchMonitoringEvent('batch_read', batchLog);
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

    /**
     * Nettoyage du cache
     * @param {string} key - Clé spécifique à nettoyer (optionnel)
     */
    function clearCache(key = null) {
        if (key) {
            memoryCache.delete(key);
            cacheTimestamps.delete(key);
        } else {
            memoryCache.clear();
            cacheTimestamps.clear();
        }
    }

    // Interface publique
    return {
        readItem,
        batchRead,
        clearCache,
        getReadLogs: () => JSON.parse(localStorage.getItem(READ_CONFIG.READ_LOG_KEY) || '[]'),
        validateAndSync,
        READ_ERRORS,
        READ_CONFIG
    };
})();

export default storageReadService;