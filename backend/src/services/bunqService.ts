import axios, { AxiosInstance } from 'axios';
import { db } from '../db';
import { games, gameRegistrations, users, paymentRequests } from '../db/schema';
import { eq, and, not } from 'drizzle-orm';
import { sendTelegramNotification } from './telegramService';
import { bunqCredentialsService, type BunqCredentials } from './bunqCredentialsService';
import * as crypto from 'crypto';

interface User {
  id: number;
  telegramId: string;
  username: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
  createdAt: Date | null;
}

interface Game {
  id: number;
  dateTime: Date;
  maxPlayers: number;
  unregisterDeadlineHours: number;
  paymentAmount: number;
  fullyPaid: boolean;
  createdAt: Date | null;
  createdById: number;
}

interface PaymentRequestResult {
  success: boolean;
  paymentRequestUrl: string;
  error?: string;
}

// Default Bunq API URL
const BUNQ_API_URL = process.env.BUNQ_API_URL || 'https://api.bunq.com/v1';

// Interface for Bunq client creation parameters
interface BunqClientParams {
  userId: number;
  password: string;
}

// Interface for Bunq client
interface BunqClient {
  client: AxiosInstance;
  monetaryAccountId: number;
  privateKey: string;
}

/**
 * Creates an installation token using the API key
 * @param apiKey The API key to use for installation
 * @returns Object with installation token and private key, or null if failed
 */
