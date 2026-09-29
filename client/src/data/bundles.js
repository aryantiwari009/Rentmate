// Each bundle is made of "slots". A slot is matched against the live catalogue
// by keyword (not by exact product name), so bundles keep working when the
// backend, demo data or community listings use different names or prices.
const slot = (label, keywords) => ({ label, keywords });

const TABLE = slot("Study & Work Table", ["table", "desk"]);
const CHAIR = slot("Ergonomic Office Chair", ["chair"]);
const MONITOR = slot("Monitor", ["monitor"]);
const BED = slot("Single Bed + Mattress", ["bed"]);
const FRIDGE = slot("Refrigerator", ["refrigerator", "fridge"]);

export const rentalBundles = [
  {
    id: "student-starter",
    name: "Student Starter Pack",
    description: "A practical setup for studying, coding and everyday living.",
    slots: [TABLE, CHAIR, MONITOR, BED],
  },
  {
    id: "work-from-home",
    name: "Work From Home Pack",
    description: "Everything you need for a focused home office without buying it.",
    slots: [TABLE, CHAIR, MONITOR],
  },
  {
    id: "temporary-home",
    name: "Temporary Home Pack",
    description: "A flexible starter setup for a temporary room or short stay.",
    slots: [BED, TABLE, FRIDGE],
  },
].map((bundle) => ({
  ...bundle,
  fallbackItems: bundle.slots.map((s) => ({ name: s.label })),
}));

// Pick the cheapest available product that matches a slot.
export function matchSlot(slotDef, products) {
  const matches = products.filter((product) => {
    if (product.available === false) return false;
    const name = String(product.name || "").toLowerCase();
    return slotDef.keywords.some((word) => name.includes(word));
  });
  matches.sort((a, b) => Number(a.price) - Number(b.price));
  return matches[0] || null;
}
