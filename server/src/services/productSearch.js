function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Turns search options (from the URL or from the AI) into a MongoDB filter.
export function buildProductFilter(query = {}) {
  const filter = {};

  // highest monthly rent
  const maxPrice = Number(query.maxPrice);
  if (query.maxPrice !== undefined && query.maxPrice !== "" && !Number.isNaN(maxPrice)) {
    filter.price = { $lte: maxPrice };
  }

  // exact category, ignoring capital letters
  const { category } = query;
  if (typeof category === "string" && category.trim() !== "") {
    filter.category = {
      $regex: `^${escapeRegex(category.trim())}$`,
      $options: "i",
    };
  }

  // text search: every word must appear in the name or the description
  const { q } = query;
  if (typeof q === "string" && q.trim() !== "") {
    const words = q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
    filter.$and = words.map((word) => {
      const safe = escapeRegex(word);
      return {
        $or: [
          { name: { $regex: safe, $options: "i" } },
          { description: { $regex: safe, $options: "i" } },
        ],
      };
    });
  }

  // only items that can be rented now
  if (query.available === "true" || query.available === true) {
    filter.available = true;
  }

  return filter;
}