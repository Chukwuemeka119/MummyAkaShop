/**
 * ==========================================================================
 * STORE-CONFIG.JS
 * --------------------------------------------------------------------------
 * Everything about the shop itself — not products, not orders — lives here:
 * contact details, address, hours, socials, and the "about" story shown on
 * the homepage. Edit the values below; nothing else in the app needs to
 * change. Leave any field blank ("") to hide that piece of UI automatically
 * (e.g. an empty `whatsapp` hides the WhatsApp button).
 * ==========================================================================
 */

export const STORE_INFO = {
  name: "Mummy Aka Shop",
  tagline: "Everyday essentials, kept honest.",

  // Contact
  phone: "08065516220",                         // pulled from businesses/SHOP/business/phone in your Firebase data
  whatsapp: "08065516220",  // digits only incl. country code, e.g. "2348065516220" — leave "" to hide the WhatsApp button
  email: "promiseuchenna700@gmail.com",               // e.g. "hello@mummyakashop.com"

  // Location
  addressLine: "Jikwoyi",                        // pulled from businesses/SHOP/business/address in your Firebase data
  city: "Abuja",
  state: "FCT",
  country: "Nigeria",
  mapUrl: "https://share.google/T4LHZG8jQRVWgx3al",     // full Google Maps share link — leave "" to hide the "Get directions" button

  // Opening hours — add/remove rows as needed
  hours: [
    { days: "Monday – Saturday", time: "8:00 AM – 8:00 PM" },
    { days: "Sunday", time: "12:00 PM – 6:00 PM" },
  ],

  // Socials — leave any value "" to hide that icon in the footer
  social: {
    instagram: "",
    facebook: "https://web.facebook.com/people/Nwanyi-Ovoko-2/61586354764834/",
    tiktok: "",
    x: "",
  },

  // Shown in the homepage "About" section — a couple of sentences about
  // the shop, its story, or what makes it trustworthy.
  about:
    "Your trusted neighbourhood shop in Abuja — provisions, beverages, home goods and more, stocked honestly and delivered fast.",

  // Optional photo of the storefront/owner for the About section.
  // Leave "" to fall back to a placeholder image.
  aboutImage: "https://scontent.fiba2-2.fna.fbcdn.net/v/t39.30808-6/624681348_122109473103211825_1059353456837663580_n.jpg?stp=dst-jpg_tt6&cstp=mx720x722&ctp=s720x722&_nc_cat=101&ccb=1-7&_nc_sid=6ee11a&_nc_ohc=tYg53axba-kQ7kNvwHm1w6Y&_nc_oc=AdokPOV7qrUnKDBzEqI0oAST0XWzCFFnwFSTgE03MpN4Mu0UY597SpMwAbeKXMxUQ6Y&_nc_zt=23&_nc_ht=scontent.fiba2-2.fna&_nc_gid=D9oZzt1s2hvoR5JnZLulIA&_nc_ss=7b289&oh=00_AQC_WQ8zJ5WAGK_AfsTNdjN4FbaRbDBq8In6TSgCXwXksg&oe=6A67B573",

  // Free delivery threshold shown in the top announcement bar — keep this
  // in sync with FREE_DELIVERY_THRESHOLD in js/cart.js if you change it there.
  freeDeliveryThreshold: 30000,
};
