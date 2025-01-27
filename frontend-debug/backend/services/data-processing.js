// data-processing.js

import { handleError } from './error-handling.js';
import { logAction } from './logging.js';


function dataProcessingService() {
    // Configuration des constantes
    const PROCESSING_CONSTANTS = {
        BATCH_SIZE: 100,
        PROCESS_TIMEOUT: 5000,
        DEBUG_KEY: 'processing_debug'
    };

    const ERROR_CODES = {
        PROCESSING_ERROR: 'DATA_PROCESSING_ERROR',
        TIMEOUT_ERROR: 'PROCESSING_TIMEOUT',
        INTEGRITY_ERROR: 'DATA_INTEGRITY_ERROR',
        BATCH_ERROR: 'BATCH_PROCESSING_ERROR'
    };

    // Traitement principal des données
    async function processData(data, options = {}) {
        const processingStart = Date.now();
        const debugLog = [];

        try {
            // Prétraitement et validation
            const preparedData = await prepareData(data);
            logProcessingStep(debugLog, 'data_preparation', preparedData);

            // Traitement par lots si nécessaire
            const processingResult = await processInBatches(preparedData, options);
            logProcessingStep(debugLog, 'batch_processing', processingResult);

            // Post-traitement et vérification d'intégrité
            const finalResult = await postProcess(processingResult);
            logProcessingStep(debugLog, 'post_processing', finalResult);

            // Mise à jour du moniteur de traitement
            updateProcessingMonitor({
                success: true,
                duration: Date.now() - processingStart,
                processedItems: finalResult.length,
                debugLog
            });

            return {
                success: true,
                result: finalResult,
                metrics: generateMetrics(finalResult)
            };

        } catch (error) {
            const errorInfo = {
                error: error.message,
                duration: Date.now() - processingStart,
                debugLog
            };

            updateProcessingMonitor({
                success: false,
                ...errorInfo
            });

            return {
                success: false,
                error: error.message,
                debugLog
            };
        }
    }

    // Préparation des données
    async function prepareData(data) {
        try {
            // Validation de l'intégrité des données
            if (!verifyDataIntegrity(data)) {
                throw new Error(ERROR_CODES.INTEGRITY_ERROR);
            }

            // Normalisation des données
            return normalizeData(data);

        } catch (error) {
            throw new Error(`Preparation error: ${error.message}`);
        }
    }

    // Vérification de l'intégrité des données
    function verifyDataIntegrity(data) {
        try {
            // Vérification de la structure
            const requiredFields = ['id', 'timestamp', 'content'];
            const hasAllFields = requiredFields.every(field => data.hasOwnProperty(field));

            if (!hasAllFields) return false;

            // Vérification du checksum si présent
            if (data._meta?.checksum) {
                const calculatedChecksum = generateChecksum(data.content);
                return calculatedChecksum === data._meta.checksum;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    // Traitement par lots
    async function processInBatches(data, options) {
        const batches = [];
        const batchSize = options.batchSize || PROCESSING_CONSTANTS.BATCH_SIZE;

        // Création des lots
        for (let i = 0; i < data.length; i += batchSize) {
            batches.push(data.slice(i, i + batchSize));
        }

        // Traitement des lots avec timeout
        const results = await Promise.race([
            Promise.all(batches.map(processBatch)),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(ERROR_CODES.TIMEOUT_ERROR)), 
                PROCESSING_CONSTANTS.PROCESS_TIMEOUT)
            )
        ]);

        return results.flat();
    }

    // Traitement d'un lot individuel
    async function processBatch(batch) {
        try {
            return batch.map(item => ({
                ...item,
                processed: true,
                processedAt: new Date().toISOString()
            }));
        } catch (error) {
            throw new Error(`${ERROR_CODES.BATCH_ERROR}: ${error.message}`);
        }
    }

    // Post-traitement des données
    async function postProcess(data) {
        // Agrégation et finalisation des résultats
        const processed = data.map(item => ({
            ...item,
            _meta: {
                ...item._meta,
                finalizedAt: new Date().toISOString(),
                checksum: generateChecksum(item)
            }
        }));

        // Sauvegarde en cache si nécessaire
        try {
            cacheProcessedData(processed);
        } catch (error) {
            console.warn('Cache storage failed:', error);
        }

        return processed;
    }

    // Génération des métriques
    function generateMetrics(data) {
        return {
            totalItems: data.length,
            processingTime: Date.now() - data[0]?._meta?.startTime || 0,
            successRate: (data.filter(item => item.processed).length / data.length) * 100,
            timestamp: new Date().toISOString()
        };
    }

    // Mise en cache des données traitées
    function cacheProcessedData(data) {
        const cacheKey = `processed_${Date.now()}`;
        localStorage.setItem(cacheKey, JSON.stringify({
            data,
            timestamp: new Date().toISOString()
        }));

        // Nettoyage du cache ancien
        cleanupCache();
    }

    // Nettoyage du cache
    function cleanupCache() {
        const cacheLimit = 10;
        const cacheKeys = Object.keys(localStorage)
            .filter(key => key.startsWith('processed_'))
            .sort()
            .reverse();

        if (cacheKeys.length > cacheLimit) {
            cacheKeys.slice(cacheLimit).forEach(key => localStorage.removeItem(key));
        }
    }

    // Logging des étapes de traitement
    function logProcessingStep(debugLog, step, data) {
        debugLog.push({
            step,
            timestamp: new Date().toISOString(),
            itemCount: Array.isArray(data) ? data.length : 1,
            memoryUsage: getMemoryUsage()
        });
    }

    // Obtention de l'utilisation mémoire
    function getMemoryUsage() {
        if (window.performance && window.performance.memory) {
            return {
                usedJSHeapSize: window.performance.memory.usedJSHeapSize,
                totalJSHeapSize: window.performance.memory.totalJSHeapSize
            };
        }
        return null;
    }

    // Mise à jour du moniteur de traitement
    function updateProcessingMonitor(info) {
        try {
            const monitorKey = PROCESSING_CONSTANTS.DEBUG_KEY;
            const currentLogs = JSON.parse(localStorage.getItem(monitorKey) || '[]');
            
            currentLogs.push({
                ...info,
                timestamp: new Date().toISOString()
            });

            // Garder seulement les 50 derniers logs
            if (currentLogs.length > 50) {
                currentLogs.shift();
            }

            localStorage.setItem(monitorKey, JSON.stringify(currentLogs));

            // Émission d'événement pour le moniteur
            dispatchProcessingEvent('processing_update', info);

        } catch (error) {
            console.warn('Monitor update failed:', error);
        }
    }

    // Émission d'événements de traitement
    function dispatchProcessingEvent(type, data) {
        window.dispatchEvent(new CustomEvent('storage_monitor', {
            detail: {
                type,
                data,
                timestamp: new Date().toISOString()
            }
        }));
    }

    return {
        processData,
        getProcessingLogs: () => JSON.parse(localStorage.getItem(PROCESSING_CONSTANTS.DEBUG_KEY) || '[]'),
        ERROR_CODES,
        PROCESSING_CONSTANTS
    };
}

export default dataProcessingService;