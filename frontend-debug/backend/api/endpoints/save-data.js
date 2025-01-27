// save-data.js
import { auth } from '../middleware/auth.js';
import { validation } from '../middleware/validation.js';
import { dataProcessing } from '../../services/data-processing.js';
import { errorHandling } from '../../services/error-handling.js';
import { logging } from '../../services/logging.js';


function handleSaveRequest(endpoint) {
    // Configuration et constantes
    const ERROR_CODES = {
        VALIDATION_ERROR: 'DATA_VALIDATION_ERROR',
        STORAGE_FULL: 'STORAGE_CAPACITY_EXCEEDED',
        INTEGRITY_ERROR: 'DATA_INTEGRITY_ERROR',
        SAVE_ERROR: 'SAVE_OPERATION_FAILED',
        KEY_ERROR: 'INVALID_KEY_FORMAT',
        UNAUTHORIZED: 'UNAUTHORIZED_ACCESS'
    };

    const STORAGE_CONFIG = {
        MAX_ITEM_SIZE: 5242880, // 5MB
        KEY_PREFIX: 'app_data_',
        VERSION: '1.0'
    };
    
        // Vérification de l'authentification
        async function checkAuthentication(request) {
            try {
                const authResult = await auth.authenticate(request);
                if (!authResult.isAuthenticated) {
                    throw new Error(ERROR_CODES.UNAUTHORIZED);
                }
                return authResult.session;
            } catch (error) {
                logging.error('Authentication failed', { error: error.message });
                throw errorHandling.createError(ERROR_CODES.UNAUTHORIZED, 'Authentication required');
            }
    
    // Fonction principale de sauvegarde
    async function saveData(data, authSession) {
        try {
            logging.info('Starting save operation', { useerId: authSession.userId });

             // Validation avec le service de validation
             validation.validateRequest({
                body: data,
                required: ['id', 'content'],
                types: {
                    id: 'string',
                    content: 'object'
                }
            });

            // Traitement des données
            const processedData = dataProcessing.processRawData(data);
            
            // Validation de la structure
            validateDataStructure(processedData);
            
            // Préparation avec métadonnées d'authentification
            const preparedData = prepareDataForStorage(processedData, authSession);

            // Validation préliminaire
            validateDataStructure(data);
            
            // Préparation des données
            const preparedData = prepareDataForStorage(data);
            
            // Vérification de l'espace disponible
            checkStorageCapacity(preparedData);
            
            // Sauvegarde avec gestion de version
            const savedData = await performSave(preparedData);
            
            // Mise à jour du moniteur de stockage
            updateStorageMonitor(preparedData, authSession);

            logging.info('Save operation successful', { userId: authSession.userId, dataId: data.id });

            return {
                success: true,
                savedData: savedData,
                storageInfo: getStorageInfo(),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logging.error('Save operation failed', { error: error.message, userId: authSession.userId });
            return {
                success: false,
                error: error.message,
                errorDetails: error.details || {},
                timestamp: new Date().toISOString()
            };

            return errorHandling.handleError(error, {operation: 'save', userId: authSession.userId});
        }
    }

    // Validation de la structure des données
    function validateDataStructure(data) {
        if (!data || typeof data !== 'object') {
            throw new Error(ERROR_CODES.VALIDATION_ERROR);
        }

        // Vérification des clés requises
        const requiredKeys = ['id', 'content'];
        for (const key of requiredKeys) {
            if (!(key in data)) {
                throw new Error(`${ERROR_CODES.VALIDATION_ERROR}: Missing ${key}`);
            }
        }

        // Validation du format de la clé
        if (!isValidKey(data.id)) {
            throw new Error(ERROR_CODES.KEY_ERROR);
        }
    }

    // Vérification du format de la clé
    function isValidKey(key) {
        const keyRegex = /^[a-zA-Z0-9_-]{1,50}$/;
        return keyRegex.test(key);
    }

    // Préparation des données pour le stockage
    function prepareDataForStorage(data, authSession) {
        return {
            ...data,
            _meta: {
                version: STORAGE_CONFIG.VERSION,
                createdAt: new Date().toISOString(),
                createdBy: authSession.userId,
                userRole: authSession.userRole,
                checksum: generateChecksum(data)
            }
        };
    }

    // Génération d'un checksum pour l'intégrité des données
    function generateChecksum(data) {
        // Simulation d'un checksum simple
        return btoa(JSON.stringify(data)).slice(0, 8);
    }

    // Vérification de la capacité de stockage
    function checkStorageCapacity(data) {
        const serializedData = JSON.stringify(data);
        
        if (serializedData.length > STORAGE_CONFIG.MAX_ITEM_SIZE) {
            throw new Error(ERROR_CODES.STORAGE_FULL);
        }

        // Vérification de l'espace disponible dans localStorage
        try {
            const testKey = `${STORAGE_CONFIG.KEY_PREFIX}test`;
            localStorage.setItem(testKey, serializedData);
            localStorage.removeItem(testKey);
        } catch (e) {
            throw new Error(ERROR_CODES.STORAGE_FULL);
        }
    }

    // Sauvegarde effective des données
    async function performSave(data) {
        try {
            const key = `${STORAGE_CONFIG.KEY_PREFIX}${data.id}`;
            localStorage.setItem(key, JSON.stringify(data));

            // Simulation d'une sauvegarde asynchrone
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(data);
                }, 100);
            });
        } catch (error) {
            throw new Error(ERROR_CODES.SAVE_ERROR);
        }
    }

    // Mise à jour du moniteur de stockage
    function updateStorageMonitor(data, authSession) {
        try {
            const monitorKey = 'storage_monitor';
            const monitor = JSON.parse(localStorage.getItem(monitorKey) || '{}');

            const operation = {
                type: 'save',
                id: data.id,
                timestamp: new Date().toISOString(),
                user:{
                    id: authSession.userId,
                    role: authSession.role
                }
            };
            
            monitor.lastUpdate = new Date().toISOString();
            monitor.operations = (monitor.operations || 0) + 1;
            monitor.lastOperation = operation; 

             // Ajout de l'historique des opérations
             monitor.history = monitor.history || [];
             monitor.history.unshift(operation);
             
             // Limite de l'historique à 50 entrées
             if (monitor.history.length > 50) {
                 monitor.history.pop();
             }
 

            localStorage.setItem(monitorKey, JSON.stringify(monitor));

            logging.debug('Storage monitor updated', { operation });

        } catch (error) {
            console.warn('Failed to update storage monitor:', error);
        }
    }

    // Obtention des informations de stockage
    function getStorageInfo() {
        const info = {
            itemCount: 0,
            totalSize: 0,
            availableSpace: undefined
        };

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(STORAGE_CONFIG.KEY_PREFIX)) {
                    info.itemCount++;
                    info.totalSize += localStorage.getItem(key).length;
                }
            }
        } catch (error) {
            console.warn('Failed to get storage info:', error);
        }

        return info;
    }

    // Point d'entrée de l'API
    async function saveEndpoint(request) 
    try {
         // Vérification de l'authentification
         const authSession = await checkAuthentication(request);

         // Validation de la requête
         validation.validateRequest(request);

         // Sauvegarde avec session d'authentification
         return await saveData(request.body, authSession);

     } catch (error) {
         logging.error('Save endpoint error', { error: error.message });
         return errorHandling.handleError(error);
     }
 }

 // Interface de débogage améliorée
 function getDebugInfo() {
     try {
         const storageInfo = getStorageInfo();
         const monitor = JSON.parse(localStorage.getItem('storage_monitor') || '{}');

         return {
             storageInfo,
             monitor,
             auth: auth.getAuthDebugInfo(),
             timestamp: new Date().toISOString()
         };
     } catch (error) {
         logging.error('Debug info collection failed', { error: error.message });
         return errorHandling.handleError(error);
     }
 }

 // Export des fonctionnalités
 return {
     saveEndpoint,
     ERROR_CODES,
     getStorageInfo,
     getDebugInfo
 };
}


export default handleSaveRequest;