import React, { useEffect, useState } from "react";
import { Armchair, Briefcase, CookingPot, Package, Tv } from "lucide-react";
import { getImage } from "../utils/storage.js";

const CATEGORY_ICONS = {
  furniture: Armchair,
  electronics: Tv,
  "home essentials": CookingPot,
  "work & study": Briefcase,
};

/**
 * Shows the item's photo. When there is no photo, or it fails to load, it shows
 * a neutral, theme-aware placeholder with an icon for the item's category, so an
 * item never appears with a photo of something else.
 */
function ProductImage({ product, alt = "", compact = false, className = "", ...rest }) {
  const src = getImage(product);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        onError={() => setFailed(true)}
        {...rest}
      />
    );
  }

  const Icon = CATEGORY_ICONS[String(product?.category || "").toLowerCase()] || Package;

  return (
    <div
      className={`image-placeholder ${compact ? "compact" : ""} ${className}`.trim()}
      role="img"
      aria-label={alt || "Photo coming soon"}
    >
      <Icon size={compact ? 24 : 40} strokeWidth={1.5} aria-hidden="true" />
      {!compact && <span>Photo coming soon</span>}
    </div>
  );
}

export default ProductImage;