export async function createInstallation(apiKey: string): Promise<{ installationToken: string; privateKey: string } | null> {
  try {
    // For installation, we don't use X-Bunq-Client-Authentication header
    const client = axios.create({
      baseURL: BUNQ_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Volley Game Central API Client'
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
 * Registers a device using the installation token and API key
 * @param installationToken The installation token
 * @param apiKey The API key (used as secret in the request body)
 * @returns True if successful, false otherwise
 */
export async function registerDevice(installationToken: string, apiKey: string): Promise<boolean> {
  try {
    const client = axios.create({
      baseURL: BUNQ_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Volley Game Central API Client',
        'X-Bunq-Client-Authentication': installationToken
      }
    });

    const response = await client.post('/device-server', {
      description: 'Volley Game Central API Client',
      secret: apiKey
    });

    return response.status === 200;
  } catch (error: any) {
    console.error('Error registering device:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Creates a session using the installation token, API key, and private key for signing
 * @param installationToken The installation token
 * @param apiKey The API key (used as secret in the request body)
 * @param privateKey The private key for signing the request
 * @returns Session token or null if failed
 */
export async function createSession(installationToken: string, apiKey: string, privateKey: string): Promise<string | null> {
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
    
    const client = axios.create({
      baseURL: BUNQ_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Volley Game Central API Client',
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
    console.error('Error creating session:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Tests if a session token is still valid
 * @param sessionToken The session token to test
 * @returns True if valid, false otherwise
 */
export async function isSessionTokenValid(sessionToken: string): Promise<boolean> {
  try {
    const client = axios.create({
      baseURL: BUNQ_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Volley Game Central API Client',
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
 * Fetches monetary accounts for a user using a session token
 * @param sessionToken The session token to use
 * @returns Array of monetary accounts or null if failed
 */
export async function fetchMonetaryAccounts(sessionToken: string): Promise<any[] | null> {
  try {
    const client = axios.create({
      baseURL: BUNQ_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Volley Game Central API Client',
        'X-Bunq-Client-Authentication': sessionToken
      }
    });

    // First get the user ID
    const userResponse = await client.get('/user');
    if (userResponse.status !== 200 || !userResponse.data?.Response) {
      console.error('Failed to get user info');
      return null;
    }

    // Find the user object in the response
    let userId: number | null = null;
    for (const item of userResponse.data.Response) {
      if (item.UserPerson) {
        userId = item.UserPerson.id;
        break;
      } else if (item.UserCompany) {
        userId = item.UserCompany.id;
        break;
      } else if (item.UserApiKey) {
        userId = item.UserApiKey.id;
        break;
      }
    }

    if (!userId) {
      console.error('Could not find user ID in response');
      return null;
    }

    // Now get the monetary accounts for this user
    const accountsResponse = await client.get(`/user/${userId}/monetary-account`);
    if (accountsResponse.status !== 200 || !accountsResponse.data?.Response) {
      console.error('Failed to get monetary accounts');
      return null;
    }

    // Extract monetary accounts from the response
    const accounts = [];
    for (const item of accountsResponse.data.Response) {
      if (item.MonetaryAccountBank && item.MonetaryAccountBank.status === 'ACTIVE') {
        accounts.push({
          id: item.MonetaryAccountBank.id,
          description: item.MonetaryAccountBank.description
        });
      }
    }

    return accounts;
  } catch (error: any) {
    console.error('Error fetching monetary accounts:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Refreshes tokens in the correct order: API Key → Installation → Session
 * @param userId User ID
 * @param password Password for decryption
 * @param credentials Current credentials
 * @returns Updated credentials or null if failed
 */
async function refreshTokens(userId: number, password: string, credentials: BunqCredentials): Promise<BunqCredentials | null> {
  try {
    console.log('Refreshing Bunq tokens...');
    
    let installationToken = credentials.installationToken;
    let privateKey = credentials.privateKey;
    let installationResult: { installationToken: string; privateKey: string } | null = null;
    
    // Step 1: Ensure we have a valid installation token
    if (!installationToken || !privateKey) {
      console.log('Creating new installation token...');
      installationResult = await createInstallation(credentials.apiKey);
      if (!installationResult) {
        console.error('Failed to create installation token');
        return null;
      }
      installationToken = installationResult.installationToken;
      privateKey = installationResult.privateKey;
    }
    
    // Step 2: Register device (this is idempotent)
    console.log('Registering device...');
    let deviceRegistered = await registerDevice(installationToken, credentials.apiKey);
    
    if (!deviceRegistered) {
      console.error('Failed to register device, creating new installation token...');
      // Try to create a new installation token and retry
      const retryInstallationResult = await createInstallation(credentials.apiKey);
      if (!retryInstallationResult) {
        console.error('Failed to create new installation token for retry');
        return null;
      }
      installationToken = retryInstallationResult.installationToken;
      privateKey = retryInstallationResult.privateKey;
      installationResult = retryInstallationResult;
      
      console.log('Retrying device registration with new installation token...');
      deviceRegistered = await registerDevice(installationToken, credentials.apiKey);
      if (!deviceRegistered) {
        console.error('Failed to register device on retry');
        return null;
      }
    }
    
    // Step 3: Create session token
    console.log('Creating session token...');
    const sessionToken = await createSession(installationToken, credentials.apiKey, privateKey);
    if (!sessionToken) {
      console.error('Failed to create session token');
      return null;
    }
    
    console.log('Storing all credentials at once...');
    const success = await bunqCredentialsService.storeAllCredentials(
      userId,
      credentials.apiKey,
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
 * Creates an authenticated Bunq API client using user credentials
 * @param params Parameters including userId and password
 * @returns Object containing Axios instance, monetaryAccountId, and privateKey for signing
 */
async function createBunqClient(params: BunqClientParams): Promise<BunqClient | null> {
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
    
    // Create Bunq API client
    const client = axios.create({
      baseURL: BUNQ_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Volley Game Central API Client',
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

/**
 * Bunq service functions for payment requests
 */
export const bunqService = {
  /**
   * Create a payment request for a single game participant
   * @param user The user to create the payment request for
   * @param game The game details
   * @param formattedDate Formatted date string for the game
   * @param gameRegistrationId Game registration ID to associate with the payment request
   * @param adminUserId User ID of the admin creating the payment request
   * @param password Password for decrypting admin's Bunq credentials
   * @returns Object with success status and payment URL
   */
  createSinglePaymentRequest: async (
    user: User, 
    game: Game, 
    formattedDate: string, 
    gameRegistrationId: number,
    adminUserId: number,
    password: string
  ): Promise<PaymentRequestResult> => {
    try {
      // Skip if no contact information is available
      if (!user.telegramId) {
        return {
          success: false,
          paymentRequestUrl: '',
          error: `No contact information available for user ${user.id}`
        };
      }
      
      const paymentRequestData = {
        amount_inquired: {
          value: (game.paymentAmount / 100).toFixed(2), // Convert cents to euros
          currency: 'EUR'
        },
        counterparty_alias: {
          type: 'EMAIL',
          value: `volley-${user.id}@${process.env.EMAIL_DOMAIN || 'volley-game-central.com'}`,
          name: user.username || `Volleyball Player ${user.id}`
        },
        description: `Volleyball game payment for ${formattedDate}`,
        allow_bunqme: true // Allow payment via bunq.me
      };
      
      const formattedAmount = `€${(game.paymentAmount / 100).toFixed(2)}`;
      
      let paymentRequestUrl = '';
      let paymentRequestId = '';
      
      // Create Bunq client with admin credentials
      const bunqClientResult = await createBunqClient({
        userId: adminUserId,
        password
      });
      
      if (!bunqClientResult) {
        return {
          success: false,
          paymentRequestUrl: '',
          error: 'Failed to create Bunq client'
        };
      }
      
      const { client: bunqClient, monetaryAccountId, privateKey } = bunqClientResult;
      
      // Sign the request body for payment request creation
      const dataToSign = JSON.stringify(paymentRequestData);
      const signature = crypto.sign('sha256', Buffer.from(dataToSign), privateKey);
      const base64Signature = signature.toString('base64');
      
      console.log('Creating payment request with data:', {
        endpoint: '/user/.../monetary-account/.../request-inquiry',
        data: paymentRequestData,
        monetaryAccountId,
        headers: {
          'X-Bunq-Client-Signature': '*****' // Don't log the actual signature
        }
      });
      
      try {
        // Add signature header to the client for this request
        // Get the user ID from the session or credentials
        const userResponse = await bunqClient.get('/user');
        const userId = userResponse.data?.Response?.[0]?.UserPerson?.id || userResponse.data?.Response?.[0]?.UserCompany?.id;
        
        if (!userId) {
          throw new Error('Could not determine user ID from Bunq API');
        }
        
        const response = await bunqClient.post(
          `/user/${userId}/monetary-account/${monetaryAccountId}/request-inquiry`,
          paymentRequestData,
          {
            headers: {
              'X-Bunq-Client-Signature': base64Signature
            }
          }
        );
        
        console.log('Payment request response status:', response.status);
        console.log('Payment request response data:', JSON.stringify(response.data, null, 2));

        if (response.status === 200 || response.status === 201) {
          const requestId = response.data?.Response?.[0]?.Id?.id;
          if (!requestId) {
            throw new Error('No request ID in response');
          }
          
          console.log('Request Inquiry ID:', requestId);
          paymentRequestId = requestId.toString();
          
          // Fetch the request details to get the payment URL
          const detailsResponse = await bunqClient.get(
            `/user/${userId}/monetary-account/${monetaryAccountId}/request-inquiry/${requestId}`
          );
          
          console.log('Request details response:', JSON.stringify(detailsResponse.data, null, 2));
          
          // Extract the payment URL from the details
          const requestInquiry = detailsResponse.data?.Response?.[0]?.RequestInquiry;
          if (requestInquiry) {
            paymentRequestUrl = requestInquiry.bunqme_share_url || 
                              requestInquiry.request_reference_split_the_bill?.bunq_me_share_link ||
                              '';
            
            console.log('Extracted payment URL:', paymentRequestUrl);
            
            if (!paymentRequestUrl) {
              console.error('No payment URL found in details. Available keys:', Object.keys(requestInquiry));
            }
          } else {
            console.error('No request inquiry in details response');
          }
        } else {
          return {
            success: false,
            paymentRequestUrl: '',
            error: `Failed to create payment request: API returned status ${response.status}`
          };
        }
      } catch (error: any) {
        console.error('Error in payment request API call:', {
          message: error.message,
          response: error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            headers: error.response.headers ? Object.keys(error.response.headers) : 'No headers'
          } : 'No response',
          responseErrors: error.response?.data?.Error,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers ? Object.keys(error.config.headers) : 'No headers'
          }
        });
        
        return {
          success: false,
          paymentRequestUrl: '',
          error: `Failed to create payment request: ${error.response?.data?.Error?.[0]?.error_description || error.message || 'Unknown error'}`
        };
      }

      await db.insert(paymentRequests).values({
        paymentRequestId: paymentRequestId,
        gameRegistrationId: gameRegistrationId,
        paymentLink: paymentRequestUrl,
        monetaryAccountId: monetaryAccountId,
        createdAt: new Date(),
        lastCheckedAt: new Date(),
        paid: false
      });

      // Send Telegram notification to the player
      try {
        const notificationMessage = `💰 Please pay ${formattedAmount} for the volleyball game on ${formattedDate}: ${paymentRequestUrl}`;
        await sendTelegramNotification(user.telegramId, notificationMessage);
        console.log(`Payment notification sent to ${user.username} via Telegram`);
      } catch (notifyError) {
        console.error(`Failed to send payment notification to ${user.username}:`, notifyError);
        // Don't fail the whole process if notification fails
      }
      
      return {
        success: true,
        paymentRequestUrl
      };
    } catch (error) {
      console.error('Error creating payment request:', error);
      return {
        success: false,
        paymentRequestUrl: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Create payment requests for all registered players (excluding waitlist) who haven't paid yet
   * @param gameId The ID of the game to create payment requests for
   * @param adminUserId User ID of the admin creating the payment requests
   * @param password Password for decrypting admin's Bunq credentials
   * @returns Object with success status and counts of requests created
   */
  createPaymentRequests: async (
    gameId: number,
    adminUserId: number,
    password: string
  ): Promise<{ 
    success: boolean; 
    requestsCreated: number;
    errors: string[];
  }> => {
    try {
      // Get game details
      const gameDetails = await db.select().from(games).where(eq(games.id, gameId));

      if (!gameDetails.length) {
        return {
          success: false,
          requestsCreated: 0,
          errors: ['Game not found']
        };
      }

      const game = gameDetails[0];
      
      // Get all registrations for this game that are not on waitlist and haven't paid
      // We determine waitlist status based on registration order
      const allRegistrations = await db.select({
          id: gameRegistrations.id,
          userId: gameRegistrations.userId,
          paid: gameRegistrations.paid,
          createdAt: gameRegistrations.createdAt
        })
        .from(gameRegistrations)
        .where(eq(gameRegistrations.gameId, gameId))
        .orderBy(gameRegistrations.createdAt);
      
      // Filter out waitlisted players (those beyond maxPlayers)
      const activeRegistrations = allRegistrations.slice(0, game.maxPlayers);
      
      // Filter out players who have already paid
      const unpaidRegistrations = activeRegistrations.filter(reg => !reg.paid);
      
      if (unpaidRegistrations.length === 0) {
        return { 
          success: true, 
          requestsCreated: 0,
          errors: []
        };
      }
      
      const errors: string[] = [];
      let requestsCreated = 0;
      
      const gameDate = new Date(game.dateTime);
      const formattedDate = gameDate.toLocaleDateString('en-GB', { 
        weekday: 'long',
        day: 'numeric', 
        month: 'long',
        hour: '2-digit', 
        minute: '2-digit'
      });
      
      for (const registration of unpaidRegistrations) {
        try {
          const userDetails = await db.select().from(users).where(eq(users.id, registration.userId));
          
          if (!userDetails.length) {
            errors.push(`User not found for registration ${registration.id}`);
            continue;
          }
          
          const user = userDetails[0];
          
          const result = await bunqService.createSinglePaymentRequest(
            user,
            game,
            formattedDate,
            registration.id,
            adminUserId,
            password
          );          
          if (result.success) {
            requestsCreated++;
          } else if (result.error) {
            errors.push(result.error);
          }
        } catch (error: any) {
          console.error('Error creating payment request:', error);
          errors.push(`Failed to create payment request for user ${registration.userId}: ${error.message || 'Unknown error'}`);
        }
      }
      
      return {
        success: requestsCreated > 0,
        requestsCreated,
        errors
      };
    } catch (error: any) {
      console.error('Error creating payment requests:', error);
      return {
        success: false,
        requestsCreated: 0,
        errors: [error.message || 'Unknown error']
      };
    }
  },
  
  /**
   * Update a player's registration paid status
   * 
   * @param gameId The ID of the game
   * @param userId The ID of the user to update
   * @param paid Boolean indicating whether the player has paid (true) or not (false)
   * @returns True if successful, false otherwise
   */
  updatePaidStatus: async (gameId: number, userId: number, paid: boolean): Promise<boolean> => {
    try {
      // Check if the registration exists
      const registration = await db
        .select()
        .from(gameRegistrations)
        .where(
          and(
            eq(gameRegistrations.gameId, gameId),
            eq(gameRegistrations.userId, userId)
          )
        )
        .limit(1)
        .then(rows => rows[0]);

      if (!registration) {
        console.error('Registration not found for game ID', gameId, 'and user ID', userId);
        return false;
      }

      // Update registration paid status
      await db
        .update(gameRegistrations)
        .set({ paid })
        .where(
          and(
            eq(gameRegistrations.gameId, gameId),
            eq(gameRegistrations.userId, userId)
          )
        );
      
      console.log(`User ${userId} for game ${gameId} paid status updated to: ${paid}`);
      
      // If registration is being marked as unpaid, immediately set game as not fully paid
      if (!paid) {
        await db
          .update(games)
          .set({ fullyPaid: false })
          .where(eq(games.id, gameId));
        console.log(`Game ${gameId} marked as not fully paid`);
        return true;
      }
      
      // Only check all registrations if this registration is being marked as paid
      // Get the game details
      const gameDetails = await db
        .select()
        .from(games)
        .where(eq(games.id, gameId))
        .limit(1);
      
      if (!gameDetails.length) {
        console.error('Game not found for ID', gameId);
        return true; // Still return true as the registration update was successful
      }
      
      const game = gameDetails[0];
      
      // Get all active (non-waitlist) registrations for this game
      const allRegistrations = await db
        .select()
        .from(gameRegistrations)
        .where(eq(gameRegistrations.gameId, gameId))
        .orderBy(gameRegistrations.createdAt);
      
      // Filter out waitlisted players (those beyond maxPlayers)
      const activeRegistrations = allRegistrations.slice(0, game.maxPlayers);
      
      // Check if all active registrations are paid
      const allPaid = activeRegistrations.every(reg => reg.paid);
      
      // Update the game's fullyPaid status if all are paid
      if (allPaid) {
        await db
          .update(games)
          .set({ fullyPaid: true })
          .where(eq(games.id, gameId));
        console.log(`Game ${gameId} marked as fully paid`);
      }
      
      return true;
    } catch (error: any) {
      console.error('Error updating registration paid status:', error);
      return false;
    }
  },

  /**
   * Check the status of a payment request with Bunq API
   * @param paymentRequestId The Bunq payment request ID to check
   * @param monetaryAccountId The monetary account ID associated with this payment request
   * @param adminUserId User ID of the admin checking the payment status
   * @param password Password for decrypting admin's Bunq credentials
   * @returns Boolean indicating whether the payment has been completed
   */
  checkPaymentRequestStatus: async (
    paymentRequestId: string,
    monetaryAccountId: number,
    adminUserId: number,
    password: string
  ): Promise<boolean> => {
    if (!paymentRequestId) {
      return false;
    }

    // Create Bunq client with admin credentials
    const bunqClientResult = await createBunqClient({
      userId: adminUserId,
      password
    });

    if (!bunqClientResult) {
      console.log("No Bunq client")
      return false;
    }

    const { client: bunqClient } = bunqClientResult;

    // Get the payment request status from Bunq API
    try {
      // Get the user ID from the session
      const userResponse = await bunqClient.get('/user');
      const userId = userResponse.data?.Response?.[0]?.UserPerson?.id || userResponse.data?.Response?.[0]?.UserCompany?.id;
      
      if (!userId) {
        throw new Error('Could not determine user ID from Bunq API');
      }
      
      const response = await bunqClient.get(
        `/user/${userId}/monetary-account/${monetaryAccountId}/request-inquiry/${paymentRequestId}`
      );

      if (response.status === 200) {
        if (response.data &&
          response.data.Response &&
          response.data.Response[0] &&
          response.data.Response[0].RequestInquiry) {
          const requestInquiry = response.data.Response[0].RequestInquiry;
          // Check if the status is ACCEPTED or PAID
          return ['ACCEPTED', 'PAID'].includes(requestInquiry.status);
        }
      }
    } catch (error: any) {
      console.error('Error in check payment request status API call:', {
        message: error.message,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers ? Object.keys(error.response.headers) : 'No headers'
        } : 'No response',
        responseErrors: error.response?.data?.Error,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers ? Object.keys(error.config.headers) : 'No headers'
        }
      });
    }

    return false;
  },

  /**
   * Update the status of all pending payment requests
   * @param adminUserId User ID of the admin updating the payment statuses
   * @param password Password for decrypting admin's Bunq credentials
   * @returns Object with success status and counts of updated requests
   */
  updateAllPaymentRequestStatuses: async (
    adminUserId: number,
    password: string
  ): Promise<{ 
    success: boolean; 
    updatedCount: number;
    errors: string[];
  }> => {
    try {
      // Get all payment requests that are not marked as paid
      const pendingPaymentRequests = await db
        .select()
        .from(paymentRequests)
        .where(eq(paymentRequests.paid, false));
      
      if (pendingPaymentRequests.length === 0) {
        return { 
          success: true, 
          updatedCount: 0,
          errors: []
        };
      }
      
      const errors: string[] = [];
      let updatedCount = 0;
      
      for (const paymentRequest of pendingPaymentRequests) {
        try {
          // Skip if no payment request ID (might be a test/mock entry)
          if (!paymentRequest.paymentRequestId) {
            continue;
          }
          
          // Update the last checked timestamp
          await db
            .update(paymentRequests)
            .set({ lastCheckedAt: new Date() })
            .where(eq(paymentRequests.id, paymentRequest.id));
          
          // Check if the payment has been completed
          const isPaid = await bunqService.checkPaymentRequestStatus(
            paymentRequest.paymentRequestId,
            paymentRequest.monetaryAccountId,
            adminUserId,
            password
          );
          
          if (isPaid) {
            // Get the game registration
            const registration = await db
              .select()
              .from(gameRegistrations)
              .where(eq(gameRegistrations.id, paymentRequest.gameRegistrationId))
              .limit(1)
              .then(rows => rows[0]);

            if (!registration) {
              errors.push(`Registration not found for payment request ${paymentRequest.id}`);
              continue;
            }
              
            // Update the payment request and registration as paid
            await db
                .update(paymentRequests)
              .set({ paid: true })
                .where(eq(paymentRequests.id, paymentRequest.id));
              
            await bunqService.updatePaidStatus(registration.gameId, registration.userId, true);
            
              updatedCount++;
          }
        } catch (error: any) {
          console.error('Error updating payment request status:', error);
          errors.push(`Failed to update payment request ${paymentRequest.id}: ${error.message || 'Unknown error'}`);
        }
      }
      
      return {
        success: updatedCount > 0 || pendingPaymentRequests.length === 0,
        updatedCount,
        errors
      };
    } catch (error: any) {
      console.error('Error updating payment request statuses:', error);
      return {
        success: false,
        updatedCount: 0,
        errors: [error.message || 'Unknown error']
      };
    }
  }
};
