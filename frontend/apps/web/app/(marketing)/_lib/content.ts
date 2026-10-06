/**
 * Every word and number on the marketing page, in one place.
 *
 * PLACEHOLDER content is marked below. The customer names, testimonial,
 * case-study results and audience numbers come from the approved mockups and
 * are illustrative: replace them with real, permissioned data (written
 * consent for logos and quotes) before the page goes public.
 */

export const CONTACT = {
  salesEmail: "sales@cabinguard.app",
  supportEmail: "support@cabinguard.app",
  demoSubject: "CabinGuard demo request",
} as const;

export const demoHref = `mailto:${CONTACT.salesEmail}?subject=${encodeURIComponent(CONTACT.demoSubject)}`;
export const salesHref = `mailto:${CONTACT.salesEmail}?subject=${encodeURIComponent("Talk to CabinGuard sales")}`;

/* Navigation ----------------------------------------------------------- */

export type NavLink = { label: string; href: string; description: string };
export type NavGroup = { label: string; links?: NavLink[]; href?: string };

export const NAV: NavGroup[] = [
  {
    label: "Product",
    links: [
      { label: "Admin console", href: "#features", description: "Drivers, families and incidents in one place." },
      { label: "Driver app", href: "#app", description: "Answer alerts and call for help from the phone." },
      { label: "In-cabin unit", href: "#detection", description: "The sensor that watches over the driver." },
    ],
  },
  {
    label: "Features",
    links: [
      { label: "Health monitoring", href: "#features", description: "Heart rate, fatigue and wellness, live." },
      { label: "Emergency alerts", href: "#detection", description: "Countdown, escalation and all-clear." },
      { label: "Incident management", href: "#how-it-works", description: "From detection to response." },
    ],
  },
  {
    label: "Safety",
    links: [
      { label: "How it works", href: "#how-it-works", description: "Monitor, detect, respond." },
      { label: "What we detect", href: "#detection", description: "Six signals and their response times." },
      { label: "Privacy & security", href: "#privacy", description: "What stays private, and for how long." },
    ],
  },
  {
    label: "Families",
    links: [
      { label: "Family alerts", href: "#how-it-works", description: "Who is told, and when." },
      { label: "Sharing controls", href: "#privacy", description: "Drivers decide what their family sees." },
    ],
  },
  {
    label: "Resources",
    links: [
      { label: "FAQ", href: "#faq", description: "Answers to common questions." },
      { label: "Contact support", href: `mailto:${CONTACT.supportEmail}`, description: "Write to the team." },
    ],
  },
  { label: "Pricing", href: "#pricing" },
];

/* Hero --------------------------------------------------------------- */

export const HERO = {
  eyebrow: "Safer drivers. Stronger families.",
  title: ["Driver health monitoring", "for a "],
  accent: "safer tomorrow",
  lead: "CabinGuard combines real-time driver health monitoring, family safety, emergency alerts, and incident management in one powerful platform — helping individuals, families, and organizations keep every journey safer.",
  highlights: [
    { icon: "heart", label: ["Monitor", "driver health"] },
    { icon: "users", label: ["Keep families", "informed"] },
    { icon: "siren", label: ["Instant", "emergency alerts"] },
    { icon: "chart", label: ["Manage incidents", "in one console"] },
  ],
} as const;

/** PLACEHOLDER: audience numbers from the mockup. */
export const TRUST_STATS = [
  { icon: "users", value: 10000, suffix: "+", label: "Drivers monitored" },
  { icon: "family", value: 5000, suffix: "+", label: "Families connected" },
  { icon: "shield", value: 99.9, decimals: 1, suffix: "%", label: "Platform uptime" },
  { icon: "globe", value: 50, suffix: "+", label: "Organizations" },
] as const;

/** PLACEHOLDER: customer names from the mockup. Use real, permissioned logos. */
export const CUSTOMERS = [
  "Continental",
  "FedEx",
  "Uber",
  "Lyft",
  "Geotab",
  "DHL",
  "Walmart",
  "Penske",
] as const;

/* Features ------------------------------------------------------------ */

export const FEATURES = [
  {
    icon: "heart",
    tone: "blue",
    title: "Real-time driver health monitoring",
    body: "Track heart rate, fatigue and wellness indicators in real time to detect potential risks early.",
  },
  {
    icon: "family",
    tone: "blue",
    title: "Family notifications",
    body: "Keep loved ones informed with automatic updates about trips, arrivals, and any concerns on the road.",
  },
  {
    icon: "siren",
    tone: "red",
    title: "Emergency alerts",
    body: "Instantly notify families and emergency contacts when abnormal health readings or severe incidents are detected.",
  },
  {
    icon: "file",
    tone: "violet",
    title: "Incident management",
    body: "View, review, and manage health events, driving incidents, and emergency alerts in one secure console.",
  },
  {
    icon: "chart",
    tone: "blue",
    title: "Driver activity analytics",
    body: "Gain insights into driving patterns, health trends, and risk indicators to promote safer habits over time.",
  },
  {
    icon: "shield",
    tone: "blue",
    title: "Secure admin controls",
    body: "Manage drivers, families, permissions, and organization settings with enterprise-grade security and compliance.",
  },
] as const;

