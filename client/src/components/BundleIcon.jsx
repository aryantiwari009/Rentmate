import React from "react";
import { GraduationCap, Home, Laptop } from "lucide-react";

const icons = {
  "student-starter": GraduationCap,
  "work-from-home": Laptop,
  "temporary-home": Home,
};

function BundleIcon({ id, size = 22 }) {
  const Icon = icons[id] || Home;
  return <Icon size={size} aria-hidden="true" />;
}

export default BundleIcon;
