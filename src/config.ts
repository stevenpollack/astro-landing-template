/*
 * Acme Co — site content & business details.
 * Single place to edit copy and contact info. Everything here is PLACEHOLDER
 * content — replace it with your own business details before launch.
 */

export const site = {
  name: "Acme Co",
  tagline: "Your one-line value proposition goes here",
  domain: "acme.example",
  url: "https://acme.example",
  description:
    "A short, friendly description of what your business does and who it serves. Owner-operated by Your Name — get in touch for a free quote today.",
} as const;

export const contact = {
  // PLACEHOLDER — replace with your real details before launch.
  email: "hello@acme.example",
  phone: "01 2345 6789",
  phoneHref: "tel:+10000000000",
  serviceArea: "Your city & surrounds",
  abn: "00 000 000 000",
} as const;

export const nav = [
  { label: "Services", href: "#services" },
  { label: "About", href: "#about" },
  { label: "Why us", href: "#why" },
  { label: "Contact", href: "#contact" },
] as const;

export const services = [
  {
    icon: "🛠️",
    title: "Your first service",
    blurb: "Lorem ipsum dolor sit amet, a one-sentence summary of what this service includes.",
    points: ["Key feature one", "Key feature two", "Key feature three"],
  },
  {
    icon: "✨",
    title: "Your second service",
    blurb: "Consectetur adipiscing elit, describe the value and outcome a customer gets here.",
    points: ["Key feature one", "Key feature two", "Key feature three"],
  },
  {
    icon: "📦",
    title: "Your third service",
    blurb: "Sed do eiusmod tempor, a thorough description of your premium or specialist offering.",
    points: ["Key feature one", "Key feature two", "Key feature three"],
  },
] as const;

export const whyUs = [
  {
    icon: "👋",
    title: "Reason number one",
    blurb: "Lorem ipsum dolor sit amet — a benefit-led reason customers should choose you.",
  },
  {
    icon: "🌿",
    title: "Reason number two",
    blurb: "Consectetur adipiscing elit, another differentiator that sets you apart.",
  },
  {
    icon: "📅",
    title: "Reason number three",
    blurb: "Sed do eiusmod tempor incididunt, a reason that builds trust and convenience.",
  },
  {
    icon: "💚",
    title: "Reason number four",
    blurb: "Ut labore et dolore magna — your guarantee or promise to the customer.",
  },
] as const;

/** Options shown in the contact form's "what do you need?" select. */
export const serviceOptions = [
  "Your first service",
  "Your second service",
  "Your third service",
  "Not sure — help me choose",
] as const;
