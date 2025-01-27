// data-loader.js

import { validateJSON } from '../structure/validation-json.js';
import { verifyDataIntegrity } from '../structure/data-integrity.js';

const dataLoaderService = (() => {
    // Configuration des constantes
    const LOADER_CONFIG = {
        BATCH_SIZE: 50,
        LOAD_TIMEOUT: 5000,
        CACHE_DURATION: 300000, // 5 minutes
        PREFETCH_THRESHOLD: 0.8, // 80%
        MAX_RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000,
        LOADER_LOG_KEY: 'data_loader_logs'
    };

    // État interne
    const state = {
        cache: new Map(),
        loadQueue: new Set(),
        prefetchQueue: new Set(),
        observers: new Map(),
        loadingPromises: new Map(),
        stats: {
            hits: 0,
            misses: 0,
            errors: 0
        }
    };

    /**
     * Charge des données depuis le localStorage
     * @param {string|Array} keys - Clé(s) à charger
     * @param {Object} options - Options de chargement
     * @returns {Promise<Object>} Données chargées
     */
    async function loadData(keys, options = {}) {
        const {
            useCache = true,
            validate = true,
            timeout = LOADER_CONFIG.LOAD_TIMEOUT
        } = options;

        // Conversion en tableau si nécessaire
        const keyArray = Array.isArray(keys) ? keys : [keys];

        try {
            // Vérification du cache
            if (useCache) {
                const cachedData = getCachedData(keyArray);
                if (cachedData) {
                    updateStats('hits');
                    return cachedData;
                }
            }

            updateStats('misses');

            // Chargement avec timeout
            const result = await Promise.race([
                loadWithRetry(keyArray, validate),
                createTimeout(timeout)
            ]);

            // Mise en cache
            if (useCache) {
                cacheData(keyArray, result);
            }

            // Déclenchement du prefetch si nécessaire
            checkPrefetchThreshold();

            return result;

        } catch (error) {
            updateStats('errors');
            handleLoadError(keyArray, error);
            throw error;
        }
    }

    /**
     * Chargement avec retry automatique
     * @param {Array} keys - Clés à charger
     * @param {boolean} validate - Validation activée
     * @returns {Promise<Object>} Données chargées
     */
    async function loadWithRetry(keys, validate) {
        let attempt = 0;
        
        while (attempt < LOADER_CONFIG.MAX_RETRY_ATTEMPTS) {
            try {
                return await loadBatch(keys, validate);
            } catch (error) {
                attempt++;
                if (attempt === LOADER_CONFIG.MAX_RETRY_ATTEMPTS) throw error;
                await new Promise(resolve => 
                    setTimeout(resolve, LOADER_CONFIG.RETRY_DELAY * attempt)
                );
            }
        }
    }

    /**
     * Chargement par lot
     * @param {Array} keys - Clés à charger
     * @param {boolean} validate - Validation activée
     * @returns {Promise<Object>} Données chargées
     */
    async function loadBatch(keys, validate) {
        const result = {};
        
        for (let i = 0; i < keys.length; i += LOADER_CONFIG.BATCH_SIZE) {
            const batch = keys.slice(i, i + LOADER_CONFIG.BATCH_SIZE);
            const batchData = await loadBatchItems(batch, validate);
            Object.assign(result, batchData);
        }

        return result;
    }

    /**
     * Chargement d'un lot d'éléments
     * @param {Array} keys - Clés à charger
     * @param {boolean} validate - Validation activée
     * @returns {Promise<Object>} Données chargées
     */
    async function loadBatchItems(keys, validate) {
        const result = {};

        await Promise.all(keys.map(async key => {
            try {
                let data = localStorage.getItem(key);
                
                if (data === null) {
                    return;
                }

                // Décompression si nécessaire
                if (isCompressed(data)) {
                    data = await decompressData(data);
                }

                // Parsing et validation
                const parsed = JSON.parse(data);
                
                if (validate) {
                    if (!validateJSON(parsed)) {
                        throw new Error('Invalid JSON format');
                    }
                    
                    if (!await verifyDataIntegrity(key, data)) {
                        throw new Error('Data integrity check failed');
                    }
                }

                result[key] = parsed;
                
            } catch (error) {
                handleLoadError(key, error);
            }
        }));

        return result;
    }

    /**
     * Vérifie si les données sont compressées
     * @param {string} data - Données à vérifier
     * @returns {boolean} Données compressées ou non
     */
    function isCompressed(data) {
        // Implémentation de la détection de compression
        return data.startsWith('compressed:');
    }

    /**
     * Décompresse les données
     * @param {string} data - Données à décompresser
     * @returns {Promise<string>} Données décompressées
     */
    async function decompressData(data) {
        try {
            const compressed = data.slice(11); // Retire 'compressed:'
            const blob = new Blob([compressed]);
            const decompressedStream = blob.stream().pipeThrough(
                new DecompressionStream('gzip')
            );
            const decompressedBlob = await new Response(decompressedStream).blob();
            return await decompressedBlob.text();
        } catch (error) {
            throw new Error('Decompression failed');
        }
    }

    /**
     * Gestion du cache
     * @param {Array} keys - Clés à mettre en cache
     * @param {Object} data - Données à mettre en cache
     */
    function cacheData(keys, data) {
        keys.forEach(key => {
            if (data[key]) {
                state.cache.set(key, {
                    data: data[key],
                    timestamp: Date.now()
                });
            }
        });

        // Nettoyage du cache si nécessaire
        cleanCache();
    }

    /**
     * Récupération des données en cache
     * @param {Array} keys - Clés à récupérer
     * @returns {Object|null} Données en cache
     */
    function getCachedData(keys) {
        const result = {};
        let allCached = true;

        for (const key of keys) {
            const cached = state.cache.get(key);
            if (!cached || isCacheExpired(cached.timestamp)) {
                allCached = false;
                break;
            }
            result[key] = cached.data;
        }

        return allCached ? result : null;
    }

    /**
     * Vérifie si le cache est expiré
     * @param {number} timestamp - Timestamp à vérifier
     * @returns {boolean} Cache expiré ou non
     */
    function isCacheExpired(timestamp) {
        return Date.now() - timestamp > LOADER_CONFIG.CACHE_DURATION;
    }

    /**
     * Nettoyage du cache
     */
    function cleanCache() {
        const now = Date.now();
        for (const [key, value] of state.cache) {
            if (now - value.timestamp > LOADER_CONFIG.CACHE_DURATION) {
                state.cache.delete(key);
            }
        }
    }

    /**
     * Création d'un timeout
     * @param {number} ms - Délai en millisecondes
     * @returns {Promise} Promise de timeout
     */
    function createTimeout(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Loading timeout exceeded'));
            }, ms);
        });
    }

    /**
     * Mise à jour des statistiques
     * @param {string} type - Type de statistique
     */
    function updateStats(type) {
        state.stats[type]++;
        notifyStatsUpdate();
    }

    /**
     * Notification de mise à jour des statistiques
     */
    function notifyStatsUpdate() {
        window.dispatchEvent(new CustomEvent('data_loader_stats', {
            detail: { ...state.stats }
        }));
    }

    /**
     * Gestion des erreurs de chargement
     * @param {string|Array} keys - Clé(s) concernée(s)
     * @param {Error} error - Erreur survenue
     */
    function handleLoadError(keys, error) {
        const errorDetails = {
            keys: Array.isArray(keys) ? keys : [keys],
            error: error.message,
            timestamp: Date.now()
        };

        logLoadError(errorDetails);
        notifyLoadError(errorDetails);
    }

    /**
     * Log des erreurs de chargement
     * @param {Object} error - Détails de l'erreur
     */
    function logLoadError(error) {
        try {
            const logs = JSON.parse(
                localStorage.getItem(LOADER_CONFIG.LOADER_LOG_KEY) || '[]'
            );
            logs.push(error);

            if (logs.length > 1000) logs.shift();
            localStorage.setItem(
                LOADER_CONFIG.LOADER_LOG_KEY,
                JSON.stringify(logs)
            );
        } catch (error) {
            console.error('Failed to log load error:', error);
        }
    }

    /**
     * Notification des erreurs de chargement
     * @param {Object} error - Détails de l'erreur
     */
    function notifyLoadError(error) {
        window.dispatchEvent(new CustomEvent('data_loader_error', {
            detail: error
        }));
    }

    /**
     * Vérification du seuil de prefetch
     */
    function checkPrefetchThreshold() {
        const usedSpace = calculateUsedSpace();
        const totalSpace = calculateTotalSpace();
        
        if (usedSpace / totalSpace > LOADER_CONFIG.PREFETCH_THRESHOLD) {
            triggerPrefetch();
        }
    }

    /**
     * Calcul de l'espace utilisé
     * @returns {number} Espace utilisé
     */
    function calculateUsedSpace() {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            total += localStorage.getItem(key).length;
        }
        return total;
    }

    /**
     * Calcul de l'espace total
     * @returns {number} Espace total
     */
    function calculateTotalSpace() {
        let total = 0;
        try {
            for (let i = 0; i < 10; i++) {
                const testKey = `size_test_${i}`;
                const testValue = new Array(1024 * 1024).join('a');
                localStorage.setItem(testKey, testValue);
                total += testValue.length;
                localStorage.removeItem(testKey);
            }
        } catch (e) {
            // Espace plein atteint
        }
        return total;
    }

    /**
     * Déclenchement du prefetch
     */
    function triggerPrefetch() {
        // Implémentation du prefetch
        // À adapter selon vos besoins
    }

    // Interface publique
    return {
        loadData,
        getStats: () => ({ ...state.stats }),
        clearCache: () => state.cache.clear(),
        LOADER_CONFIG
    };
})();

export default dataLoaderService;