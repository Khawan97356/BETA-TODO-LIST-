// get-data.js

// Imports
import { auth } from '../middleware/auth.js';
import { dataProcessing } from '../../services/data-processing.js';
import { logging } from '../../services/logging.js';



function handleGetRequest(endpoint) {
    // Constantes pour la gestion des erreurs et la configuration
    const ERROR_CODES = {
        NOT_FOUND: 'RESOURCE_NOT_FOUND',
        INVALID_REQUEST: 'INVALID_REQUEST',
        STORAGE_ERROR: 'STORAGE_ERROR',
        PARSE_ERROR: 'PARSE_ERROR',
        UNAUTHORIZED: 'UNAUTHORIZED'
    };

    const STORAGE_KEYS = {
        DATA_PREFIX: 'app_data_',
        META_PREFIX: 'app_meta_'
    };

    // Nouvelle fonction de vérification d'authentification
    async function checkAuthentication(request) {
        try {
            const authResult = await auth.authenticate(request);
            if (!authResult.isAuthenticated) {
                throw new Error(ERROR_CODES.UNAUTHORIZED);
            }
            return authResult.session;
        } catch (error) {
            logging.error('Authentication failed', { error: error.message });
            throw new Error(ERROR_CODES.UNAUTHORIZED);
        }
    }

        // Modification de getData pour utiliser les services
        async function getData(params, authSession) {
            try {
                validateParams(params);
                logging.info('getData called', { params });
    
                const localData = checkLocalStorage(params.id);
                if (localData) {
                    const processedData = dataProcessing.processRawData(localData);
                    logging.debug('Data retrieved from local storage', { id: params.id });
                    return {
                        success: true,
                        source: 'local_storage',
                        data: processedData,
                        timestamp: new Date().toISOString()
                    };
                }
    
                const serverData = await fetchFromServer(params);
                const processedServerData = dataProcessing.processRawData(serverData);
                
                saveToLocalStorage(params.id, processedServerData);
                logging.info('Data fetched from server', { id: params.id });
    
                return {
                    success: true,
                    source: 'server',
                    data: processedServerData,
                    timestamp: new Date().toISOString()
                };
    
            } catch (error) {
                logging.error('getData failed', { error: error.message, params });
                return {
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
            }
        }
    

    // Fonction principale de récupération des données
    async function getData(params) {
        try {
            // Validation des paramètres
            validateParams(params);

            // Vérifie si les données sont dans le localStorage
            const localData = checkLocalStorage(params.id);
            if (localData) {
                return {
                    success: true,
                    source: 'local_storage',
                    data: localData,
                    timestamp: new Date().toISOString()
                };
            }

            // Si pas en local, simule une récupération serveur
            const serverData = await fetchFromServer(params);
            
            // Sauvegarde en local pour future utilisation
            saveToLocalStorage(params.id, serverData);

            return {
                success: true,
                source: 'server',
                data: serverData,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Validation des paramètres
    function validateParams(params) {
        if (!params || !params.id) {
            throw new Error(ERROR_CODES.INVALID_REQUEST);
        }
    }

    // Vérification du localStorage
    function checkLocalStorage(id) {
        try {
            const key = STORAGE_KEYS.DATA_PREFIX + id;
            const storedData = localStorage.getItem(key);
            
            if (!storedData) return null;

            // Validation du format JSON
            try {
                return JSON.parse(storedData);
            } catch {
                throw new Error(ERROR_CODES.PARSE_ERROR);
            }
        } catch (error) {
            throw new Error(ERROR_CODES.STORAGE_ERROR);
        }
    }

    // Simulation de récupération serveur
    async function fetchFromServer(params) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    id: params.id,
                    data: `Sample data for ID: ${params.id}`,
                    lastModified: new Date().toISOString()
                });
            }, 200);
        });
    }

    // Sauvegarde dans le localStorage
    function saveToLocalStorage(id, data) {
        try {
            const key = STORAGE_KEYS.DATA_PREFIX + id;
            localStorage.setItem(key, JSON.stringify(data));

            // Sauvegarde des métadonnées
            const metaKey = STORAGE_KEYS.META_PREFIX + id;
            localStorage.setItem(metaKey, JSON.stringify({
                lastAccessed: new Date().toISOString(),
                accessCount: 1
            }));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
            // Continue l'exécution même si la sauvegarde locale échoue
        }
    }

    // Point d'entrée de l'API
    async function getEndpoint(request) {
        const params = {
            id: request.params.id,
            options: request.query || {}
        };

        return await getData(params);
    }

    // Interface de débogage
    function getDebugInfo() {
        const storageInfo = {
            totalItems: 0,
            keys: [],
            totalSize: 0
        };

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(STORAGE_KEYS.DATA_PREFIX)) {
                    storageInfo.keys.push(key);
                    storageInfo.totalItems++;
                    storageInfo.totalSize += localStorage.getItem(key).length;
                }
            }
        } catch (error) {
            console.error('Debug info collection failed:', error);
        }

        return storageInfo;
    }

    return {
        getEndpoint,
        getDebugInfo,
        ERROR_CODES
    };
}

export default handleGetRequest;