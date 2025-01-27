// validation.js
import { handleError } from '../../services/error-handling.js';
function validationMiddleware() {
    // Configuration des constantes
    const VALIDATION_RULES = {
        MAX_KEY_LENGTH: 50,
        MAX_VALUE_SIZE: 5242880, // 5MB
        ALLOWED_TYPES: ['string', 'number', 'boolean', 'object', 'array']
    };

    const ERROR_CODES = {
        JSON_INVALID: 'INVALID_JSON_FORMAT',
        KEY_INVALID: 'INVALID_KEY_FORMAT',
        VALUE_TOO_LARGE: 'VALUE_SIZE_EXCEEDED',
        TYPE_INVALID: 'INVALID_DATA_TYPE',
        INTEGRITY_FAILED: 'DATA_INTEGRITY_CHECK_FAILED'
    };


    // frontend-debug/backend/api/middleware/validation.js

export const validation = {
    // Validation d'ID
    validateId: (id) => {
        if (!id) return false;
        return !isNaN(id) && id > 0;
    },

    // Validation de requête
    validateRequest: (request) => {
        const requiredFields = ['headers', 'params'];
        return requiredFields.every(field => field in request);
    },

    // Validation des en-têtes
    validateHeaders: (headers) => {
        const required = ['authorization'];
        return required.every(header => header in headers);
    },

    // Messages d'erreur
    errors: {
        INVALID_ID: 'ID invalide',
        MISSING_FIELDS: 'Champs requis manquants',
        INVALID_HEADERS: 'En-têtes invalides'
    }
};

    // Validation principale des données
    function validateData(data) {
        try {
            // Vérification JSON
            const jsonValidation = validateJSON(data);
            if (!jsonValidation.isValid) {
                throw new Error(ERROR_CODES.JSON_INVALID);
            }

            // Vérification des clés
            const keyValidation = validateKeys(data);
            if (!keyValidation.isValid) {
                throw new Error(`${ERROR_CODES.KEY_INVALID}: ${keyValidation.invalidKeys.join(', ')}`);
            }

            // Vérification de la taille des données
            const sizeValidation = validateSize(data);
            if (!sizeValidation.isValid) {
                throw new Error(ERROR_CODES.VALUE_TOO_LARGE);
            }

            // Vérification des types de données
            const typeValidation = validateTypes(data);
            if (!typeValidation.isValid) {
                throw new Error(`${ERROR_CODES.TYPE_INVALID}: ${typeValidation.invalidFields.join(', ')}`);
            }

            // Mise à jour du moniteur de débogage
            updateValidationMonitor({
                action: 'validation_success',
                timestamp: new Date().toISOString(),
                dataInfo: getDataInfo(data)
            });

            return {
                isValid: true,
                data: data
            };

        } catch (error) {
            updateValidationMonitor({
                action: 'validation_error',
                error: error.message,
                timestamp: new Date().toISOString()
            });

            return {
                isValid: false,
                error: error.message
            };
        }
    }

    // Validation du format JSON
    function validateJSON(data) {
        try {
            // Test de sérialisation/désérialisation
            JSON.parse(JSON.stringify(data));
            return { isValid: true };
        } catch (error) {
            return { 
                isValid: false,
                error: ERROR_CODES.JSON_INVALID
            };
        }
    }

    // Validation des clés
    function validateKeys(data) {
        const invalidKeys = [];
        const keyRegex = /^[a-zA-Z0-9_-]{1,50}$/;

        function checkKeys(obj, path = '') {
            Object.keys(obj).forEach(key => {
                const currentPath = path ? `${path}.${key}` : key;
                
                if (!keyRegex.test(key) || key.length > VALIDATION_RULES.MAX_KEY_LENGTH) {
                    invalidKeys.push(currentPath);
                }

                if (obj[key] && typeof obj[key] === 'object') {
                    checkKeys(obj[key], currentPath);
                }
            });
        }

        checkKeys(data);
        
        return {
            isValid: invalidKeys.length === 0,
            invalidKeys
        };
    }

    // Validation de la taille des données
    function validateSize(data) {
        const size = new Blob([JSON.stringify(data)]).size;
        return {
            isValid: size <= VALIDATION_RULES.MAX_VALUE_SIZE,
            size
        };
    }

    // Validation des types de données
    function validateTypes(data) {
        const invalidFields = [];

        function checkTypes(obj, path = '') {
            Object.entries(obj).forEach(([key, value]) => {
                const currentPath = path ? `${path}.${key}` : key;
                const type = Array.isArray(value) ? 'array' : typeof value;

                if (!VALIDATION_RULES.ALLOWED_TYPES.includes(type)) {
                    invalidFields.push(`${currentPath} (${type})`);
                }

                if (value && typeof value === 'object') {
                    checkTypes(value, currentPath);
                }
            });
        }

        checkTypes(data);

        return {
            isValid: invalidFields.length === 0,
            invalidFields
        };
    }

    // Obtention des informations sur les données
    function getDataInfo(data) {
        return {
            size: new Blob([JSON.stringify(data)]).size,
            keys: Object.keys(data).length,
            depth: getObjectDepth(data)
        };
    }

    // Calcul de la profondeur de l'objet
    function getObjectDepth(obj) {
        let depth = 1;
        Object.values(obj).forEach(value => {
            if (value && typeof value === 'object') {
                depth = Math.max(depth, getObjectDepth(value) + 1);
            }
        });
        return depth;
    }

    // Mise à jour du moniteur de validation
    function updateValidationMonitor(info) {
        try {
            const monitorKey = 'validation_monitor';
            const currentLogs = JSON.parse(localStorage.getItem(monitorKey) || '[]');
            
            currentLogs.push(info);
            if (currentLogs.length > 100) currentLogs.shift();
            
            localStorage.setItem(monitorKey, JSON.stringify(currentLogs));

            // Émission d'un événement pour le moniteur de stockage
            dispatchValidationEvent('validation_update', info);

        } catch (error) {
            console.warn('Failed to update validation monitor:', error);
        }
    }

    // Émission d'événements de validation
    function dispatchValidationEvent(type, data) {
        const event = new CustomEvent('storage_monitor', {
            detail: {
                type: type,
                data: data,
                timestamp: new Date().toISOString()
            }
        });
        window.dispatchEvent(event);
    }

    // Interface de débogage
    function getValidationDebugInfo() {
        try {
            return {
                validationLogs: JSON.parse(localStorage.getItem('validation_monitor') || '[]'),
                rules: VALIDATION_RULES,
                errorCodes: ERROR_CODES
            };
        } catch (error) {
            return {
                error: 'Failed to retrieve validation debug info',
                timestamp: new Date().toISOString()
            };
        }
    }

    return {
        validateData,
        getValidationDebugInfo,
        ERROR_CODES,
        VALIDATION_RULES
    };
}

export default validationMiddleware;