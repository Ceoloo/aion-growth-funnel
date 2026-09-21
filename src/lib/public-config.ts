/**
 * Values the browser is allowed to know.
 *
 * `NEXT_PUBLIC_*` variables are inlined at build time and are visible to
 * anyone who loads the page, so only genuinely public values belong here.
 * Both of these are links we actively want visitors to use.
 */
export const publicConfig = {
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL?.trim() || undefined,
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || undefined,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://aionsystems.example",
} as const;
