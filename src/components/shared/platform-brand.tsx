"use client";

import { createContext, useContext } from "react";

export type PlatformBrand = {
  platformName: string;
  supportEmail: string;
};

const PlatformBrandContext = createContext<PlatformBrand>({
  platformName: "ServiceDeskPro",
  supportEmail: "support@servicedeskpro.com",
});

/**
 * Carries the name and support address set in /platform/settings from the root
 * layout to every page, including client pages that can't read the database.
 */
export function PlatformBrandProvider({
  brand,
  children,
}: {
  brand: PlatformBrand;
  children: React.ReactNode;
}) {
  return (
    <PlatformBrandContext.Provider value={brand}>
      {children}
    </PlatformBrandContext.Provider>
  );
}

export function usePlatformBrand(): PlatformBrand {
  return useContext(PlatformBrandContext);
}

export function PlatformName() {
  return <>{usePlatformBrand().platformName}</>;
}

/** The letter in the logo tile. */
export function PlatformInitial() {
  return <>{usePlatformBrand().platformName.charAt(0).toUpperCase()}</>;
}
