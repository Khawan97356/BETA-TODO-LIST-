// auth.js

import { handleError } from '../../services/error-handling.js';
import { logAction } from '../../services/logging.js';

export const auth = {
    verifyToken: (token) => {
        if (!token) {
            logAction('auth_token_missing', { timestamp: new Date().toISOString() }, 'warn');
            return false;
        }
        
        try {
            const isValid = token.startsWith('Bearer ');
            logAction('auth_token_verify', {
                isValid,
                timestamp: new Date().toISOString()
            });
            return isValid;
        } catch (error) {
            handleError(error, { context: 'token_verification' });
            return false;
        }
    },

    checkPermissions: (user, requiredPermissions) => {
        if (!user || !requiredPermissions) {
            logAction('auth_permission_check_failed', {
                user: user ? 'present' : 'missing',
                permissions: requiredPermissions ? 'present' : 'missing'
            }, 'warn');
            return false;
        }
        logAction('auth_permission_check', {
            userId: user.id,
            requiredPermissions
        });
        return true; // Simulation
    },

    generateToken: (userId) => {
        const token = `Bearer ${userId}_${Date.now()}`;
        logAction('auth_token_generated', { userId });
        return token;
    }
};

function authMiddleware() {
    const AUTH_CONSTANTS = {
        TOKEN_KEY: 'auth_token',
        SESSION_KEY: 'user_session',
        DEBUG_KEY: 'auth_debug'
    };

    const ERROR_CODES = {
        INVALID_TOKEN: 'INVALID_AUTH_TOKEN',
        EXPIRED_TOKEN: 'TOKEN_EXPIRED',
        NO_TOKEN: 'NO_TOKEN_PROVIDED',
        STORAGE_ERROR: 'AUTH_STORAGE_ERROR'
    };

    async function authenticate(request) {
        try {
            const token = extractToken(request);
            if (!token) {
                const error = new Error(ERROR_CODES.NO_TOKEN);
                handleError(error, { request: { headers: request.headers } });
                throw error;
            }

            const session = await validateAndGetSession(token);
            
            logAction('auth_success', {
                token: maskToken(token),
                sessionId: session.id
            });

            updateAuthDebugger({
                action: 'authenticate',
                token: maskToken(token),
                timestamp: new Date().toISOString()
            });

            return {
                isAuthenticated: true,
                session: session
            };

        } catch (error) {
            const handledError = handleError(error, {
                context: 'authentication',
                timestamp: new Date().toISOString()
            });

            updateAuthDebugger({
                action: 'auth_error',
                error: error.message,
                timestamp: new Date().toISOString()
            });

            return {
                isAuthenticated: false,
                error: handledError.message
            };
        }
    }

    function extractToken(request) {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            logAction('auth_header_missing', {
                headers: Object.keys(request.headers)
            }, 'warn');
            return null;
        }

        const [bearer, token] = authHeader.split(' ');
        if (bearer !== 'Bearer') {
            logAction('auth_invalid_bearer', { receivedBearer: bearer }, 'warn');
        }
        return bearer === 'Bearer' ? token : null;
    }

    async function validateAndGetSession(token) {
        try {
            const storedSession = localStorage.getItem(AUTH_CONSTANTS.SESSION_KEY);
            if (!storedSession) {
                logAction('auth_session_missing', { token: maskToken(token) }, 'warn');
                throw new Error(ERROR_CODES.INVALID_TOKEN);
            }

            const session = JSON.parse(storedSession);
            
            if (isSessionExpired(session)) {
                logAction('auth_session_expired', {
                    sessionId: session.id,
                    lastActivity: session.lastActivity
                }, 'warn');
                clearAuthData();
                throw new Error(ERROR_CODES.EXPIRED_TOKEN);
            }

            session.lastActivity = new Date().toISOString();
            localStorage.setItem(AUTH_CONSTANTS.SESSION_KEY, JSON.stringify(session));

            logAction('auth_session_validated', {
                sessionId: session.id,
                lastActivity: session.lastActivity
            });

            return session;

        } catch (error) {
            handleError(error, {
                context: 'session_validation',
                token: maskToken(token)
            });
            throw error;
        }
    }

    function isSessionExpired(session) {
        const expirationTime = new Date(session.lastActivity);
        expirationTime.setHours(expirationTime.getHours() + 1);
        return new Date() > expirationTime;
    }

    function clearAuthData() {
        try {
            localStorage.removeItem(AUTH_CONSTANTS.TOKEN_KEY);
            localStorage.removeItem(AUTH_CONSTANTS.SESSION_KEY);
            logAction('auth_data_cleared');
            
            updateAuthDebugger({
                action: 'clear_auth',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            handleError(error, { context: 'clear_auth_data' });
        }
    }

    function maskToken(token) {
        if (!token) return '';
        return `${token.substr(0, 4)}...${token.substr(-4)}`;
    }

    function updateAuthDebugger(debugInfo) {
        try {
            const currentDebug = JSON.parse(localStorage.getItem(AUTH_CONSTANTS.DEBUG_KEY) || '[]');
            currentDebug.push(debugInfo);
            
            if (currentDebug.length > 50) {
                currentDebug.shift();
            }

            localStorage.setItem(AUTH_CONSTANTS.DEBUG_KEY, JSON.stringify(currentDebug));
            dispatchStorageEvent('auth_debug_updated', debugInfo);

        } catch (error) {
            handleError(error, { 
                context: 'update_auth_debugger',
                debugInfo
            });
        }
    }

    function dispatchStorageEvent(type, data) {
        const event = new CustomEvent('storage_monitor', {
            detail: {
                type: type,
                data: data,
                timestamp: new Date().toISOString()
            }
        });
        window.dispatchEvent(event);
    }

    function getAuthDebugInfo() {
        try {
            const debugInfo = {
                debugLog: JSON.parse(localStorage.getItem(AUTH_CONSTANTS.DEBUG_KEY) || '[]'),
                currentSession: JSON.parse(localStorage.getItem(AUTH_CONSTANTS.SESSION_KEY) || 'null'),
                hasToken: !!localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY)
            };
            
            logAction('auth_debug_info_retrieved', {
                hasSession: !!debugInfo.currentSession,
                hasToken: debugInfo.hasToken
            });

            return debugInfo;
        } catch (error) {
            const handledError = handleError(error, { context: 'get_auth_debug_info' });
            return {
                error: handledError.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    return {
        authenticate,
        clearAuthData,
        getAuthDebugInfo,
        ERROR_CODES
    };
}

export default authMiddleware;