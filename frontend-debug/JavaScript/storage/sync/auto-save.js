// auto-save.js

import { saveData } from '../crud/storage-save.js';

const autoSaveService = (() => {
    // Configuration des constantes
    const AUTO_SAVE_CONFIG = {
        INTERVAL: 30000, // 30 secondes
        DEBOUNCE_DELAY: 1000, // 1 seconde
        MAX_QUEUE_SIZE: 100,
        BACKUP_INTERVAL: 300000, // 5 minutes
        MAX_RETRIES: 3,
        RETRY_DELAY: 2000,
        AUTO_SAVE_LOG_KEY: 'auto_save_logs'
    };

    // État interne
    const state = {
        isEnabled: false,
        queue: new Map(),
        timers: new Map(),
        backupTimer: null,
        retryCount: new Map(),
        lastSave: new Map()
    };

    /**
     * Initialisation du service d'auto-save
     * @param {Object} options - Options de configuration
     */
    function initialize(options = {}) {
        const {
            interval = AUTO_SAVE_CONFIG.INTERVAL,
            enableBackup = true
        } = options;

        state.isEnabled = true;

        // Démarrage de l'auto-save périodique
        startPeriodicSave(interval);

        // Démarrage des sauvegardes automatiques si activées
        if (enableBackup) {
            startPeriodicBackup();
        }

        // Ajout des écouteurs d'événements
        setupEventListeners();

        notifyInitialization();
    }

    /**
     * Démarre la sauvegarde périodique
     * @param {number} interval - Intervalle de sauvegarde
     */
    function startPeriodicSave(interval) {
        setInterval(() => {
            processQueue();
        }, interval);
    }

    /**
     * Configuration des écouteurs d'événements
     */
    function setupEventListeners() {
        // Écoute des modifications de formulaire
        document.addEventListener('input', debounce((event) => {
            if (shouldTrackElement(event.target)) {
                queueChange(event.target);
            }
        }, AUTO_SAVE_CONFIG.DEBOUNCE_DELAY));

        // Écoute de la fermeture de la page
        window.addEventListener('beforeunload', () => {
            if (state.queue.size > 0) {
                processQueueImmediately();
            }
        });

        // Écoute des erreurs de stockage
        window.addEventListener('storage_error', handleStorageError);
    }

    /**
     * Vérifie si un élément doit être suivi
     * @param {HTMLElement} element - Élément à vérifier
     * @returns {boolean} Doit être suivi ou non
     */
    function shouldTrackElement(element) {
        return (
            element.hasAttribute('data-auto-save') ||
            element.closest('[data-auto-save]')
        );
    }

    /**
     * Ajoute un changement à la queue
     * @param {HTMLElement} element - Élément modifié
     */
    function queueChange(element) {
        if (!state.isEnabled) return;

        const key = getStorageKey(element);
        const value = getElementValue(element);

        // Vérification de la taille de la queue
        if (state.queue.size >= AUTO_SAVE_CONFIG.MAX_QUEUE_SIZE) {
            processQueueImmediately();
        }

        state.queue.set(key, {
            value,
            timestamp: Date.now(),
            element: element
        });

        // Notification de la mise en queue
        notifyQueueUpdate(key, 'queued');
    }

    /**
     * Traitement de la queue de sauvegarde
     */
    async function processQueue() {
        if (state.queue.size === 0) return;

        const entries = Array.from(state.queue.entries());
        state.queue.clear();

        for (const [key, data] of entries) {
            try {
                await saveWithRetry(key, data.value);
                updateLastSave(key);
                notifyQueueUpdate(key, 'saved');
            } catch (error) {
                handleSaveError(key, error);
            }
        }
    }

    /**
     * Sauvegarde avec retry automatique
     * @param {string} key - Clé de stockage
     * @param {any} value - Valeur à sauvegarder
     */
    async function saveWithRetry(key, value) {
        const retries = state.retryCount.get(key) || 0;

        try {
            await storageSaveService.saveItem(key, value);
            state.retryCount.delete(key);
        } catch (error) {
            if (retries < AUTO_SAVE_CONFIG.MAX_RETRIES) {
                state.retryCount.set(key, retries + 1);
                await new Promise(resolve => 
                    setTimeout(resolve, AUTO_SAVE_CONFIG.RETRY_DELAY)
                );
                return saveWithRetry(key, value);
            }
            throw error;
        }
    }

    /**
     * Démarrage des sauvegardes périodiques
     */
    function startPeriodicBackup() {
        state.backupTimer = setInterval(() => {
            createBackup();
        }, AUTO_SAVE_CONFIG.BACKUP_INTERVAL);
    }

    /**
     * Création d'une sauvegarde
     */
    async function createBackup() {
        const timestamp = Date.now();
        const backup = {
            timestamp,
            data: {}
        };

        // Collecte des données à sauvegarder
        document.querySelectorAll('[data-auto-save]').forEach(element => {
            const key = getStorageKey(element);
            backup.data[key] = getElementValue(element);
        });

        try {
            await storageSaveService.saveItem(
                `backup_${timestamp}`,
                backup
            );
            cleanupOldBackups();
        } catch (error) {
            console.error('Backup creation failed:', error);
        }
    }

    /**
     * Nettoyage des anciennes sauvegardes
     */
    function cleanupOldBackups() {
        const maxBackups = 5;
        const backups = [];

        // Collecte des sauvegardes
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('backup_')) {
                backups.push(key);
            }
        }

        // Suppression des plus anciennes
        if (backups.length > maxBackups) {
            backups
                .sort()
                .slice(0, backups.length - maxBackups)
                .forEach(key => localStorage.removeItem(key));
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
     * Obtient la clé de stockage pour un élément
     * @param {HTMLElement} element - Élément HTML
     * @returns {string} Clé de stockage
     */
    function getStorageKey(element) {
        return element.getAttribute('data-auto-save') || 
               element.id || 
               generateKey(element);
    }

    /**
     * Génère une clé unique pour un élément
     * @param {HTMLElement} element - Élément HTML
     * @returns {string} Clé générée
     */
    function generateKey(element) {
        const path = getElementPath(element);
        return `auto_save_${path}_${Date.now()}`;
    }

    /**
     * Obtient le chemin DOM d'un élément
     * @param {HTMLElement} element - Élément HTML
     * @returns {string} Chemin de l'élément
     */
    function getElementPath(element) {
        const path = [];
        let current = element;

        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
                selector += `#${current.id}`;
            } else if (current.className) {
                selector += `.${current.className.split(' ').join('.')}`;
            }
            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

    /**
     * Obtient la valeur d'un élément
     * @param {HTMLElement} element - Élément HTML
     * @returns {any} Valeur de l'élément
     */
    function getElementValue(element) {
        if (element.type === 'checkbox') {
            return element.checked;
        } else if (element.type === 'radio') {
            return element.checked ? element.value : null;
        } else if (element.tagName === 'SELECT' && element.multiple) {
            return Array.from(element.selectedOptions).map(opt => opt.value);
        } else {
            return element.value;
        }
    }

    /**
     * Mise à jour de la dernière sauvegarde
     * @param {string} key - Clé sauvegardée
     */
    function updateLastSave(key) {
        state.lastSave.set(key, Date.now());
    }

    /**
     * Gestion des erreurs de sauvegarde
     * @param {string} key - Clé concernée
     * @param {Error} error - Erreur survenue
     */
    function handleSaveError(key, error) {
        console.error(`Auto-save failed for ${key}:`, error);
        logAutoSaveError(key, error);
        notifyQueueUpdate(key, 'error', error.message);
    }

    /**
     * Log des erreurs d'auto-save
     * @param {string} key - Clé concernée
     * @param {Error} error - Erreur survenue
     */
    function logAutoSaveError(key, error) {
        try {
            const logs = JSON.parse(
                localStorage.getItem(AUTO_SAVE_CONFIG.AUTO_SAVE_LOG_KEY) || '[]'
            );
            logs.push({
                key,
                error: error.message,
                timestamp: Date.now()
            });

            if (logs.length > 1000) logs.shift();
            localStorage.setItem(
                AUTO_SAVE_CONFIG.AUTO_SAVE_LOG_KEY,
                JSON.stringify(logs)
            );
        } catch (error) {
            console.error('Failed to log auto-save error:', error);
        }
    }

    /**
     * Notification des changements d'état
     * @param {string} key - Clé concernée
     * @param {string} status - Statut de la modification
     * @param {string} error - Message d'erreur éventuel
     */
    function notifyQueueUpdate(key, status, error = null) {
        window.dispatchEvent(new CustomEvent('auto_save_update', {
            detail: {
                key,
                status,
                error,
                timestamp: Date.now()
            }
        }));
    }

    /**
     * Notification de l'initialisation
     */
    function notifyInitialization() {
        window.dispatchEvent(new CustomEvent('auto_save_initialized', {
            detail: {
                timestamp: Date.now(),
                config: AUTO_SAVE_CONFIG
            }
        }));
    }

    // Interface publique
    return {
        initialize,
        processQueueImmediately: processQueue,
        getState: () => ({
            isEnabled: state.isEnabled,
            queueSize: state.queue.size,
            lastSaves: Object.fromEntries(state.lastSave)
        }),
        disable: () => {
            state.isEnabled = false;
            if (state.backupTimer) {
                clearInterval(state.backupTimer);
            }
        },
        enable: () => {
            state.isEnabled = true;
            startPeriodicSave(AUTO_SAVE_CONFIG.INTERVAL);
        },
        AUTO_SAVE_CONFIG
    };
})();

export default autoSaveService;