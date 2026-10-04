import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { bunqCredentialsService, type BunqCredentials } from '../bunqCredentialsService';
import { BUNQ_API_URL } from './bunqConstants';
import type { BunqAuthenticatedClient, BunqClientParams, BunqClientPort } from './bunqClientPort';

/**
 * Installs URL notification filters for webhooks (REQUEST category only)
 * using the authenticated Bunq client of the given user.
 * Constructs the target URL from MINI_APP_URL internally.
 */
export async function installWebhookFilters(
  userId: number,
  password: string
): Promise<{ success: boolean; targetUrl?: string }> {
  try {
    const miniAppUrl = process.env.MINI_APP_URL;
    if (!miniAppUrl) {
      console.error('installWebhookFilters: MINI_APP_URL is not set');
      return { success: false };
    }
    const targetUrl = `${miniAppUrl.replace(/\/$/, '')}/webhooks/bunq`;

    const bunqClientResult = await createBunqClient({ userId, password });
    if (!bunqClientResult) return { success: false };

    const { client } = bunqClientResult;

    // Resolve bunq user id (UserPerson/UserCompany/UserApiKey)
    const userResp = await client.get('/user');
    const responseItems = userResp.data?.Response || [];
    const bunqUserId =
      responseItems.find((x: any) => x.UserPerson)?.UserPerson?.id ||
      responseItems.find((x: any) => x.UserCompany)?.UserCompany?.id ||
      responseItems.find((x: any) => x.UserApiKey)?.UserApiKey?.id;
    if (!bunqUserId) {
      console.error('installWebhookFilters: Could not resolve bunq user id');
      return { success: false };
    }

    const body = {
      notification_filters: [
        { category: 'REQUEST', notification_target: targetUrl }
      ]
    };

    await client.post(`/user/${bunqUserId}/notification-filter-url`, body);
    return { success: true, targetUrl };
  } catch (err: any) {
    console.error('installWebhookFilters error:', err?.response?.data || err?.message || err);
    return { success: false };
  }
}

/**
 * Creates an installation token using the API key
 */
