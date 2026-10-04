import crypto from 'crypto';
import { db } from '../../db';
import { games, gameRegistrations, users, paymentRequests } from '../../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { notifyUser } from '../notificationService';
import { calculatePerParticipantCost } from '../../utils/pricingUtils';
import { PricingMode } from '../../types/PricingMode';
import { formatGameDate } from '../../utils/dateUtils';
import { toEmailLocalPart } from './emailLocalPart';
import type { BunqClientPort } from './bunqClientPort';
import { liveBunqClientPort } from './bunqSessionService';

type User = typeof users.$inferSelect;
type Game = typeof games.$inferSelect;

interface PaymentRequestResult {
  success: boolean;
  paymentRequestUrl: string;
  error?: string;
}

export type BunqPaymentRequestService = ReturnType<typeof createBunqPaymentRequestService>;

/**
 * Payment-request operations that talk to Bunq only through {@link BunqClientPort}.
 * Pass a fake port in unit tests to avoid installation/session code.
 */
export function createBunqPaymentRequestService(clientPort: BunqClientPort) {
  const service = {
    /**
     * Create a consolidated payment request for a user covering multiple participants (user + guests)
     */
    createConsolidatedPaymentRequest: async (
      user: User,
      game: Game,
      formattedDate: string,
      userRegistrations: Array<{
        id: number;
        userId: number;
        guestName: string | null;
        paid: boolean;
        createdAt: Date | null;
      }>,
      totalAmount: number,
      adminUserId: number,
      password: string
    ): Promise<PaymentRequestResult> => {
      try {
        const bunqClientResult = await clientPort.createClient({
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

        // Create description for consolidated payment
        const participantDescriptions: string[] = [];

        for (const registration of userRegistrations) {
          if (registration.guestName) {
            participantDescriptions.push(`guest ${registration.guestName}`);
          } else {
            participantDescriptions.push('yourself');
          }
        }

        const participantsText = participantDescriptions.length === 1
          ? participantDescriptions[0]
          : participantDescriptions.slice(0, -1).join(', ') + ' and ' + participantDescriptions.slice(-1)[0];

        const description = `Volleyball game on ${formattedDate} for ${participantsText}`;

        // Get the user ID from the session
        const userResponse = await bunqClient.get('/user');
        const userId = userResponse.data?.Response?.[0]?.UserPerson?.id || userResponse.data?.Response?.[0]?.UserCompany?.id;

        if (!userId) {
          throw new Error('Could not determine user ID from Bunq API');
        }

        // Create payment request data
        const paymentRequestData = {
          amount_inquired: {
            value: (totalAmount / 100).toFixed(2),
            currency: 'EUR'
          },
          counterparty_alias: {
            type: 'EMAIL',
            // Prefer Telegram username for stable alias; fallback to display name
            value: `${toEmailLocalPart(user.telegramUsername || user.displayName, user.id)}@volleyfun.nl`
          },
          description: description,
          allow_bunqme: true
        };

        // Sign the request body
        const dataToSign = JSON.stringify(paymentRequestData);
        const signature = crypto.sign('sha256', Buffer.from(dataToSign), privateKey);
        const base64Signature = signature.toString('base64');

        // Create the payment request
        let response: { status: number; data: any };
        try {
          response = await bunqClient.post(
            `/user/${userId}/monetary-account/${monetaryAccountId}/request-inquiry`,
            paymentRequestData,
            {
              headers: {
                'X-Bunq-Client-Signature': base64Signature
              }
            }
          );
        } catch (error: any) {
          console.error('Error creating payment request:', {
            message: error?.message,
            response: error.response ? {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data
            } : 'No response',
            responseErrors: error.response?.data?.Error,
          });
          return {
            success: false,
            paymentRequestUrl: '',
            error: error instanceof Error
              ? error.message
              : (error.response?.statusText ?? 'Unknown error')
          };
        }

        if (response.status !== 200) {
          throw new Error(`Bunq API returned status ${response.status}`);
        }

        console.log('Sent payment request for ' + (user.telegramUsername || user.displayName), response.data?.Response?.[0]);

        // Prefer RequestInquiry.id; fallback to Id.id depending on Bunq response shape
        const paymentRequestId: string | number | undefined =
          response.data?.Response?.[0]?.RequestInquiry?.id ??
          response.data?.Response?.[0]?.Id?.id;

        if (!paymentRequestId) {
          throw new Error('Failed to obtain payment request id from Bunq response');
        }

        // Ensure string type for downstream usage and DB schema
        const paymentRequestIdStr: string = String(paymentRequestId);

        // Fetch the created payment request to obtain full details including bunqme_share_url
        let paymentRequestUrl: string | undefined = response.data?.Response?.[0]?.RequestInquiry?.bunqme_share_url;
        try {
          if (!paymentRequestUrl) {
            const detailsResponse = await bunqClient.get(
              `/user/${userId}/monetary-account/${monetaryAccountId}/request-inquiry/${paymentRequestIdStr}`
            );
            const requestInquiry = detailsResponse.data?.Response?.[0]?.RequestInquiry;
            paymentRequestUrl = requestInquiry?.bunqme_share_url;
          }
        } catch (detailsErr: any) {
          console.error('Error fetching payment request details:', {
            message: detailsErr?.message,
            response: detailsErr?.response ? {
              status: detailsErr.response.status,
              statusText: detailsErr.response.statusText,
              data: detailsErr.response.data
            } : 'No response',
            responseErrors: detailsErr.response?.data?.Error,
          });
        }

        if (!paymentRequestUrl) {
          throw new Error('Failed to obtain payment request URL from Bunq API');
        }

        // Store payment request records for all registrations
        for (const registration of userRegistrations) {
          await db.insert(paymentRequests).values({
            paymentRequestId: paymentRequestIdStr,
            gameRegistrationId: registration.id,
            userId: user.id,
            amountCents: totalAmount,
            paymentLink: paymentRequestUrl,
            monetaryAccountId: monetaryAccountId,
            createdAt: new Date(),
            lastCheckedAt: new Date(),
            paid: false
          });
        }

        // Notify the user about the payment request
        await notifyUser(
          user,
          `💳 Please pay <b>€${(totalAmount / 100).toFixed(2)}</b> for ${participantsText} for the volleyball game on ${formattedDate}.\n\n` +
          (paymentRequestUrl ? `Pay here: <a href="${paymentRequestUrl}">${paymentRequestUrl}</a>` : 'Payment link is being prepared, please try again shortly.'),
          game.id
        );

        return {
          success: true,
          paymentRequestUrl
        };
      } catch (error) {
        console.error('Error creating consolidated payment request:', error);
        return {
          success: false,
          paymentRequestUrl: '',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },

    /**
     * Create payment requests for all registered players (excluding waitlist) who haven't paid yet
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
            guestName: gameRegistrations.guestName,
            paid: gameRegistrations.paid,
            createdAt: gameRegistrations.createdAt
          })
          .from(gameRegistrations)
          .where(eq(gameRegistrations.gameId, gameId))
          .orderBy(gameRegistrations.createdAt);

        // Filter out waitlisted players (those beyond maxPlayers)
        const activeRegistrations = allRegistrations.slice(0, game.maxPlayers);

        // Group active registrations by userId
        const registrationsByUser = new Map<number, typeof activeRegistrations>();
        for (const registration of activeRegistrations) {
          const userId = registration.userId;
          if (!registrationsByUser.has(userId)) {
            registrationsByUser.set(userId, []);
          }
          registrationsByUser.get(userId)!.push(registration);
        }

        // Filter out users who have already paid for all their registrations
        const unpaidUserGroups = Array.from(registrationsByUser.entries())
          .filter(([, userRegistrations]) =>
            userRegistrations.some(reg => !reg.paid)
          );

        if (unpaidUserGroups.length === 0) {
          return {
            success: true,
            requestsCreated: 0,
            errors: []
          };
        }

        const errors: string[] = [];
        let requestsCreated = 0;

        const gameDate = new Date(game.dateTime);
        const formattedDate = formatGameDate(gameDate);

        for (const [userId, userRegistrations] of unpaidUserGroups) {
          try {
            const registrationIds = userRegistrations.map((r) => r.id);
            const existingUnpaid = await db
              .select({ id: paymentRequests.id })
              .from(paymentRequests)
              .where(
                and(
                  inArray(paymentRequests.gameRegistrationId, registrationIds),
                  eq(paymentRequests.paid, false)
                )
              )
              .limit(1);

            // Idempotency: client retry (e.g. after HTTP 499) must not create duplicate Bunq inquiries
            if (existingUnpaid.length > 0) {
              continue;
            }

            const userDetails = await db.select().from(users).where(eq(users.id, userId));

            if (!userDetails.length) {
              errors.push(`User not found for user ID ${userId}`);
              continue;
            }

            const user = userDetails[0];

            // Calculate total amount for this user (themselves + all their guests)
            const participantCount = userRegistrations.length;
            const perParticipantCost = calculatePerParticipantCost(
              game.paymentAmount,
              game.pricingMode as PricingMode,
              game.maxPlayers,
              activeRegistrations.length // Use actual number of active registrations
            );
            // Base total for this user's participants
            let totalAmount = perParticipantCost * participantCount;

            // Surcharge: add €0.20 if the user has no Telegram ID but has a phone number
            // Interpretation: surcharge is applied per user group (not per participant).
            // If you want it per participant, change '+= 20' to '+= 20 * participantCount'.
            const isPhoneOnly = (!user.telegramId || user.telegramId.length === 0) && !!user.phoneNumber;
            if (isPhoneOnly) {
              totalAmount += 20; // cents
            }

            // Create consolidated payment request for this user
            const result = await service.createConsolidatedPaymentRequest(
              user,
              game as Game,
              formattedDate,
              userRegistrations,
              totalAmount,
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
            errors.push(`Failed to create payment request for user ${userId}: ${error.message || 'Unknown error'}`);
          }
        }

        // If there were no errors, remove all waitlisted registrations (those beyond maxPlayers)
        if (errors.length === 0) {
          try {
            const waitlistIds = allRegistrations
              .slice(game.maxPlayers)
              .map(r => r.id);
            if (waitlistIds.length > 0) {
              await db
                .delete(gameRegistrations)
                .where(inArray(gameRegistrations.id, waitlistIds));
              console.log(`Deleted ${waitlistIds.length} waitlisted registrations for game ${gameId}`);
            }
          } catch (cleanupError) {
            console.error('Failed to delete waitlisted registrations:', cleanupError);
            // Do not flip success due to cleanup; just log the error
          }
        }

        return {
          // True when nothing failed; 0 created is OK (nothing to do or idempotent replay)
          success: errors.length === 0,
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

      const bunqClientResult = await clientPort.createClient({
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
            const isPaid = await service.checkPaymentRequestStatus(
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

              await service.updatePaidStatus(registration.gameId, registration.userId, true);

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

  return service;
}

/** Production payment-request service wired to the live session client port. */
export const bunqPaymentRequestService = createBunqPaymentRequestService(liveBunqClientPort);