/* How it works -------------------------------------------------------- */

export const STEPS = [
  {
    number: 1,
    eyebrow: "Monitor",
    title: ["Track driver health", "and journey signals"],
    body: "CabinGuard continuously monitors driver health, vehicle data, and journey context — from heart rate and alertness to driving behavior, location, and route conditions.",
  },
  {
    number: 2,
    eyebrow: "Detect",
    title: ["Identify anomalies", "or incidents in real time"],
    body: "Our AI analyzes multiple signals to detect signs of fatigue, health issues, unsafe driving, or potential incidents as they happen.",
  },
  {
    number: 3,
    eyebrow: "Respond",
    title: ["Notify families and", "manage response"],
    body: "When an incident is detected, CabinGuard instantly notifies families and trusted contacts, and provides the tools to manage the response through a single platform.",
  },
] as const;

export const ECOSYSTEM = [
  { id: "drivers", icon: "steering", title: "Drivers", body: ["Monitor and", "protect"] },
  { id: "families", icon: "family", title: "Families", body: ["Stay informed", "and reassured"] },
  { id: "incidents", icon: "siren", title: "Incidents", body: ["Detect and", "respond faster"] },
  { id: "health", icon: "heart", title: "Health", body: ["Track trends", "and wellbeing"] },
] as const;

export type EcosystemId = (typeof ECOSYSTEM)[number]["id"];

/* Detection (product facts: severity and response windows) ------------ */

export const DETECTIONS = [
  { icon: "heart", name: "Cardiac arrest", severity: "Critical", response: "Help called after 30 s without an answer" },
  { icon: "brain", name: "Stroke", severity: "Critical", response: "Help called after 30 s without an answer" },
  { icon: "zap", name: "Seizure", severity: "Critical", response: "Help called after 30 s without an answer" },
  { icon: "activity", name: "Heart rhythm", severity: "Urgent", response: "Help called after 60 s without an answer" },
  { icon: "moon", name: "Drowsiness", severity: "Warning", response: "In-app warning only — never escalates" },
  { icon: "hand", name: "SOS button", severity: "Immediate", response: "Hold 2 s, 5 s to cancel, then help is called" },
] as const;

export const ESCALATION = [
  { title: "Detected", body: "The cabin unit reports the event, signed with its own key." },
  { title: "Are you OK?", body: "Phone and cabin button count down together." },
  { title: "Help is called", body: "Emergency contacts in priority order, then family." },
  { title: "All clear", body: "One tap on “I’m OK” tells everyone you are safe." },
] as const;

/* Driver app ---------------------------------------------------------- */

export const APP_POINTS = [
  { icon: "check", title: "“I’m OK” in one tap", body: "Cancel a false alarm before anyone is called — or after, and everyone alerted hears you are safe." },
  { icon: "hand", title: "Press and hold for SOS", body: "Two seconds to call for help, five seconds to change your mind." },
  { icon: "bell", title: "One place for every alert", body: "Safety, family and security news in a notification center you control." },
  { icon: "lock", title: "Private on the lock screen", body: "Previews stay generic unless you choose to show names." },
] as const;

/* Impact -------------------------------------------------------------- */

/** PLACEHOLDER: impact metrics from the mockup. */
export const IMPACT_STATS = [
  { icon: "users", value: 10000, suffix: "+", label: "Drivers monitored", delta: "28%", trend: "up", note: "vs. last year", caption: "More drivers. Safer roads.", chart: "blue" },
  { icon: "family", value: 5000, suffix: "+", label: "Families connected", delta: "42%", trend: "up", note: "vs. last year", caption: "Keeping loved ones informed.", chart: "violet" },
  { icon: "siren", value: 2.3, decimals: 1, suffix: " min", label: "Average incident response time", delta: "65%", trend: "down", note: "faster", caption: "Faster help when it matters.", chart: "red" },
  { icon: "shield", value: 99.9, decimals: 1, suffix: "%", label: "Platform uptime", delta: "0.2%", trend: "up", note: "vs. last year", caption: "Built for always-on reliability.", chart: "blue" },
  { icon: "globe", value: 50, suffix: "+", label: "Organizations using CabinGuard", delta: "67%", trend: "up", note: "vs. last year", caption: "Trusted across industries.", chart: "bars" },
] as const;

/** PLACEHOLDER: testimonial and case study from the mockup. */
export const TESTIMONIAL = {
  quote:
    "CabinGuard has transformed how we care for our drivers. Incidents are detected faster, our teams respond quicker, and families feel more at ease. It’s an essential part of our fleet operations.",
  name: "Mike Taylor",
  role: "Fleet Operations Director, Continental Logistics",
  company: "Continental",
  results: [
    { value: "40%", label: "Fewer incidents" },
    { value: "60%", label: "Faster response" },
    { value: "98%", label: "Driver satisfaction" },
  ],
} as const;