export async function createInstallation(apiKey: string, apiKeyName: string): Promise<{ installationToken: string; privateKey: string } | null> {
  try {
    // For installation, we don't use X-Bunq-Client-Authentication header
    const client = axios.create({
      baseURL: BUNQ_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': apiKeyName
      }
    });

    // Generate a proper RSA key pair for the installation
    const { publicKey: rsaPublicKey, privateKey: rsaPrivateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    const publicKey = rsaPublicKey;
    const privateKey = rsaPrivateKey;

    const response = await client.post('/installation', {
      client_public_key: publicKey
    });

    if (response.status === 200 && response.data && response.data.Response) {
      // Find the Token object in the response
      for (const item of response.data.Response) {
        if (item.Token) {
          return {
            installationToken: item.Token.token,
            privateKey: privateKey
          };
        }
      }
    }

    console.error('Installation token not found in response');
    return null;
  } catch (error: any) {
    console.error('Error creating installation:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Registers a device using the installation token and API key.
 * Idempotent — if a device already exists, treated as success.
 */
export async function registerDevice(installationToken: string, apiKey: string, apiKeyName: string): Promise<boolean> {
  try {
    const client = axios.create({
      baseURL: BUNQ_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': apiKeyName,
        'X-Bunq-Client-Authentication': installationToken
      }
    });

    const response = await client.post('/device-server', {
      description: apiKeyName,
      secret: apiKey
    });

    return response.status === 200;
  } catch (error: any) {
    // Check if the error is "device already exists" - this is idempotent and should be treated as success
    const errorData = error.response?.data;
    if (errorData) {
      // Bunq returns errors as an array of error objects
      const errors = Array.isArray(errorData) ? errorData : (errorData.Error || []);
      for (const err of errors) {
        const errorDesc = err.error_description || err.error_description_translated || '';
        if (errorDesc.toLowerCase().includes('device already exists')) {
          console.log('Device already registered (idempotent), treating as success');
          return true;
        }
      }
    }
    console.error('Error registering device:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Creates a session using the installation token, API key, and private key for signing
 */
export async function createSession(installationToken: string, apiKey: string, privateKey: string, apiKeyName: string): Promise<string | null> {
  try {
    // Prepare the request body
    const requestBody = {
      secret: apiKey
    };

    // Convert request body to JSON string for signing
    const dataToSign = JSON.stringify(requestBody);

    // Create signature using SHA256 algorithm and private key
    const signature = crypto.sign('sha256', Buffer.from(dataToSign), privateKey);
    const base64Signature = signature.toString('base64');

    // Log the request details for debugging (without sensitive data)
    console.log('Creating session with:', {
      installationTokenLength: installationToken?.length,
      apiKeyLength: apiKey?.length,
      privateKeyLength: privateKey?.length,
      dataToSign,
      signatureLength: base64Signature?.length,
      apiKeyName
    });

    const client = axios.create({
      baseURL: BUNQ_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': apiKeyName,
        'X-Bunq-Client-Authentication': installationToken,
        'X-Bunq-Client-Signature': base64Signature
      }
    });

    const response = await client.post('/session-server', requestBody);

    if (response.status === 200 && response.data && response.data.Response) {
      // Find the Token object in the response
      for (const item of response.data.Response) {
        if (item.Token) {
          return item.Token.token;
        }
      }
    }

    console.error('Session token not found in response');
    return null;
  } catch (error: any) {
    console.error('Error creating session:', {
      message: error?.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : 'No response',
      responseErrors: error.response?.data?.Error || error.response?.data
    });
    return null;
  }
}

/**
 * Tests if a session token is still valid
 */
export async function isSessionTokenValid(sessionToken: string, apiKeyName: string): Promise<boolean> {
  try {
    const client = axios.create({
      baseURL: BUNQ_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': apiKeyName,
        'X-Bunq-Client-Authentication': sessionToken
      }
    });

    // Try to get user info to test the session token
    const response = await client.get('/user');

    return response.status === 200;
  } catch (error: any) {
    console.error('Session token validation failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Refreshes tokens in the correct order: API Key → Installation → Session
 */
async function refreshTokens(userId: number, password: string, credentials: BunqCredentials): Promise<BunqCredentials | null> {
  try {
    console.log('Refreshing Bunq tokens...');

    const apiKeyName = credentials.apiKeyName || 'VolleyBot API Client';

    let installationToken = credentials.installationToken;
    let privateKey = credentials.privateKey;

    // Step 1: Ensure we have a valid installation token
    if (!installationToken || !privateKey) {
      console.log('Creating new installation token...');
      const installationResult = await createInstallation(credentials.apiKey, apiKeyName);
      if (!installationResult) {
        console.error('Failed to create installation token');
        return null;
      }
      installationToken = installationResult.installationToken;
      privateKey = installationResult.privateKey;
    }

    // Step 2: Register device (this is idempotent - returns true if device already exists)
    console.log('Registering device...');
    const deviceRegistered = await registerDevice(installationToken, credentials.apiKey, apiKeyName);

    if (!deviceRegistered) {
      console.error('Failed to register device');
      return null;
    }

    // Step 3: Create session token
    console.log('Creating session token...');
    const sessionToken = await createSession(installationToken, credentials.apiKey, privateKey, apiKeyName);
    if (!sessionToken) {
      console.error('Failed to create session token');
      return null;
    }

    console.log('Storing all credentials at once...');
    const success = await bunqCredentialsService.storeAllCredentials(
      userId,
      credentials.apiKey,
      credentials.apiKeyName || null,
      installationToken,
      privateKey,
      sessionToken,
      credentials.monetaryAccountId || null,
      password
    );

    if (!success) {
      console.error('Failed to store all credentials');
      return null;
    }

    // Return updated credentials
    return {
      ...credentials,
      installationToken,
      privateKey,
      sessionToken
    };
  } catch (error: any) {
    console.error('Error refreshing tokens:', error);
    return null;
  }
}

/**
 * Creates an authenticated Bunq API client using user credentials.
 * Handles session refresh on missing/expired tokens.
 */
export async function createBunqClient(params: BunqClientParams): Promise<BunqAuthenticatedClient | null> {
  try {
    // Get credentials from the database
    let credentials = await bunqCredentialsService.getCredentials(params.userId, params.password);

    if (!credentials) {
      console.error(`No Bunq credentials found for user ${params.userId}`);
      return null;
    }

    if (!credentials.monetaryAccountId) {
      console.error(`No monetary account ID found for user ${params.userId}`);
      return null;
    }

    if (!credentials.privateKey) {
      console.error(`No private key found for user ${params.userId}`);
      return null;
    }

    const monetaryAccountId = credentials.monetaryAccountId;

    // Ensure we have a valid session token
    if (!credentials.sessionToken) {
      console.log('No session token found, refreshing tokens...');
      credentials = await refreshTokens(params.userId, params.password, credentials);
      if (!credentials) {
        console.error('Failed to refresh tokens');
        return null;
      }
    }

    const apiKeyName = credentials.apiKeyName || 'VolleyBot API Client';

    // Create Bunq API client
    const client: AxiosInstance = axios.create({
      baseURL: BUNQ_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': apiKeyName,
        'X-Bunq-Client-Authentication': credentials.sessionToken
      }
    });

    // Add response interceptor to handle token expiration
    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Check if error is due to authentication issues (401 Unauthorized)
        if (error.response && error.response.status === 401) {
          console.log('Bunq session token expired, refreshing tokens...');

          // Refresh tokens - at this point credentials should not be null
          if (!credentials) {
            console.error('Credentials are null during token refresh');
            return Promise.reject(error);
          }

          const refreshedCredentials = await refreshTokens(params.userId, params.password, credentials);
          if (refreshedCredentials && refreshedCredentials.sessionToken) {
            // Update the client with the new session token
            client.defaults.headers['X-Bunq-Client-Authentication'] = refreshedCredentials.sessionToken;
            credentials = refreshedCredentials;

            // Retry the original request with the new token
            const originalRequest = error.config;
            originalRequest.headers['X-Bunq-Client-Authentication'] = refreshedCredentials.sessionToken;
            return client(originalRequest);
          } else {
            console.error('Failed to refresh tokens after 401 error');
          }
        }

        return Promise.reject(error);
      }
    );

    return {
      client,
      monetaryAccountId,
      privateKey: credentials.privateKey!
    };
  } catch (error) {
    if (error instanceof Error && error.message == 'Invalid password')
      throw error;

    console.error('Error creating Bunq client:', error);
    return null;
  }
}

/** Live adapter: session module creates authenticated clients for payment modules. */
export const liveBunqClientPort: BunqClientPort = {
  createClient: createBunqClient,
};
