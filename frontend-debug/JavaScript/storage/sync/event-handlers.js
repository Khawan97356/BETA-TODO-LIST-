// event-handlers.js

import { autoSaveService } from './auto-save.js';
import { dataLoaderService } from './data-loader.js';

const eventHandlerService = (() => {
    // Configuration des constantes
    const HANDLER_CONFIG = {
        DEBOUNCE_DELAY: 300,
        THROTTLE_DELAY: 1000,
        MAX_LISTENERS: 100,
        EVENT_LOG_KEY: 'event_handler_logs',
        STORAGE_EVENTS: {
            SAVE: 'storage_save',
            DELETE: 'storage_delete',
            UPDATE: 'storage_update',
            ERROR: 'storage_error'
        }
    };

    // État interne
    const state = {
        listeners: new Map(),
        activeHandlers: new Set(),
        eventQueue: [],
        processingQueue: false,
        stats: {
            handled: 0,
            queued: 0,
            errors: 0
        }
    };

    /**
     * Initialisation du service
     */
    function initialize() {
        setupStorageEventListeners();
        setupFormEventListeners();
        setupWindowEventListeners();
        setupCustomEventListeners();
        
        // Démarrage du traitement de la queue
        startQueueProcessor();
    }

    /**
     * Configuration des écouteurs d'événements localStorage
     */
    function setupStorageEventListeners() {
        window.addEventListener('storage', debounce((event) => {
            handleStorageEvent(event);
        }, HANDLER_CONFIG.DEBOUNCE_DELAY));

        // Écoute des événements de quota dépassé
        window.addEventListener('quotaexceeded', (event) => {
            handleQuotaExceeded(event);
        });
    }

    /**
     * Configuration des écouteurs d'événements de formulaire
     */
    function setupFormEventListeners() {
        document.addEventListener('input', throttle((event) => {
            if (shouldHandleFormEvent(event)) {
                handleFormEvent(event);
            }
        }, HANDLER_CONFIG.THROTTLE_DELAY));

        document.addEventListener('change', (event) => {
            if (shouldHandleFormEvent(event)) {
                handleFormEvent(event);
            }
        });
    }

    /**
     * Configuration des écouteurs d'événements window
     */
    function setupWindowEventListeners() {
        window.addEventListener('beforeunload', (event) => {
            handleBeforeUnload(event);
        });

        window.addEventListener('online', () => {
            handleConnectivityChange(true);
        });

        window.addEventListener('offline', () => {
            handleConnectivityChange(false);
        });
    }

    /**
     * Configuration des écouteurs d'événements personnalisés
     */
    function setupCustomEventListeners() {
        // Événements d'auto-save
        window.addEventListener('auto_save_update', (event) => {
            handleAutoSaveEvent(event.detail);
        });

        // Événements de chargement de données
        window.addEventListener('data_loader_error', (event) => {
            handleDataLoaderError(event.detail);
        });

        // Événements de monitoring
        window.addEventListener('storage_monitor_alert', (event) => {
            handleMonitorAlert(event.detail);
        });
    }

    /**
     * Gestion des événements localStorage
     * @param {StorageEvent} event - Événement storage
     */
    function handleStorageEvent(event) {
        try {
            if (!event.key) return;

            const eventData = {
                type: determineEventType(event),
                key: event.key,
                oldValue: event.oldValue,
                newValue: event.newValue,
                timestamp: Date.now()
            };

            queueEvent(eventData);
            notifyStorageChange(eventData);

        } catch (error) {
            handleError('storage_event', error);
        }
    }

    /**
     * Gestion des événements de formulaire
     * @param {Event} event - Événement de formulaire
     */
    function handleFormEvent(event) {
        try {
            const formData = {
                element: event.target,
                value: getElementValue(event.target),
                timestamp: Date.now()
            };

            autoSaveService.queueChange(event.target);
            notifyFormChange(formData);

        } catch (error) {
            handleError('form_event', error);
        }
    }

    /**
     * Gestion de l'événement beforeunload
     * @param {BeforeUnloadEvent} event - Événement beforeunload
     */
    function handleBeforeUnload(event) {
        try {
            // Sauvegarde des modifications en attente
            if (state.eventQueue.length > 0) {
                event.preventDefault();
                event.returnValue = '';
                
                // Traitement synchrone de la queue
                processQueueSync();
            }

        } catch (error) {
            handleError('unload_event', error);
        }
    }

    /**
     * Gestion des changements de connectivité
     * @param {boolean} isOnline - État de la connexion
     */
    function handleConnectivityChange(isOnline) {
        try {
            if (isOnline) {
                // Synchronisation des données
                syncPendingChanges();
            } else {
                // Activation du mode hors ligne
                enableOfflineMode();
            }

            notifyConnectivityChange(isOnline);

        } catch (error) {
            handleError('connectivity_event', error);
        }
    }

    /**
     * Gestion du dépassement de quota
     * @param {Event} event - Événement quotaexceeded
     */
    function handleQuotaExceeded(event) {
        try {
            // Notification du système de monitoring
            notifyQuotaExceeded({
                timestamp: Date.now(),
                availableSpace: calculateAvailableSpace()
            });

            // Tentative de nettoyage
            cleanupStorage();

        } catch (error) {
            handleError('quota_event', error);
        }
    }

    /**
     * Mise en queue d'un événement
     * @param {Object} eventData - Données de l'événement
     */
    function queueEvent(eventData) {
        state.eventQueue.push(eventData);
        state.stats.queued++;
        
        if (!state.processingQueue) {
            startQueueProcessor();
        }
    }

    /**
     * Démarrage du processeur de queue
     */
    function startQueueProcessor() {
        if (state.processingQueue) return;

        state.processingQueue = true;
        processQueue();
    }

    /**
     * Traitement de la queue d'événements
     */
    async function processQueue() {
        while (state.eventQueue.length > 0) {
            const event = state.eventQueue.shift();
            try {
                await processEvent(event);
                state.stats.handled++;
            } catch (error) {
                handleError('queue_processing', error);
                state.stats.errors++;
            }
        }

        state.processingQueue = false;
    }

    /**
     * Traitement synchrone de la queue
     */
    function processQueueSync() {
        state.eventQueue.forEach(event => {
            try {
                processEventSync(event);
                state.stats.handled++;
            } catch (error) {
                handleError('sync_processing', error);
                state.stats.errors++;
            }
        });

        state.eventQueue = [];
    }

    /**
     * Traitement d'un événement
     * @param {Object} event - Événement à traiter
     */
    async function processEvent(event) {
        switch (event.type) {
            case HANDLER_CONFIG.STORAGE_EVENTS.SAVE:
                await handleSaveEvent(event);
                break;
            case HANDLER_CONFIG.STORAGE_EVENTS.DELETE:
                await handleDeleteEvent(event);
                break;
            case HANDLER_CONFIG.STORAGE_EVENTS.UPDATE:
                await handleUpdateEvent(event);
                break;
            default:
                console.warn('Unknown event type:', event.type);
        }
    }

    /**
     * Utilitaire de debounce
     * @param {Function} func - Fonction à debounce
     * @param {number} wait - Délai d'attente
     * @returns {Function} Fonction debounced
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Utilitaire de throttle
     * @param {Function} func - Fonction à throttle
     * @param {number} limit - Délai limite
     * @returns {Function} Fonction throttled
     */
    function throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Notification des changements
     * @param {Object} data - Données du changement
     */
    function notifyStorageChange(data) {
        window.dispatchEvent(new CustomEvent('storage_change', {
            detail: data
        }));
    }

    /**
     * Notification des erreurs
     * @param {string} context - Contexte de l'erreur
     * @param {Error} error - Erreur survenue
     */
    function handleError(context, error) {
        const errorData = {
            context,
            message: error.message,
            timestamp: Date.now()
        };

        logError(errorData);
        notifyError(errorData);
    }

    /**
     * Log des erreurs
     * @param {Object} error - Détails de l'erreur
     */
    function logError(error) {
        try {
            const logs = JSON.parse(
                localStorage.getItem(HANDLER_CONFIG.EVENT_LOG_KEY) || '[]'
            );
            logs.push(error);

            if (logs.length > 1000) logs.shift();
            localStorage.setItem(
                HANDLER_CONFIG.EVENT_LOG_KEY,
                JSON.stringify(logs)
            );
        } catch (error) {
            console.error('Failed to log error:', error);
        }
    }

    // Interface publique
    return {
        initialize,
        getStats: () => ({ ...state.stats }),
        clearQueue: () => {
            state.eventQueue = [];
            state.processingQueue = false;
        },
        HANDLER_CONFIG
    };
})();

export default eventHandlerService;