import axios from 'axios';
import { db } from '../db';
import { games, gameRegistrations, users } from '../db/schema';
import { eq, and, not } from 'drizzle-orm';
import { sendTelegramNotification } from './telegramService';

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
  createdAt: Date | null;
  createdById: number;
}

interface PaymentRequestResult {
  success: boolean;
  paymentRequestUrl: string;
  error?: string;
}

// Environment variables for Bunq API
const BUNQ_API_KEY = process.env.BUNQ_API_KEY;
const BUNQ_API_URL = process.env.BUNQ_API_URL || 'https://api.bunq.com/v1';
const BUNQ_MONETARY_ACCOUNT_ID = process.env.BUNQ_MONETARY_ACCOUNT_ID;

// Create Bunq API client
const bunqClient = axios.create({
  baseURL: BUNQ_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Bunq-Client-Authentication': BUNQ_API_KEY,
    'Cache-Control': 'no-cache'
  }
});

/**
 * Bunq service functions for payment requests
 */
export const bunqService = {
  /**
   * Create a payment request for a single game participant
   * @param user The user to create the payment request for
   * @param game The game details
   * @param formattedDate Formatted date string for the game
   * @returns Object with success status and payment URL
   */
  createSinglePaymentRequest: async (user: User, game: Game, formattedDate: string): Promise<PaymentRequestResult> => {
    try {
      // Skip if no contact information is available
      if (!user.telegramId) {
        return {
          success: false,
          paymentRequestUrl: '',
          error: `No contact information available for user ${user.id}`
        };
      }
      
      // Create payment request via Bunq API
      const paymentRequestData = {
        amount_inquired: {
          value: (game.paymentAmount / 100).toFixed(2), // Convert cents to euros
          currency: 'EUR'
        },
        counterparty_alias: {
          type: 'PHONE_NUMBER',
          value: user.telegramId, // Using telegramId as identifier
          name: user.username
        },
        description: `Volleyball game payment for ${formattedDate}`,
        allow_bunqme: true, // Allow payment via bunq.me
        redirect_url: process.env.PAYMENT_REDIRECT_URL // Optional redirect URL after payment
      };
      
      const formattedAmount = `€${(game.paymentAmount / 100).toFixed(2)}`;
      
      let paymentRequestUrl = '';
      if (BUNQ_API_KEY && BUNQ_MONETARY_ACCOUNT_ID) {
        const response = await bunqClient.post(
          `/user/id/monetary-account/${BUNQ_MONETARY_ACCOUNT_ID}/request-inquiry`,
          paymentRequestData
        );
        
        if (response.status === 200 || response.status === 201) {
          if (response.data && response.data.Response && 
              response.data.Response[0] && 
              response.data.Response[0].RequestInquiry) {
            const requestInquiry = response.data.Response[0].RequestInquiry;
            if (requestInquiry.bunqme_share_url) {
              paymentRequestUrl = requestInquiry.bunqme_share_url;
            }
          }
        } else {
          return {
            success: false,
            paymentRequestUrl: '',
            error: `Failed to create payment request: API returned status ${response.status}`
          };
        }
      } else {
        // For development/testing without actual API keys
        console.log('Would create payment request for:', user.username, 'Amount:', paymentRequestData.amount_inquired);
        paymentRequestUrl = 'https://bunq.me/payment-request/example';
      }
      
      // Send Telegram notification to the player
      try {
        const notificationMessage = `🏐 Payment Request: ${formattedAmount} for volleyball game on ${formattedDate}\n\n` +
          `Please complete your payment using the following link:\n` +
          (paymentRequestUrl ? `${paymentRequestUrl}\n\n` : '') +
          `If you have any questions, please contact the game organizer.`;
        
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
   * @returns Object with success status and counts of requests created
   */
  createPaymentRequests: async (gameId: number): Promise<{ 
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
          
          const result = await bunqService.createSinglePaymentRequest(user, game, formattedDate);          
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
      return true;
    } catch (error: any) {
      console.error('Error updating registration paid status:', error);
      return false;
    }
  },
};
