import axios from 'axios';
import { BUNQ_API_URL } from './bunqConstants';

/**
 * Fetches monetary accounts for a user using a session token
 */
export async function fetchMonetaryAccounts(sessionToken: string, apiKeyName: string): Promise<any[] | null> {
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
