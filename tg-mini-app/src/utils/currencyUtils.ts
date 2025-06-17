/**
 * Currency utility functions for handling payment amounts
 */

/**
 * Converts a euro amount string (with comma or dot as decimal separator) to cents
 * @param euroValue String representing an amount in euros (e.g. "10.50" or "10,50")
 * @returns Number of cents as an integer
 */
export const eurosToCents = (euroValue: string): number => {
  // Convert the input value to a valid number by replacing comma with dot
  const normalizedValue = euroValue.replace(',', '.');
  
  // Parse the value as a float and convert to cents (integer)
  const floatValue = parseFloat(normalizedValue);
  
  if (!isNaN(floatValue)) {
    // Convert euros to cents (multiply by 100)
    return Math.round(floatValue * 100);
  }
  
  // If input is not a valid number, return 0
  return 0;
};

/**
 * Formats a cents amount as a euro string with the € symbol
 * @param cents Amount in cents as an integer
 * @returns Formatted string with euro symbol (e.g. "€10.50")
 */
export const formatEuros = (cents: number): string => {
  const euros = (cents / 100).toFixed(2);
  return `€${euros}`;
};

/**
 * Converts cents to a euro string without the € symbol (for form inputs)
 * @param cents Amount in cents as an integer
 * @returns Euro amount as a string with 2 decimal places (e.g. "10.50")
 */
export const centsToEuroString = (cents: number): string => {
  return (cents / 100).toFixed(2);
};