/** PLACEHOLDER: year-over-year results from the mockup. */
export const RESULTS = [
  { value: "-40%", label: "High-risk events", trend: "down" },
  { value: "+35%", label: "Proactive alerts", trend: "up" },
  { value: "+28%", label: "Driver engagement", trend: "up" },
] as const;

/* Privacy (product facts) -------------------------------------------- */

export const PRIVACY = [
  { icon: "eyeOff", title: "Medical details stay with the driver", body: "Families see that someone needs help, and when — never readings, diagnoses or history." },
  { icon: "lock", title: "Quiet lock screens", body: "Notification previews are generic by default. Names appear only if the driver opts in." },
  { icon: "clock", title: "Data with an expiry date", body: "Event readings and locations are deleted after 90 days, incident summaries after a year." },
  { icon: "cpu", title: "Signed cabin units", body: "Each unit signs every report with its own key. Replayed or altered requests are refused." },
  { icon: "key", title: "Two-step sign-in", body: "Authenticator codes, recovery codes and a list of signed-in devices you can revoke." },
  { icon: "scroll", title: "A complete audit trail", body: "Every administrative change is recorded with who did it and when." },
] as const;

/* Plans --------------------------------------------------------------- */

export const PLANS = [
  {
    name: "Family",
    audience: "For households who want peace of mind on every trip.",
    features: ["Driver app with SOS and “I’m OK”", "Up to 10 family members", "Emergency contacts by priority", "Family incident alerts"],
    cta: "Talk to us",
    featured: false,
  },
  {
    name: "Fleet",
    audience: "For operators running drivers on the road every day.",
    features: ["Everything in Family", "Admin console and analytics", "In-cabin unit management", "Incident management and audit log"],
    cta: "Request a demo",
    featured: true,
  },
  {
    name: "Enterprise",
    audience: "For organizations with custom integrations and controls.",
    features: ["Everything in Fleet", "Custom integrations", "Dedicated onboarding", "Security review support"],
    cta: "Talk to sales",
    featured: false,
  },
] as const;

/* FAQ ----------------------------------------------------------------- */

export const FAQ = [
  {
    icon: "settings",
    question: "How easy is it to set up CabinGuard?",
    answer:
      "Setup takes just a few minutes. Install the CabinGuard device in your vehicle, pair it with the mobile app or web dashboard, and you’re ready to go. Our guided onboarding walks you through each step, and our team is always available to help.",
  },
  {
    icon: "heart",
    question: "What types of driver health alerts does CabinGuard detect?",
    answer:
      "The in-cabin unit reports possible cardiac arrest, stroke, seizure, irregular heart rhythm and drowsiness, and the driver can raise an SOS at any time. Critical events give the driver 30 seconds to answer, heart rhythm alerts 60 seconds, and drowsiness is a warning that never calls anyone.",
  },
  {
    icon: "users",
    question: "How do family notifications work?",
    answer:
      "When a driver who shares alerts with their family needs help, every family member is told in the app and by email. They see who needs help and when, never the medical details. When the driver says they are OK, everyone who was alerted receives an all-clear.",
  },
  {
    icon: "shield",
    question: "How is my data kept private and secure?",
    answer:
      "Readings and locations are kept for 90 days and incident summaries for one year. Families and administrators never see medical details, lock-screen previews stay generic by default, and every cabin unit signs its reports with its own key.",
  },
  {
    icon: "link",
    question: "What integrations does CabinGuard support?",
    answer:
      "CabinGuard connects in-cabin units through a signed device API and reaches people through the app and email. Fleet and enterprise customers can discuss further integrations with our team.",
  },
  {
    icon: "siren",
    question: "What happens during an emergency?",
    answer:
      "The phone and the cabin unit ask the driver “Are you OK?”. Without an answer, CabinGuard alerts emergency contacts in priority order and notifies the family, sharing the location while help is being called. One tap on “I’m OK” ends the alert for everyone.",
  },
] as const;

/* Footer -------------------------------------------------------------- */

export const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Admin console", href: "#features" },
      { label: "Driver app", href: "#app" },
      { label: "In-cabin unit", href: "#detection" },
      { label: "Pricing", href: "#pricing" },
      { label: "Console sign in", href: "/sign-in" },
    ],
  },
  {
    title: "Safety",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "What we detect", href: "#detection" },
      { label: "Emergency response", href: "#detection" },
      { label: "Family alerts", href: "#how-it-works" },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "Privacy & security", href: "#privacy" },
      { label: "Data retention", href: "#privacy" },
      { label: "Customer stories", href: "#impact" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Contact support", href: `mailto:${CONTACT.supportEmail}` },
      { label: "Talk to sales", href: salesHref },
      { label: "Request a demo", href: demoHref },
    ],
  },
] as const;
