import { calculateBookingBreakdown } from "./currency.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("Starting currency conversion & consistency tests...");

// Test Case 1: User's Ergonomic Office Chair (₹499/mo, 2 mo, ₹1,200 deposit, ₹2,198 total)
{
  const booking = {
    monthlyRent: 499,
    months: 2,
    deposit: 1200,
    total: 2198,
  };
  const b = calculateBookingBreakdown(booking, 85, "USD");
  console.log("Test Case 1 (Chair):", b);

  assert(b.totalInr === 2198, "totalInr should be 2198");
  assert(b.rentInr === 998, "rentInr should be 998");
  assert(b.depositInr === 1200, "depositInr should be 1200");
  assert(b.rentTarget === 11.74, `rentTarget should be 11.74, got ${b.rentTarget}`);
  assert(b.depositTarget === 14.12, `depositTarget should be 14.12, got ${b.depositTarget}`);
  assert(b.totalTarget === 25.86, `totalTarget should be 25.86, got ${b.totalTarget}`);
  assert(
    Number((b.rentTarget + b.depositTarget).toFixed(2)) === b.totalTarget,
    "Line items must sum exactly to totalTarget"
  );
}

// Test Case 2: User's Study / Work Table (₹599/mo, 2 mo, ₹1,500 deposit, ₹2,698 total)
{
  const booking = {
    monthlyRent: 599,
    months: 2,
    deposit: 1500,
    total: 2698,
  };
  const b = calculateBookingBreakdown(booking, 85, "USD");
  console.log("Test Case 2 (Table):", b);

  assert(b.totalInr === 2698, "totalInr should be 2698");
  assert(b.rentInr === 1198, "rentInr should be 1198");
  assert(b.depositInr === 1500, "depositInr should be 1500");
  assert(b.rentTarget === 14.09, `rentTarget should be 14.09, got ${b.rentTarget}`);
  assert(b.depositTarget === 17.65, `depositTarget should be 17.65, got ${b.depositTarget}`);
  assert(b.totalTarget === 31.74, `totalTarget should be 31.74, got ${b.totalTarget}`);
  assert(
    Number((b.rentTarget + b.depositTarget).toFixed(2)) === b.totalTarget,
    "Line items must sum exactly to totalTarget"
  );
}

// Test Case 3: Penny Rounding Edge Case (100 / 85 = 1.18, 100 / 85 = 1.18, total 200 / 85 = 2.35)
{
  const booking = {
    monthlyRent: 100,
    months: 1,
    deposit: 100,
    total: 200,
  };
  const b = calculateBookingBreakdown(booking, 85, "USD");
  console.log("Test Case 3 (Rounding edge case):", b);

  assert(
    Number((b.rentTarget + b.depositTarget).toFixed(2)) === b.totalTarget,
    `Line items (${b.rentTarget} + ${b.depositTarget}) must sum to totalTarget (${b.totalTarget})`
  );
}

// Test Case 4: Zero Deposit Rental
{
  const booking = {
    monthlyRent: 750,
    months: 3,
    deposit: 0,
    total: 2250,
  };
  const b = calculateBookingBreakdown(booking, 85, "USD");
  console.log("Test Case 4 (Zero deposit):", b);

  assert(b.depositTarget === 0, "Deposit target must be 0");
  assert(b.rentTarget === b.totalTarget, "Rent target must equal total target");
  assert(
    Number((b.rentTarget + b.depositTarget).toFixed(2)) === b.totalTarget,
    "Line items must sum to totalTarget"
  );
}

// Test Case 5: 1000 randomized amounts to guarantee zero penny discrepancy ever
{
  for (let i = 0; i < 1000; i++) {
    const rent = Math.floor(Math.random() * 5000) + 100;
    const months = Math.floor(Math.random() * 12) + 1;
    const deposit = Math.floor(Math.random() * 5000);
    const total = rent * months + deposit;
    const rate = Math.floor(Math.random() * 30) + 70; // 70-100

    const b = calculateBookingBreakdown(
      { monthlyRent: rent, months, deposit, total },
      rate,
      "USD"
    );

    const sum = Number((b.rentTarget + b.depositTarget).toFixed(2));
    if (sum !== b.totalTarget) {
      throw new Error(
        `Discrepancy at rent=${rent}, months=${months}, deposit=${deposit}, rate=${rate}: rent=${b.rentTarget}, deposit=${b.depositTarget}, sum=${sum}, total=${b.totalTarget}`
      );
    }
  }
  console.log("Test Case 5: 1,000 randomized simulations passed with 0 discrepancies!");
}

console.log("ALL CURRENCY TESTS PASSED SUCCESSFULLY!");
