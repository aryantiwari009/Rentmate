/**
 * Currency conversion and monetary rounding utilities for RentMate and PayPal integrations.
 */

export function getCurrencyConfig() {
  const inrPerUsd = Number(process.env.INR_PER_USD) || 85;
  const currency = process.env.PAYPAL_CURRENCY || "USD";
  return { inrPerUsd, currency };
}

/**
 * Calculates a mathematically sound breakdown of rental amount and security deposit
 * into the target currency (e.g. USD) guaranteeing that rentTarget + depositTarget === totalTarget exactly.
 *
 * @param {Object} booking - Booking with monthlyRent, months, deposit, total
 * @param {number} [rate] - Conversion rate (defaults to booking.exchangeRate, INR_PER_USD, or 85)
 * @param {string} [targetCurrency] - Target currency code (defaults to booking.chargedCurrency, PAYPAL_CURRENCY, or "USD")
 */
export function calculateBookingBreakdown(booking, rate, targetCurrency) {
  const cfg = getCurrencyConfig();
  const conversionRate = Number(rate || booking?.exchangeRate || cfg.inrPerUsd) || 85;
  const currency = targetCurrency || booking?.chargedCurrency || cfg.currency;

  const totalInr = Number(booking?.total || 0);
  const rentInr = Number(booking?.monthlyRent || 0) * Number(booking?.months || 1);
  const depositInr = Number(booking?.deposit || 0);

  // Total in target currency rounded to 2 decimal places
  const totalTarget = Number((totalInr / conversionRate).toFixed(2));

  // Rent in target currency rounded to 2 decimal places
  const rentTarget = Number((rentInr / conversionRate).toFixed(2));

  // Deposit in target currency derived by difference to avoid penny rounding discrepancy
  const depositTarget = Number((totalTarget - rentTarget).toFixed(2));

  return {
    conversionRate,
    currency,
    totalInr,
    rentInr,
    depositInr,
    totalTarget,
    rentTarget,
    depositTarget,
  };
}
