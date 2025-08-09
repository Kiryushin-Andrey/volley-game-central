import { PricingMode } from '../types/PricingMode';

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
