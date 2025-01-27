// keys-validator.js

const keysValidatorService = (() => {
    // Configuration des constantes
    const KEY_CONFIG = {
        MAX_LENGTH: 100,
        MIN_LENGTH: 3,
        RESERVED_PREFIXES: ['_system_', '_temp_', '_meta_', '_backup_'],
        ALLOWED_CHARACTERS: /^[a-zA-Z0-9_\-\.]+$/,
        NAMESPACE_SEPARATOR: ':',
        MAX_NAMESPACE_DEPTH: 3
    };

    // Codes d'erreur
    const KEY_ERRORS = {
        INVALID_LENGTH: 'KEY_LENGTH_INVALID',
        INVALID_CHARACTERS: 'INVALID_CHARACTERS_IN_KEY',
        RESERVED_PREFIX: 'RESERVED_PREFIX_USED',
        INVALID_NAMESPACE: 'INVALID_NAMESPACE_FORMAT',
        DUPLICATE_KEY: 'KEY_ALREADY_EXISTS',
        NAMESPACE_TOO_DEEP: 'NAMESPACE_DEPTH_EXCEEDED'
    };

    /**
     * Valide une clé de stockage
     * @param {string} key - Clé à valider
     * @param {Object} options - Options de validation
     * @returns {boolean} Résultat de la validation
     */
    function validateKey(key, options = {}) {
        const {
            allowReserved = false,
            checkDuplicate = true,
            enforceNamespace = false
        } = options;

        try {
            // Vérification basique
            if (!key || typeof key !== 'string') {
                return false;
            }

            // Vérification de la longueur
            if (key.length < KEY_CONFIG.MIN_LENGTH || key.length > KEY_CONFIG.MAX_LENGTH) {
                logValidationError(key, KEY_ERRORS.INVALID_LENGTH);
                return false;
            }

            // Vérification des caractères autorisés
            if (!KEY_CONFIG.ALLOWED_CHARACTERS.test(key)) {
                logValidationError(key, KEY_ERRORS.INVALID_CHARACTERS);
                return false;
            }

            // Vérification des préfixes réservés
            if (!allowReserved && hasReservedPrefix(key)) {
                logValidationError(key, KEY_ERRORS.RESERVED_PREFIX);
                return false;
            }

            // Vérification du namespace si requis
            if (enforceNamespace && !isValidNamespace(key)) {
                logValidationError(key, KEY_ERRORS.INVALID_NAMESPACE);
                return false;
            }

            // Vérification des doublons si demandé
            if (checkDuplicate && isDuplicateKey(key)) {
                logValidationError(key, KEY_ERRORS.DUPLICATE_KEY);
                return false;
            }

            return true;

        } catch (error) {
            logValidationError(key, error.message);
            return false;
        }
    }

    /**
     * Vérifie si une clé a un préfixe réservé
     * @param {string} key - Clé à vérifier
     * @returns {boolean} Résultat de la vérification
     */
    function hasReservedPrefix(key) {
        return KEY_CONFIG.RESERVED_PREFIXES.some(prefix => 
            key.toLowerCase().startsWith(prefix)
        );
    }

    /**
     * Vérifie si le namespace est valide
     * @param {string} key - Clé à vérifier
     * @returns {boolean} Résultat de la vérification
     */
    function isValidNamespace(key) {
        const parts = key.split(KEY_CONFIG.NAMESPACE_SEPARATOR);

        // Vérification de la profondeur
        if (parts.length > KEY_CONFIG.MAX_NAMESPACE_DEPTH) {
            logValidationError(key, KEY_ERRORS.NAMESPACE_TOO_DEEP);
            return false;
        }

        // Vérification de chaque partie
        return parts.every(part => 
            part.length > 0 && KEY_CONFIG.ALLOWED_CHARACTERS.test(part)
        );
    }

    /**
     * Vérifie si une clé existe déjà
     * @param {string} key - Clé à vérifier
     * @returns {boolean} True si la clé existe déjà
     */
    function isDuplicateKey(key) {
        return localStorage.getItem(key) !== null;
    }

    /**
     * Génère une clé unique basée sur un préfixe
     * @param {string} prefix - Préfixe de la clé
     * @returns {string} Clé unique générée
     */
    function generateUniqueKey(prefix) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 5);
        const key = `${prefix}_${timestamp}_${random}`;

        return key.length <= KEY_CONFIG.MAX_LENGTH ? key : key.substr(0, KEY_CONFIG.MAX_LENGTH);
    }

    /**
     * Normalise une clé
     * @param {string} key - Clé à normaliser
     * @returns {string} Clé normalisée
     */
    function normalizeKey(key) {
        return key
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_\-\.]/g, '');
    }

    /**
     * Log des erreurs de validation
     * @param {string} key - Clé concernée
     * @param {string} error - Type d'erreur
     */
    function logValidationError(key, error) {
        try {
            const logs = JSON.parse(localStorage.getItem('key_validation_logs') || '[]');
            logs.push({
                key,
                error,
                timestamp: Date.now()
            });

            // Limitation du nombre de logs
            if (logs.length > 1000) {
                logs.shift();
            }

            localStorage.setItem('key_validation_logs', JSON.stringify(logs));

            // Notification du système de monitoring
            notifyValidationError(key, error);

        } catch (error) {
            console.error('Failed to log validation error:', error);
        }
    }

    /**
     * Notification des erreurs au système de monitoring
     * @param {string} key - Clé concernée
     * @param {string} error - Type d'erreur
     */
    function notifyValidationError(key, error) {
        window.dispatchEvent(new CustomEvent('key_validation_error', {
            detail: {
                key,
                error,
                timestamp: Date.now()
            }
        }));
    }

    /**
     * Analyse les clés existantes
     * @returns {Object} Statistiques sur les clés
     */
    function analyzeKeys() {
        const stats = {
            total: 0,
            byNamespace: {},
            averageLength: 0,
            invalidKeys: [],
            duplicates: new Set()
        };

        // Analyse de toutes les clés
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            stats.total++;

            // Analyse du namespace
            const namespace = key.split(KEY_CONFIG.NAMESPACE_SEPARATOR)[0];
            stats.byNamespace[namespace] = (stats.byNamespace[namespace] || 0) + 1;

            // Calcul de la longueur moyenne
            stats.averageLength += key.length;

            // Vérification de la validité
            if (!validateKey(key, { checkDuplicate: false })) {
                stats.invalidKeys.push(key);
            }
        }

        if (stats.total > 0) {
            stats.averageLength /= stats.total;
        }

        return stats;
    }

    // Interface publique
    return {
        validateKey,
        generateUniqueKey,
        normalizeKey,
        analyzeKeys,
        getValidationLogs: () => JSON.parse(localStorage.getItem('key_validation_logs') || '[]'),
        KEY_ERRORS,
        KEY_CONFIG
    };
})();

export default keysValidatorService;