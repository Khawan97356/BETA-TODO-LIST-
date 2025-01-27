// page-refresh.js
import { dataLoaderService } from './data-loader.js';

const pageRefreshService = (() => {
    // Configuration des constantes
    const REFRESH_CONFIG = {
        AUTO_REFRESH_INTERVAL: 300000, // 5 minutes
        SOFT_REFRESH_DELAY: 1000,
        HARD_REFRESH_DELAY: 2000,
        MAX_RETRY_ATTEMPTS: 3,
        REFRESH_LOG_KEY: 'page_refresh_logs',
        STATE_KEY: '_page_refresh_state',
        SNAPSHOT_KEY: '_page_refresh_snapshot'
    };

    // État interne
    const state = {
        lastRefresh: Date.now(),
        pendingChanges: new Set(),
        refreshTimer: null,
        isRefreshing: false,
        retryCount: 0,
        stats: {
            softRefreshes: 0,
            hardRefreshes: 0,
            errors: 0
        }
    };

    /**
     * Initialisation du service
     * @param {Object} options - Options de configuration
     */
    function initialize(options = {}) {
        const {
            autoRefresh = true,
            interval = REFRESH_CONFIG.AUTO_REFRESH_INTERVAL
        } = options;

        // Restauration de l'état précédent
        restoreState();

        // Configuration des écouteurs d'événements
        setupEventListeners();

        // Démarrage de l'auto-refresh si activé
        if (autoRefresh) {
            startAutoRefresh(interval);
        }

        // Création d'un snapshot initial
        createSnapshot();
    }

    /**
     * Configuration des écouteurs d'événements
     */
    function setupEventListeners() {
        // Événements de stockage
        window.addEventListener('storage', (event) => {
            handleStorageChange(event);
        });

        // Événements de visibilité
        document.addEventListener('visibilitychange', () => {
            handleVisibilityChange();
        });

        // Événements de focus
        window.addEventListener('focus', () => {
            checkForUpdates();
        });

        // Événements personnalisés
        window.addEventListener('data_update', (event) => {
            handleDataUpdate(event.detail);
        });
    }

    /**
     * Démarrage de l'auto-refresh
     * @param {number} interval - Intervalle de rafraîchissement
     */
    function startAutoRefresh(interval) {
        stopAutoRefresh(); // Arrêt du timer existant

        state.refreshTimer = setInterval(() => {
            if (shouldRefresh()) {
                softRefresh();
            }
        }, interval);
    }

    /**
     * Arrêt de l'auto-refresh
     */
    function stopAutoRefresh() {
        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
            state.refreshTimer = null;
        }
    }

    /**
     * Rafraîchissement doux (sans rechargement de page)
     * @returns {Promise<boolean>} Succès du rafraîchissement
     */
    async function softRefresh() {
        if (state.isRefreshing) return false;

        try {
            state.isRefreshing = true;
            
            // Sauvegarde de l'état actuel
            saveState();

            // Rechargement des données
            await reloadData();

            // Mise à jour de l'interface
            updateInterface();

            state.stats.softRefreshes++;
            state.lastRefresh = Date.now();
            state.isRefreshing = false;

            notifyRefreshSuccess('soft');
            return true;

        } catch (error) {
            handleRefreshError('soft', error);
            return false;
        }
    }

    /**
     * Rafraîchissement dur (avec rechargement de page)
     */
    function hardRefresh() {
        try {
            // Sauvegarde de l'état avant rechargement
            saveState();
            
            state.stats.hardRefreshes++;
            
            // Délai court pour assurer la sauvegarde
            setTimeout(() => {
                window.location.reload(true);
            }, REFRESH_CONFIG.HARD_REFRESH_DELAY);

        } catch (error) {
            handleRefreshError('hard', error);
        }
    }

    /**
     * Rechargement des données
     * @returns {Promise<void>}
     */
    async function reloadData() {
        const keys = Array.from(state.pendingChanges);
        if (keys.length === 0) return;

        try {
            const data = await dataLoaderService.loadData(keys, {
                validate: true,
                useCache: false
            });

            updateDataInDOM(data);
            state.pendingChanges.clear();

        } catch (error) {
            throw new Error('Failed to reload data: ' + error.message);
        }
    }

    /**
     * Mise à jour des données dans le DOM
     * @param {Object} data - Données à mettre à jour
     */
    function updateDataInDOM(data) {
        Object.entries(data).forEach(([key, value]) => {
            const elements = document.querySelectorAll(`[data-storage-key="${key}"]`);
            elements.forEach(element => {
                updateElement(element, value);
            });
        });
    }

    /**
     * Mise à jour d'un élément
     * @param {HTMLElement} element - Élément à mettre à jour
     * @param {*} value - Nouvelle valeur
     */
    function updateElement(element, value) {
        if (element.tagName === 'INPUT') {
            element.value = value;
        } else if (element.tagName === 'SELECT') {
            element.value = value;
        } else {
            element.textContent = value;
        }

        // Déclenchement d'un événement de mise à jour
        element.dispatchEvent(new CustomEvent('value_updated', {
            detail: { value }
        }));
    }

    /**
     * Création d'un snapshot de l'état
     */
    function createSnapshot() {
        try {
            const snapshot = {
                timestamp: Date.now(),
                forms: captureFormStates(),
                scroll: {
                    x: window.scrollX,
                    y: window.scrollY
                }
            };

            localStorage.setItem(REFRESH_CONFIG.SNAPSHOT_KEY, JSON.stringify(snapshot));
        } catch (error) {
            console.error('Failed to create snapshot:', error);
        }
    }

    /**
     * Capture de l'état des formulaires
     * @returns {Object} État des formulaires
     */
    function captureFormStates() {
        const forms = {};
        document.querySelectorAll('form').forEach(form => {
            const formData = new FormData(form);
            forms[form.id || form.name] = Object.fromEntries(formData.entries());
        });
        return forms;
    }

    /**
     * Restauration de l'état
     */
    function restoreState() {
        try {
            const savedState = localStorage.getItem(REFRESH_CONFIG.STATE_KEY);
            if (savedState) {
                const parsed = JSON.parse(savedState);
                Object.assign(state, parsed);
                localStorage.removeItem(REFRESH_CONFIG.STATE_KEY);
            }

            // Restauration du snapshot si nécessaire
            restoreSnapshot();

        } catch (error) {
            console.error('Failed to restore state:', error);
        }
    }

    /**
     * Restauration du snapshot
     */
    function restoreSnapshot() {
        try {
            const snapshot = localStorage.getItem(REFRESH_CONFIG.SNAPSHOT_KEY);
            if (snapshot) {
                const parsed = JSON.parse(snapshot);
                
                // Restauration des formulaires
                restoreFormStates(parsed.forms);
                
                // Restauration du scroll
                window.scrollTo(parsed.scroll.x, parsed.scroll.y);
                
                localStorage.removeItem(REFRESH_CONFIG.SNAPSHOT_KEY);
            }
        } catch (error) {
            console.error('Failed to restore snapshot:', error);
        }
    }

    /**
     * Restauration de l'état des formulaires
     * @param {Object} formStates - États des formulaires
     */
    function restoreFormStates(formStates) {
        Object.entries(formStates).forEach(([formId, data]) => {
            const form = document.getElementById(formId) || 
                        document.querySelector(`form[name="${formId}"]`);
            if (form) {
                Object.entries(data).forEach(([name, value]) => {
                    const input = form.elements[name];
                    if (input) {
                        input.value = value;
                    }
                });
            }
        });
    }

    /**
     * Vérification du besoin de rafraîchissement
     * @returns {boolean} Nécessité de rafraîchir
     */
    function shouldRefresh() {
        return (
            !state.isRefreshing &&
            state.pendingChanges.size > 0 &&
            document.visibilityState === 'visible'
        );
    }

    /**
     * Gestion des changements de stockage
     * @param {StorageEvent} event - Événement storage
     */
    function handleStorageChange(event) {
        if (!event.key) return;

        state.pendingChanges.add(event.key);
        if (shouldRefresh()) {
            softRefresh();
        }
    }

    /**
     * Gestion des changements de visibilité
     */
    function handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            checkForUpdates();
        }
    }

    /**
     * Vérification des mises à jour
     */
    async function checkForUpdates() {
        if (state.pendingChanges.size > 0) {
            await softRefresh();
        }
    }

    /**
     * Gestion des erreurs de rafraîchissement
     * @param {string} type - Type de rafraîchissement
     * @param {Error} error - Erreur survenue
     */
    function handleRefreshError(type, error) {
        state.stats.errors++;
        state.isRefreshing = false;

        const errorData = {
            type,
            message: error.message,
            timestamp: Date.now()
        };

        logError(errorData);
        notifyRefreshError(errorData);

        // Tentative de récupération
        if (state.retryCount < REFRESH_CONFIG.MAX_RETRY_ATTEMPTS) {
            state.retryCount++;
            setTimeout(softRefresh, REFRESH_CONFIG.SOFT_REFRESH_DELAY);
        } else {
            state.retryCount = 0;
            hardRefresh();
        }
    }

    /**
     * Log des erreurs
     * @param {Object} error - Détails de l'erreur
     */
    function logError(error) {
        try {
            const logs = JSON.parse(
                localStorage.getItem(REFRESH_CONFIG.REFRESH_LOG_KEY) || '[]'
            );
            logs.push(error);

            if (logs.length > 1000) logs.shift();
            localStorage.setItem(
                REFRESH_CONFIG.REFRESH_LOG_KEY,
                JSON.stringify(logs)
            );
        } catch (error) {
            console.error('Failed to log refresh error:', error);
        }
    }

    /**
     * Notification de succès du rafraîchissement
     * @param {string} type - Type de rafraîchissement
     */
    function notifyRefreshSuccess(type) {
        window.dispatchEvent(new CustomEvent('page_refresh_success', {
            detail: {
                type,
                timestamp: Date.now()
            }
        }));
    }

    /**
     * Notification d'erreur de rafraîchissement
     * @param {Object} error - Détails de l'erreur
     */
    function notifyRefreshError(error) {
        window.dispatchEvent(new CustomEvent('page_refresh_error', {
            detail: error
        }));
    }

    // Interface publique
    return {
        initialize,
        softRefresh,
        hardRefresh,
        getStats: () => ({ ...state.stats }),
        getPendingChanges: () => Array.from(state.pendingChanges),
        REFRESH_CONFIG
    };
})();

export default pageRefreshService;