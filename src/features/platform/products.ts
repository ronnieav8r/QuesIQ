export type PlatformProductKey = "dpe" | "interview" | "nclex" | "study";

export type PlatformProduct = {
  available: boolean;
  description: string;
  href: string;
  key: PlatformProductKey;
  label: string;
  name: string;
  shortName: string;
  status: string;
};

export const platformProducts: PlatformProduct[] = [
  {
    description:
      "Voice-first interview practice, Story Lab, job targets, reviews, and coaching memory.",
    href: "/interview",
    available: true,
    key: "interview",
    label: "Open Interview",
    name: "QuesIQ Interview",
    shortName: "Interview",
    status: "Active",
  },
  {
    description: "Flashcards, study modes, public decks, import tools, and verbal review.",
    href: "/study",
    available: true,
    key: "study",
    label: "Open Study",
    name: "QuesIQ Study",
    shortName: "Study",
    status: "Import lane",
  },
  {
    description:
      "NCLEX-RN readiness practice with client-needs categories, clinical judgment steps, and authored answer keys.",
    href: "/nclex",
    available: true,
    key: "nclex",
    label: "Open NCLEX",
    name: "QuesIQ NCLEX",
    shortName: "NCLEX",
    status: "Scaffold lane",
  },
  {
    description: "Private Pilot oral checkride preparation with DPE-owned practice data.",
    href: "/dpe",
    available: true,
    key: "dpe",
    label: "Open DPE",
    name: "QuesIQ DPE",
    shortName: "DPE",
    status: "Import lane",
  },
];

export const availablePlatformProducts = platformProducts.filter((product) => product.available);

export function getSafeProductHref(value?: string | null) {
  const product = platformProducts.find(
    (item) => item.key === value || item.href === value,
  );

  return product?.available ? product.href : "/";
}

export function getSafeNextPath(value?: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  const product = platformProducts.find((item) => value === item.href || value.startsWith(`${item.href}/`));
  if (product && !product.available) {
    return "/apps";
  }

  return value;
}
