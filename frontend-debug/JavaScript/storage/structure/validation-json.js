// validation-json.js

const jsonValidationService = (() => {
    // Configuration des constantes
    const JSON_CONFIG = {
        MAX_DEPTH: 10,
        MAX_STRING_LENGTH: 1000000, // 1MB
        MAX_ARRAY_LENGTH: 10000,
        MAX_OBJECT_KEYS: 1000,
        ALLOWED_TYPES: ['string', 'number', 'boolean', 'object', 'array', 'null'],
        SCHEMA_CACHE_PREFIX: '_schema_',
        VALIDATION_TIMEOUT: 5000 // 5 secondes
    };

    // Codes d'erreur
    const JSON_ERRORS = {
        INVALID_FORMAT: 'INVALID_JSON_FORMAT',
        MAX_DEPTH_EXCEEDED: 'MAX_DEPTH_EXCEEDED',
        MAX_LENGTH_EXCEEDED: 'MAX_STRING_LENGTH_EXCEEDED',
        INVALID_TYPE: 'INVALID_DATA_TYPE',
        SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
        CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE_DETECTED',
        VALIDATION_TIMEOUT: 'VALIDATION_TIMEOUT'
    };

    /**
     * Valide une chaîne JSON
     * @param {string|Object} data - Données à valider
     * @param {Object} options - Options de validation
     * @returns {boolean} Résultat de la validation
     */
    function validateJSON(data, options = {}) {
        const {
            schema = null,
            strictTypes = true,
            allowCircular = false,
            maxDepth = JSON_CONFIG.MAX_DEPTH
        } = options;

        try {
            // Conversion en chaîne si nécessaire
            const jsonString = typeof data === 'string' ? data : JSON.stringify(data);

            // Vérification de la taille
            if (jsonString.length > JSON_CONFIG.MAX_STRING_LENGTH) {
                logValidationError(JSON_ERRORS.MAX_LENGTH_EXCEEDED);
                return false;
            }

            // Parse avec timeout
            const parsed = parseWithTimeout(jsonString);
            if (!parsed) return false;

            // Validation de la structure
            if (!validateStructure(parsed, maxDepth, allowCircular)) {
                return false;
            }

            // Validation des types si stricte
            if (strictTypes && !validateTypes(parsed)) {
                return false;
            }

            // Validation du schéma si fourni
            if (schema && !validateSchema(parsed, schema)) {
                return false;
            }

            return true;

        } catch (error) {
            logValidationError(JSON_ERRORS.INVALID_FORMAT, error.message);
            return false;
        }
    }

    /**
     * Parse JSON avec timeout
     * @param {string} jsonString - Chaîne JSON à parser
     * @returns {Object|null} Objet parsé ou null en cas d'erreur
     */
    function parseWithTimeout(jsonString) {
        let timeoutId;
        
        try {
            return new Promise((resolve, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error(JSON_ERRORS.VALIDATION_TIMEOUT));
                }, JSON_CONFIG.VALIDATION_TIMEOUT);

                const result = JSON.parse(jsonString);
                clearTimeout(timeoutId);
                resolve(result);
            });
        } catch (error) {
            clearTimeout(timeoutId);
            logValidationError(JSON_ERRORS.INVALID_FORMAT, error.message);
            return null;
        }
    }

    /**
     * Valide la structure récursivement
     * @param {Object} obj - Objet à valider
     * @param {number} maxDepth - Profondeur maximale
     * @param {boolean} allowCircular - Autoriser les références circulaires
     * @param {Set} seen - Ensemble des objets déjà vus
     * @returns {boolean} Résultat de la validation
     */
    function validateStructure(obj, maxDepth, allowCircular, seen = new Set()) {
        // Vérification de la profondeur
        if (maxDepth <= 0) {
            logValidationError(JSON_ERRORS.MAX_DEPTH_EXCEEDED);
            return false;
        }

        // Vérification des références circulaires
        if (!allowCircular && seen.has(obj)) {
            logValidationError(JSON_ERRORS.CIRCULAR_REFERENCE);
            return false;
        }

        if (typeof obj === 'object' && obj !== null) {
            seen.add(obj);

            if (Array.isArray(obj)) {
                // Validation des tableaux
                if (obj.length > JSON_CONFIG.MAX_ARRAY_LENGTH) {
                    logValidationError(JSON_ERRORS.MAX_LENGTH_EXCEEDED);
                    return false;
                }

                return obj.every(item => 
                    validateStructure(item, maxDepth - 1, allowCircular, seen)
                );
            } else {
                // Validation des objets
                const keys = Object.keys(obj);
                if (keys.length > JSON_CONFIG.MAX_OBJECT_KEYS) {
                    logValidationError(JSON_ERRORS.MAX_LENGTH_EXCEEDED);
                    return false;
                }

                return keys.every(key => 
                    validateStructure(obj[key], maxDepth - 1, allowCircular, seen)
                );
            }
        }

        return true;
    }

    /**
     * Valide les types de données
     * @param {Object} obj - Objet à valider
     * @returns {boolean} Résultat de la validation
     */
    function validateTypes(obj) {
        const type = Array.isArray(obj) ? 'array' : typeof obj;
        
        if (!JSON_CONFIG.ALLOWED_TYPES.includes(type)) {
            logValidationError(JSON_ERRORS.INVALID_TYPE, `Type ${type} not allowed`);
            return false;
        }

        if (type === 'object' && obj !== null) {
            return Object.values(obj).every(validateTypes);
        }

        if (type === 'array') {
            return obj.every(validateTypes);
        }

        return true;
    }

    /**
     * Valide selon un schéma
     * @param {Object} data - Données à valider
     * @param {Object} schema - Schéma de validation
     * @returns {boolean} Résultat de la validation
     */
    function validateSchema(data, schema) {
        try {
            // Vérification du cache
            const schemaHash = generateSchemaHash(schema);
            const cacheKey = `${JSON_CONFIG.SCHEMA_CACHE_PREFIX}${schemaHash}`;
            
            // Validation avec le schéma
            const validator = new SchemaValidator(schema);
            const isValid = validator.validate(data);

            if (!isValid) {
                logValidationError(
                    JSON_ERRORS.SCHEMA_VALIDATION_FAILED,
                    validator.getErrors()
                );
            }

            return isValid;

        } catch (error) {
            logValidationError(JSON_ERRORS.SCHEMA_VALIDATION_FAILED, error.message);
            return false;
        }
    }

    /**
     * Génère un hash pour le schéma
     * @param {Object} schema - Schéma à hasher
     * @returns {string} Hash du schéma
     */
    function generateSchemaHash(schema) {
        const schemaString = JSON.stringify(schema);
        let hash = 0;
        
        for (let i = 0; i < schemaString.length; i++) {
            const char = schemaString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        return hash.toString(36);
    }

    /**
     * Log des erreurs de validation
     * @param {string} error - Type d'erreur
     * @param {string} details - Détails de l'erreur
     */
    function logValidationError(error, details = '') {
        try {
            const logs = JSON.parse(localStorage.getItem('json_validation_logs') || '[]');
            logs.push({
                error,
                details,
                timestamp: Date.now()
            });

            // Limitation du nombre de logs
            if (logs.length > 1000) {
                logs.shift();
            }

            localStorage.setItem('json_validation_logs', JSON.stringify(logs));

            // Notification du système de monitoring
            notifyValidationError(error, details);

        } catch (error) {
            console.error('Failed to log validation error:', error);
        }
    }

    /**
     * Notification des erreurs au système de monitoring
     * @param {string} error - Type d'erreur
     * @param {string} details - Détails de l'erreur
     */
    function notifyValidationError(error, details) {
        window.dispatchEvent(new CustomEvent('json_validation_error', {
            detail: {
                error,
                details,
                timestamp: Date.now()
            }
        }));
    }

    // Classe de validation de schéma
    class SchemaValidator {
        constructor(schema) {
            this.schema = schema;
            this.errors = [];
        }

        validate(data) {
            this.errors = [];
            return this.validateAgainstSchema(data, this.schema);
        }

        validateAgainstSchema(data, schema) {
            // Implémentation de la validation selon le schéma
            // À adapter selon vos besoins spécifiques
            return true;
        }

        getErrors() {
            return this.errors;
        }
    }

    // Interface publique
    return {
        validateJSON,
        validateSchema,
        getValidationLogs: () => JSON.parse(localStorage.getItem('json_validation_logs') || '[]'),
        JSON_ERRORS,
        JSON_CONFIG
    };
})();

export default jsonValidationService;