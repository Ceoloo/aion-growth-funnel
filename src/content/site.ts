/** Landing page and global site copy. Edit freely; no logic depends on the strings. */

export const brand = {
  name: "AION Systems",
  wordmark: { primary: "AION", secondary: "SYSTEMS" },
  tagline: "Better marketing. Faster follow-up. More opportunities to grow.",
  description:
    "We help contractors, local businesses, and real estate professionals connect their marketing, content, and sales processes—so every inquiry has a clear next step.",
  chain: ["Attention", "Inquiry", "Follow-up", "Appointment", "Customer"],
} as const;

export const ctaLabels = {
  primary: "Find My Growth Plan",
  secondary: "See What's Included",
  result: "Discuss My Growth Plan",
} as const;

export const hero = {
  eyebrow: "MARKETING • SALES SYSTEMS • PREMIUM CONTENT",
  headline: "Give your next customer a clear path to choosing you.",
  supporting:
    "Connect your content, website, and follow-up into a growth system built around your business.",
  microcopy: "A short assessment. A tailored starting point.",
} as const;

export const audienceSection = {
  eyebrow: "Who this is for",
  heading: "Start with the work you actually do.",
  supporting:
    "Pick the closest match and the assessment opens with that answer already selected.",
} as const;

export const painPoints = {
  eyebrow: "Sound familiar?",
  heading: "Growth usually stalls in the gaps between tools.",
  items: [
    {
      title: "People see your business but don't reach out.",
      body: "Attention lands somewhere that has no obvious next step.",
    },
    {
      title: "Inquiries arrive in too many places.",
      body: "A form, a DM, a missed call and a text thread — none of them talking to each other.",
    },
    {
      title: "Follow-up depends on someone remembering.",
      body: "When the week gets busy, the follow-up is the first thing to go.",
    },
    {
      title: "Your content doesn't show the quality of your work.",
      body: "The finished work is strong. The photos and video don't carry it.",
    },
    {
      title: "You can't clearly connect marketing to opportunities.",
      body: "Activity is visible. Which part produced an inquiry is not.",
    },
  ],
} as const;

export const servicesSection = {
  id: "what-is-included",
  eyebrow: "What's included",
  heading: "Three systems that work together.",
  supporting:
    "Most engagements start with one. They are built so the next one connects without rework.",
} as const;

export const howItWorks = {
  eyebrow: "How it works",
  heading: "Diagnose, build, launch, improve.",
  steps: [
    {
      name: "Diagnose",
      body: "We look at how inquiries arrive today, what tools are already in place and where the handoffs break.",
    },
    {
      name: "Build",
      body: "We build the capture, follow-up and marketing pieces your situation calls for — reusing what already works.",
    },
    {
      name: "Launch",
      body: "We put it live with your team, agree who owns which step and make sure the pipeline is visible.",
    },
    {
      name: "Improve",
      body: "We review what the pipeline shows and adjust the parts that are costing you opportunities.",
    },
  ],
  scopeNote:
    "Scope and pricing follow the assessment and a conversation. We don't publish fixed packages, because the right first build depends on what you already have.",
} as const;

export const finalCta = {
  heading: "Let's find what's slowing your growth.",
  supporting:
    "Answer seven short questions and you'll get a suggested starting point before you share any contact details.",
} as const;

export const metadata = {
  title: "AION Systems — Better marketing. Faster follow-up.",
  titleTemplate: "%s · AION Systems",
  description:
    "AION builds marketing and sales systems for contractors, home services, local businesses and real estate professionals — so every inquiry has a clear next step.",
  ogAlt: "AION Systems — Attention, Inquiry, Follow-up, Appointment, Customer.",
} as const;

export const footer = {
  blurb:
    "AION builds the connection between marketing, content and sales so every inquiry has a clear next step.",
  /**
   * Legal links are intentionally absent. Do not add a privacy policy link
   * until a real policy exists at a real URL — see docs/launch-checklist.md.
   */
} as const;
