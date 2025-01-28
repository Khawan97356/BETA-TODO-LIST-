// validation.js
import { handleError } from '../../services/error-handling.js';

export const validation = {
    validateId: (id) => {
        try {
            if (!id) {
                throw new Error('ID manquant');
            }
            const isValid = !isNaN(id) && id > 0;
            if (!isValid) {
                throw new Error('ID invalide');
            }
            return isValid;
        } catch (error) {
            handleError(error, { context: 'id_validation', value: id });
            return false;
        }
    },

    validateRequest: (request) => {
        try {
            const requiredFields = ['headers', 'params'];
            const isValid = requiredFields.every(field => field in request);
            if (!isValid) {
                throw new Error('Champs requis manquants dans la requête');
            }
            return isValid;
        } catch (error) {
            handleError(error, { 
                context: 'request_validation',
                missingFields: requiredFields.filter(field => !(field in request))
            });
            return false;
        }
    },

    validateHeaders: (headers) => {
        try {
            const required = ['authorization'];
            const isValid = required.every(header => header in headers);
            if (!isValid) {
                throw new Error('En-têtes requis manquants');
            }
            return isValid;
        } catch (error) {
            handleError(error, { 
                context: 'headers_validation',
                missingHeaders: required.filter(header => !(header in headers))
            });
            return false;
        }
    },

    errors: {
        INVALID_ID: 'ID invalide',
        MISSING_FIELDS: 'Champs requis manquants',
        INVALID_HEADERS: 'En-têtes invalides'
    }
};

function validationMiddleware() {
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

    function validateData(data) {
        try {
            const jsonValidation = validateJSON(data);
            if (!jsonValidation.isValid) {
                throw new Error(ERROR_CODES.JSON_INVALID);
            }

            const keyValidation = validateKeys(data);
            if (!keyValidation.isValid) {
                throw new Error(`${ERROR_CODES.KEY_INVALID}: ${keyValidation.invalidKeys.join(', ')}`);
            }

            const sizeValidation = validateSize(data);
            if (!sizeValidation.isValid) {
                throw new Error(ERROR_CODES.VALUE_TOO_LARGE);
            }

            const typeValidation = validateTypes(data);
            if (!typeValidation.isValid) {
                throw new Error(`${ERROR_CODES.TYPE_INVALID}: ${typeValidation.invalidFields.join(', ')}`);
            }

            updateValidationMonitor({
                action: 'validation_success',
                timestamp: new Date().toISOString(),
                dataInfo: getDataInfo(data)
            });

            return { isValid: true, data };

        } catch (error) {
            const handledError = handleError(error, {
                context: 'data_validation',
                dataInfo: getDataInfo(data)
            });

            updateValidationMonitor({
                action: 'validation_error',
                error: handledError.message,
                timestamp: new Date().toISOString()
            });

            return {
                isValid: false,
                error: handledError.message
            };
        }
    }

    function validateJSON(data) {
        try {
            JSON.parse(JSON.stringify(data));
            return { isValid: true };
        } catch (error) {
            const handledError = handleError(error, {
                context: 'json_validation',
                dataType: typeof data
            });
            return { 
                isValid: false,
                error: handledError.message
            };
        }
    }

    function validateKeys(data) {
        try {
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
            return { isValid: invalidKeys.length === 0, invalidKeys };

        } catch (error) {
            const handledError = handleError(error, {
                context: 'key_validation',
                data: JSON.stringify(data).substring(0, 100)
            });
            return {
                isValid: false,
                error: handledError.message
            };
        }
    }

    function validateSize(data) {
        try {
            const size = new Blob([JSON.stringify(data)]).size;
            return {
                isValid: size <= VALIDATION_RULES.MAX_VALUE_SIZE,
                size
            };
        } catch (error) {
            handleError(error, {
                context: 'size_validation',
                attempted_size: data ? JSON.stringify(data).length : 0
            });
            return { isValid: false, size: 0 };
        }
    }

    function validateTypes(data) {
        try {
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
            return { isValid: invalidFields.length === 0, invalidFields };

        } catch (error) {
            handleError(error, {
                context: 'type_validation',
                dataStructure: Object.keys(data || {})
            });
            return { isValid: false, invalidFields: ['error_during_validation'] };
        }
    }

    function getDataInfo(data) {
        try {
            return {
                size: new Blob([JSON.stringify(data)]).size,
                keys: Object.keys(data).length,
                depth: getObjectDepth(data)
            };
        } catch (error) {
            handleError(error, {
                context: 'get_data_info',
                dataType: typeof data
            });
            return { size: 0, keys: 0, depth: 0 };
        }
    }

    function getObjectDepth(obj) {
        try {
            let depth = 1;
            Object.values(obj).forEach(value => {
                if (value && typeof value === 'object') {
                    depth = Math.max(depth, getObjectDepth(value) + 1);
                }
            });
            return depth;
        } catch (error) {
            handleError(error, {
                context: 'get_object_depth',
                objectType: typeof obj
            });
            return 0;
        }
    }

    function updateValidationMonitor(info) {
        try {
            const monitorKey = 'validation_monitor';
            const currentLogs = JSON.parse(localStorage.getItem(monitorKey) || '[]');
            
            currentLogs.push(info);
            if (currentLogs.length > 100) currentLogs.shift();
            
            localStorage.setItem(monitorKey, JSON.stringify(currentLogs));
            dispatchValidationEvent('validation_update', info);

        } catch (error) {
            handleError(error, {
                context: 'update_validation_monitor',
                monitorInfo: info
            });
        }
    }

    function dispatchValidationEvent(type, data) {
        try {
            const event = new CustomEvent('storage_monitor', {
                detail: {
                    type,
                    data,
                    timestamp: new Date().toISOString()
                }
            });
            window.dispatchEvent(event);
        } catch (error) {
            handleError(error, {
                context: 'dispatch_validation_event',
                eventType: type
            });
        }
    }

    function getValidationDebugInfo() {
        try {
            return {
                validationLogs: JSON.parse(localStorage.getItem('validation_monitor') || '[]'),
                rules: VALIDATION_RULES,
                errorCodes: ERROR_CODES
            };
        } catch (error) {
            const handledError = handleError(error, {
                context: 'get_validation_debug_info'
            });
            return {
                error: handledError.message,
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