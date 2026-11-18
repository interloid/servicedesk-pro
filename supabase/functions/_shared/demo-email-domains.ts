/**
 * Email domains used by the demo data (scripts/seed-data.mjs). They look like
 * real company domains so the demo reads like a live workspace, but some of
 * them may belong to real companies, so nothing is ever sent to them:
 * sendEmail (./gmail.ts) skips any recipient on these domains and logs it.
 *
 * scripts/seed-data.test.mjs fails if a seeded address uses a domain missing
 * from this list, so the two cannot drift apart. Plain TypeScript with no
 * Deno or Node APIs: the Edge Functions and the Node seed script both import it.
 */
export const DEMO_EMAIL_DOMAINS: readonly string[] = [
  "aurorafreight.com",
  "bayoucityelectric.com",
  "baysidept.com",
  "bluepeaksoftware.com",
  "cascadeprep.com",
  "cedarhealthgroup.com",
  "centralvalleygrocers.com",
  "coronadobayresorts.com",
  "ctriverbuilders.com",
  "cuyahogatool.com",
  "dunmoreoutfitters.com",
  "elliottbayimports.com",
  "emberhospitality.com",
  "farmingtonpeds.com",
  "fernhilllearning.com",
  "frontrangebuilding.com",
  "graniteridgefinancial.com",
  "gulfcoastfab.com",
  "harborlineshipping.com",
  "hillcountryrealty.com",
  "ivoryandlane.com",
  "juniperridgeenergy.com",
  "kestrelmedia.com",
  "lakeerieplastics.com",
  "lakeshoreski.com",
  "lakeviewbilling.com",
  "lakewaydental.com",
  "lumenfieldinsurance.com",
  "meridianprecision.com",
  "musicrowcatering.com",
  "nimbustravel.com",
  "northfieldclinic.com",
  "northstartrail.com",
  "orchardvalleyfoods.com",
  "pacificcresttours.com",
  "piedmontauto.com",
  "pugetsoundseafood.com",
  "queencitydental.com",
  "riverfrontevents.com",
  "sierrafreshmarkets.com",
  "silverlakerecords.com",
  "summitridgesupply.com",
  "sunsetlanestudios.com",
  "willamettevalleysd.com",
  "wrigleyvillepm.com",
];

/** True when `address` is on a demo domain (or a subdomain of one). */
export function isDemoEmail(address: string): boolean {
  const domain = address.slice(address.lastIndexOf("@") + 1).toLowerCase();
  return DEMO_EMAIL_DOMAINS.some(
    (demo) => domain === demo || domain.endsWith(`.${demo}`),
  );
}
