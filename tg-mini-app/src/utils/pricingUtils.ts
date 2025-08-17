import { PricingMode } from '../types';

/**
 * Calculate per-participant cost based on pricing mode
 * @param paymentAmount - The payment amount in cents
 * @param pricingMode - The pricing mode
 * @param maxPlayers - The maximum number of players
 * @param actualPlayers - The actual number of registered players (for dynamic calculation)
 * @returns The per-participant cost in cents
 */
export function calculatePerParticipantCost(
  paymentAmount: number,
  pricingMode: PricingMode,
  maxPlayers: number,
  actualPlayers?: number
): number {
  if (pricingMode === PricingMode.PER_PARTICIPANT) {
    return paymentAmount;
  }
  
  // For total_cost mode, divide by actual players if provided, otherwise by maxPlayers
  const playerCount = actualPlayers || maxPlayers;
  return Math.round(paymentAmount / playerCount);
}

/**
 * Calculate total cost based on pricing mode
 * @param paymentAmount - The payment amount in cents
 * @param pricingMode - The pricing mode
 * @param playerCount - The number of players
 * @returns The total cost in cents
 */
export function calculateTotalCost(
  paymentAmount: number,
  pricingMode: PricingMode,
  playerCount: number
): number {
  if (pricingMode === PricingMode.TOTAL_COST) {
    return paymentAmount;
  }
  
  // For per_participant mode, multiply by player count
  return paymentAmount * playerCount;
}

/**
 * Format pricing information for display
 * @param paymentAmount - The payment amount in cents
 * @param pricingMode - The pricing mode
 * @param maxPlayers - The maximum number of players
 * @param actualPlayers - The actual number of registered players
 * @returns Formatted pricing information
 */
/**
 * Calculate per-participant cost for display with 15 euro cap for upcoming games in total cost mode
 * @param paymentAmount - The payment amount in cents
 * @param pricingMode - The pricing mode
 * @param maxPlayers - The maximum number of players
 * @param actualPlayers - The actual number of registered players
 * @param isUpcomingGame - Whether this is an upcoming game (defaults to true)
 * @returns The per-participant cost in cents, capped at 15 euros for total cost mode upcoming games
 */
export function calculateDisplayPerParticipantCost(
  paymentAmount: number,
  pricingMode: PricingMode,
  maxPlayers: number,
  actualPlayers?: number,
  isUpcomingGame: boolean = true
): number {
  const perParticipantCost = calculatePerParticipantCost(paymentAmount, pricingMode, maxPlayers, actualPlayers);
  
  // Apply 15 euro cap only for upcoming games in total cost mode
  if (isUpcomingGame && pricingMode === PricingMode.TOTAL_COST) {
    const maxDisplayCost = 15 * 100; // 15 euros in cents
    return Math.min(perParticipantCost, maxDisplayCost);
  }
  
  return perParticipantCost;
}


/**
 * Format pricing information for display with 15 euro cap for upcoming games in total cost mode
 * @param paymentAmount - The payment amount in cents
 * @param pricingMode - The pricing mode
 * @param maxPlayers - The maximum number of players
 * @param actualPlayers - The actual number of registered players
 * @param isUpcomingGame - Whether this is an upcoming game (defaults to true)
 * @returns Formatted pricing information with display cost cap applied
 */
export function formatDisplayPricingInfo(
  paymentAmount: number,
  pricingMode: PricingMode,
  maxPlayers: number,
  actualPlayers?: number,
  isUpcomingGame: boolean = true
): {
  perParticipantCost: number;
  displayPerParticipantCost: number;
  totalCost: number;
  displayText: string;
} {
  const perParticipantCost = calculatePerParticipantCost(paymentAmount, pricingMode, maxPlayers, actualPlayers);
  const displayPerParticipantCost = calculateDisplayPerParticipantCost(paymentAmount, pricingMode, maxPlayers, actualPlayers, isUpcomingGame);
  const playerCount = actualPlayers || maxPlayers;
  const totalCost = calculateTotalCost(paymentAmount, pricingMode, playerCount);
  
  // Always show per-participant cost (with cap applied for upcoming total cost games)
  const displayAmount = displayPerParticipantCost;
  let displayText = `€${(displayAmount / 100).toFixed(2)} per participant`;
  
  return {
    perParticipantCost,
    displayPerParticipantCost,
    totalCost,
    displayText
  };
}
