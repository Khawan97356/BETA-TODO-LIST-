// event-handlers.js

// Intégration de autoSaveService
const autoSaveService = (() => {
    const state = {
        queue: new Map(),
        isEnabled: true,
        config: {
            INTERVAL: 30000,
            DEBOUNCE_DELAY: 1000,
            MAX_QUEUE_SIZE: 100
        }
    };

    const queueChange = (element) => {
        if (!state.isEnabled) return;

        const key = element.getAttribute('data-auto-save') || 
                   element.id || 
                   `auto_save_${Date.now()}`;

        const value = element.type === 'checkbox' ? element.checked : element.value;

        state.queue.set(key, {
            value,
            timestamp: Date.now(),
            element: element
        });

        if (state.queue.size >= state.config.MAX_QUEUE_SIZE) {
            processQueue();
        }
    };

    const processQueue = async () => {
        for (const [key, data] of state.queue.entries()) {
            try {
                await localStorage.setItem(key, JSON.stringify(data.value));
                state.queue.delete(key);
            } catch (error) {
                console.error(`Auto-save failed for ${key}:`, error);
            }
        }
    };

    return {
        queueChange,
        processQueue,
        isEnabled: () => state.isEnabled,
        getQueue: () => state.queue,
        enable: () => state.isEnabled = true,
        disable: () => state.isEnabled = false
    };
})();

// Intégration de dataLoaderService
const dataLoaderService = (() => {
    const state = {
        isLoading: false,
        cache: new Map(),
        errors: [],
        config: {
            MAX_CACHE_SIZE: 100,
            CACHE_DURATION: 300000 // 5 minutes
        }
    };

    const loadData = async (key) => {
        state.isLoading = true;
        try {
            // Vérifier le cache d'abord
            const cachedData = state.cache.get(key);
            if (cachedData && 
                Date.now() - cachedData.timestamp < state.config.CACHE_DURATION) {
                return cachedData.data;
            }

            const data = localStorage.getItem(key);
            if (data) {
                const parsedData = JSON.parse(data);
                
                // Mise en cache
                state.cache.set(key, {
                    data: parsedData,
                    timestamp: Date.now()
                });

                // Nettoyage du cache si nécessaire
                if (state.cache.size > state.config.MAX_CACHE_SIZE) {
                    const oldestKey = Array.from(state.cache.keys())[0];
                    state.cache.delete(oldestKey);
                }

                return parsedData;
            }
            return null;
        } catch (error) {
            state.errors.push({
                key,
                error: error.message,
                timestamp: Date.now()
            });
            throw error;
        } finally {
            state.isLoading = false;
        }
    };

    const clearCache = () => {
        state.cache.clear();
    };

    const removeFromCache = (key) => {
        state.cache.delete(key);
    };

    return {
        loadData,
        clearCache,
        removeFromCache,
        getState: () => ({
            isLoading: state.isLoading,
            cacheSize: state.cache.size,
            errors: [...state.errors]
        })
    };
})();

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
     * Vérification si l'événement de formulaire doit être traité
     */
    function shouldHandleFormEvent(event) {
        return event.target && 
               (event.target.hasAttribute('data-auto-save') || 
                event.target.form && event.target.form.hasAttribute('data-auto-save'));
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
        window.addEventListener('auto_save_update', (event) => {
            handleAutoSaveEvent(event.detail);
        });

        window.addEventListener('data_loader_error', (event) => {
            handleDataLoaderError(event.detail);
        });

        window.addEventListener('storage_monitor_alert', (event) => {
            handleMonitorAlert(event.detail);
        });
    }

    /**
     * Gestion des événements localStorage
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
     * Détermination du type d'événement
     */
    function determineEventType(event) {
        if (!event.oldValue && event.newValue) return HANDLER_CONFIG.STORAGE_EVENTS.SAVE;
        if (event.oldValue && !event.newValue) return HANDLER_CONFIG.STORAGE_EVENTS.DELETE;
        return HANDLER_CONFIG.STORAGE_EVENTS.UPDATE;
    }

    /**
     * Gestion des événements de formulaire
     */
    function handleFormEvent(event) {
        try {
            const formData = {
                element: event.target,
                value: event.target.value,
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
     */
    function handleBeforeUnload(event) {
        try {
            if (state.eventQueue.length > 0 || autoSaveService.getQueue().size > 0) {
                event.preventDefault();
                event.returnValue = '';
                processQueueSync();
                autoSaveService.processQueue();
            }
        } catch (error) {
            handleError('unload_event', error);
        }
    }

    /**
     * Gestion des changements de connectivité
     */
    function handleConnectivityChange(isOnline) {
        try {
            if (isOnline) {
                syncPendingChanges();
                autoSaveService.enable();
            } else {
                enableOfflineMode();
                autoSaveService.disable();
            }

            notifyConnectivityChange(isOnline);
        } catch (error) {
            handleError('connectivity_event', error);
        }
    }

    /**
     * Synchronisation des changements en attente
     */
    async function syncPendingChanges() {
        await processQueue();
        await autoSaveService.processQueue();
    }

    /**
     * Activation du mode hors ligne
     */
    function enableOfflineMode() {
        // Implementation du mode hors ligne
    }

    /**
     * Traitement synchrone de la queue
     */
    function processQueueSync() {
        while (state.eventQueue.length > 0) {
            const event = state.eventQueue.shift();
            try {
                processEventSync(event);
                state.stats.handled++;
            } catch (error) {
                handleError('sync_processing', error);
                state.stats.errors++;
            }
        }
    }

    /**
     * Utilitaires
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