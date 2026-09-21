export interface FaqItem {
  question: string;
  answer: string;
}

export const faqSection = {
  eyebrow: "Questions",
  heading: "Before you start.",
} as const;

export const faqItems: FaqItem[] = [
  {
    question: "Can I keep my current CRM or website?",
    answer:
      "We assess what can be connected before recommending replacement. If what you have works, we build around it.",
  },
  {
    question: "Do I need photography or video?",
    answer:
      "No. We can work with suitable existing assets. Production is an optional add-on, not a requirement.",
  },
  {
    question: "Do you work with real estate agents?",
    answer:
      "Yes, including buyer/seller inquiry handling and agent marketing.",
  },
  {
    question: "Do you run paid ads?",
    answer:
      "Paid campaigns can be scoped separately. Media spend is separate from our fees.",
  },
  {
    question: "Do you guarantee sales?",
    answer:
      "No. Results depend on demand, offer, budget, response, and sales execution.",
  },
  {
    question: "What happens after the assessment?",
    answer:
      "You receive a suggested starting point and can request a strategy call. Nothing is scoped or priced until we've talked.",
  },
];
