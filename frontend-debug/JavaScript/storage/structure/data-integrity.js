// data-integrity.js

const dataIntegrityService = (() => {
    // Configuration des constantes
    const INTEGRITY_CONFIG = {
        HASH_ALGORITHM: 'SHA-256',
        CHECKSUM_KEY_PREFIX: '_checksum_',
        METADATA_KEY_PREFIX: '_meta_',
        VALIDATION_INTERVAL: 1000 * 60 * 60, // 1 heure
        MAX_CORRUPTION_LOGS: 1000
    };

    // Codes d'erreur
    const INTEGRITY_ERRORS = {
        CHECKSUM_MISMATCH: 'CHECKSUM_VALIDATION_FAILED',
        METADATA_CORRUPTED: 'METADATA_CORRUPTION_DETECTED',
        HASH_GENERATION_FAILED: 'HASH_GENERATION_ERROR',
        DATA_STRUCTURE_INVALID: 'INVALID_DATA_STRUCTURE',
        VERSION_MISMATCH: 'DATA_VERSION_MISMATCH'
    };

    /**
     * Vérifie l'intégrité des données
     * @param {string} key - Clé à vérifier
     * @param {string} data - Données à vérifier
     * @returns {Promise<boolean>} Résultat de la vérification
     */
    async function verifyDataIntegrity(key, data) {
        try {
            // Vérification du checksum
            const storedChecksum = localStorage.getItem(
                INTEGRITY_CONFIG.CHECKSUM_KEY_PREFIX + key
            );
            const currentChecksum = await generateChecksum(data);

            if (!storedChecksum) {
                // Premier enregistrement, on sauvegarde le checksum
                await saveChecksum(key, currentChecksum);
                return true;
            }

            // Vérification des métadonnées
            const isMetadataValid = await verifyMetadata(key);
            if (!isMetadataValid) {
                logCorruption(key, INTEGRITY_ERRORS.METADATA_CORRUPTED);
                return false;
            }

            // Comparaison des checksums
            const isValid = storedChecksum === currentChecksum;
            if (!isValid) {
                logCorruption(key, INTEGRITY_ERRORS.CHECKSUM_MISMATCH);
                await handleCorruption(key, data);
            }

            return isValid;

        } catch (error) {
            logCorruption(key, error.message);
            return false;
        }
    }

    /**
     * Génère un checksum pour les données
     * @param {string} data - Données à hasher
     * @returns {Promise<string>} Checksum généré
     */
    async function generateChecksum(data) {
        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const hashBuffer = await crypto.subtle.digest(
                INTEGRITY_CONFIG.HASH_ALGORITHM,
                dataBuffer
            );
            return Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } catch (error) {
            throw new Error(INTEGRITY_ERRORS.HASH_GENERATION_FAILED);
        }
    }

    /**
     * Sauvegarde le checksum des données
     * @param {string} key - Clé des données
     * @param {string} checksum - Checksum à sauvegarder
     */
    async function saveChecksum(key, checksum) {
        try {
            localStorage.setItem(
                INTEGRITY_CONFIG.CHECKSUM_KEY_PREFIX + key,
                checksum
            );
            await saveMetadata(key);
        } catch (error) {
            console.error('Failed to save checksum:', error);
        }
    }

    /**
     * Vérifie les métadonnées d'une entrée
     * @param {string} key - Clé à vérifier
     * @returns {Promise<boolean>} Résultat de la vérification
     */
    async function verifyMetadata(key) {
        try {
            const metadata = JSON.parse(
                localStorage.getItem(INTEGRITY_CONFIG.METADATA_KEY_PREFIX + key)
            );

            if (!metadata || !metadata.timestamp || !metadata.version) {
                return false;
            }

            // Vérification de la fraîcheur des données
            const age = Date.now() - metadata.timestamp;
            if (age > INTEGRITY_CONFIG.VALIDATION_INTERVAL) {
                // Données trop anciennes, revalidation nécessaire
                await refreshMetadata(key);
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Sauvegarde les métadonnées
     * @param {string} key - Clé des données
     */
    async function saveMetadata(key) {
        const metadata = {
            timestamp: Date.now(),
            version: '1.0',
            lastCheck: Date.now(),
            checks: 0
        };

        localStorage.setItem(
            INTEGRITY_CONFIG.METADATA_KEY_PREFIX + key,
            JSON.stringify(metadata)
        );
    }

    /**
     * Rafraîchit les métadonnées
     * @param {string} key - Clé des données
     */
    async function refreshMetadata(key) {
        try {
            const metadata = JSON.parse(
                localStorage.getItem(INTEGRITY_CONFIG.METADATA_KEY_PREFIX + key)
            );
            metadata.lastCheck = Date.now();
            metadata.checks++;

            localStorage.setItem(
                INTEGRITY_CONFIG.METADATA_KEY_PREFIX + key,
                JSON.stringify(metadata)
            );
        } catch (error) {
            await saveMetadata(key);
        }
    }

    /**
     * Gestion de la corruption des données
     * @param {string} key - Clé corrompue
     * @param {string} data - Données corrompues
     */
    async function handleCorruption(key, data) {
        try {
            // Sauvegarde des données corrompues
            const corruptedKey = `corrupted_${key}_${Date.now()}`;
            localStorage.setItem(corruptedKey, data);

            // Tentative de restauration depuis la sauvegarde
            const backup = findLatestBackup(key);
            if (backup) {
                localStorage.setItem(key, backup.data);
                await saveChecksum(key, await generateChecksum(backup.data));
            }

            // Notification du système de monitoring
            notifyCorruption(key, {
                timestamp: Date.now(),
                backupFound: !!backup,
                corruptedKey
            });

        } catch (error) {
            console.error('Corruption handling failed:', error);
        }
    }

    /**
     * Recherche la dernière sauvegarde valide
     * @param {string} key - Clé à rechercher
     * @returns {Object|null} Dernière sauvegarde valide
     */
    function findLatestBackup(key) {
        const backups = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k.startsWith(`backup_${key}_`)) {
                backups.push({
                    key: k,
                    timestamp: parseInt(k.split('_').pop()),
                    data: localStorage.getItem(k)
                });
            }
        }

        return backups.sort((a, b) => b.timestamp - a.timestamp)[0] || null;
    }

    /**
     * Log des corruptions détectées
     * @param {string} key - Clé corrompue
     * @param {string} error - Type d'erreur
     */
    function logCorruption(key, error) {
        try {
            const logs = JSON.parse(localStorage.getItem('corruption_logs') || '[]');
            logs.push({
                key,
                error,
                timestamp: Date.now()
            });

            // Limitation de la taille des logs
            if (logs.length > INTEGRITY_CONFIG.MAX_CORRUPTION_LOGS) {
                logs.shift();
            }

            localStorage.setItem('corruption_logs', JSON.stringify(logs));
        } catch (error) {
            console.error('Failed to log corruption:', error);
        }
    }

    /**
     * Notification du système de monitoring
     * @param {string} key - Clé concernée
     * @param {Object} details - Détails de la corruption
     */
    function notifyCorruption(key, details) {
        window.dispatchEvent(new CustomEvent('data_corruption', {
            detail: {
                key,
                ...details,
                timestamp: Date.now()
            }
        }));
    }

    // Interface publique
    return {
        verifyDataIntegrity,
        generateChecksum,
        getCorruptionLogs: () => JSON.parse(localStorage.getItem('corruption_logs') || '[]'),
        INTEGRITY_ERRORS,
        INTEGRITY_CONFIG
    };
})();

export default dataIntegrityService;