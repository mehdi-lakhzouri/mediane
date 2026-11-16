import type { Messages } from "../../../lib/i18n/messages";

/**
 * Every word and number on the marketing page, in one place, in every
 * language. Read it with useContent() in client components and
 * getMessages(marketingContent) in server components.
 *
 * PLACEHOLDER content is marked below. The customer names, testimonial,
 * case-study results and audience numbers come from the approved mockups and
 * are illustrative: replace them with real, permissioned data (written
 * consent for logos and quotes) before the page goes public.
 */

export const CONTACT = {
  salesEmail: "sales@cabinguard.app",
  supportEmail: "support@cabinguard.app",
} as const;

const salesMail = (subject: string) =>
  `mailto:${CONTACT.salesEmail}?subject=${encodeURIComponent(subject)}`;

const supportMail = `mailto:${CONTACT.supportEmail}`;

export type NavLink = {
  readonly label: string;
  readonly href: string;
  readonly description: string;
};
export type NavGroup = {
  readonly label: string;
  readonly links?: readonly NavLink[];
  readonly href?: string;
};

const en = {
  demoHref: salesMail("Mediane demo request"),
  salesHref: salesMail("Talk to Mediane sales"),

  /* Navigation --------------------------------------------------------- */

  NAV: [
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
        { label: "Contact support", href: supportMail, description: "Write to the team." },
      ],
    },
    { label: "Pricing", href: "#pricing" },
  ],

  /* Hero ----------------------------------------------------------------- */

  HERO: {
    eyebrow: "Safer drivers. Stronger families.",
    title: ["Driver health monitoring", "for a "],
    accent: "safer tomorrow",
    lead: "Mediane combines real-time driver health monitoring, family safety, emergency alerts, and incident management in one powerful platform — helping individuals, families, and organizations keep every journey safer.",
    highlights: [
      { icon: "heart", label: ["Monitor", "driver health"] },
      { icon: "users", label: ["Keep families", "informed"] },
      { icon: "siren", label: ["Instant", "emergency alerts"] },
      { icon: "chart", label: ["Manage incidents", "in one console"] },
    ],
  },

  /** PLACEHOLDER: audience numbers from the mockup. */
  TRUST_STATS: [
    { icon: "users", value: 10000, suffix: "+", label: "Drivers monitored" },
    { icon: "family", value: 5000, suffix: "+", label: "Families connected" },
    { icon: "shield", value: 99.9, decimals: 1, suffix: "%", label: "Platform uptime" },
    { icon: "globe", value: 50, suffix: "+", label: "Organizations" },
  ],

  /** PLACEHOLDER: customer names from the mockup. Use real, permissioned logos. */
  CUSTOMERS: ["Continental", "FedEx", "Uber", "Lyft", "Geotab", "DHL", "Walmart", "Penske"],

  /* Features ------------------------------------------------------------- */

  FEATURES: [
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
  ],

  /* How it works --------------------------------------------------------- */

  STEPS: [
    {
      number: 1,
      eyebrow: "Monitor",
      title: ["Track driver health", "and journey signals"],
      body: "Mediane continuously monitors driver health, vehicle data, and journey context — from heart rate and alertness to driving behavior, location, and route conditions.",
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
      body: "When an incident is detected, Mediane instantly notifies families and trusted contacts, and provides the tools to manage the response through a single platform.",
    },
  ],

  ECOSYSTEM: [
    { id: "drivers", icon: "steering", title: "Drivers", body: ["Monitor and", "protect"] },
    { id: "families", icon: "family", title: "Families", body: ["Stay informed", "and reassured"] },
    { id: "incidents", icon: "siren", title: "Incidents", body: ["Detect and", "respond faster"] },
    { id: "health", icon: "heart", title: "Health", body: ["Track trends", "and wellbeing"] },
  ],

  /* Detection (product facts: severity and response windows) ------------ */

  DETECTIONS: [
    { icon: "heart", name: "Cardiac arrest", level: "Critical", severity: "Critical", response: "Help called after 30 s without an answer" },
    { icon: "brain", name: "Stroke", level: "Critical", severity: "Critical", response: "Help called after 30 s without an answer" },
    { icon: "zap", name: "Seizure", level: "Critical", severity: "Critical", response: "Help called after 30 s without an answer" },
    { icon: "activity", name: "Heart rhythm", level: "Urgent", severity: "Urgent", response: "Help called after 60 s without an answer" },
    { icon: "moon", name: "Drowsiness", level: "Warning", severity: "Warning", response: "In-app warning only — never escalates" },
    { icon: "hand", name: "SOS button", level: "Immediate", severity: "Immediate", response: "Hold 2 s, 5 s to cancel, then help is called" },
  ],

  ESCALATION: [
    { title: "Detected", body: "The cabin unit reports the event, signed with its own key." },
    { title: "Are you OK?", body: "Phone and cabin button count down together." },
    { title: "Help is called", body: "Emergency contacts in priority order, then family." },
    { title: "All clear", body: "One tap on “I’m OK” tells everyone you are safe." },
  ],

  /* Driver app ----------------------------------------------------------- */

  APP_POINTS: [
    { icon: "check", title: "“I’m OK” in one tap", body: "Cancel a false alarm before anyone is called — or after, and everyone alerted hears you are safe." },
    { icon: "hand", title: "Press and hold for SOS", body: "Two seconds to call for help, five seconds to change your mind." },
    { icon: "bell", title: "One place for every alert", body: "Safety, family and security news in a notification center you control." },
    { icon: "lock", title: "Private on the lock screen", body: "Previews stay generic unless you choose to show names." },
  ],

  /* Impact --------------------------------------------------------------- */

  /** PLACEHOLDER: impact metrics from the mockup. */
  IMPACT_STATS: [
    { icon: "users", value: 10000, suffix: "+", label: "Drivers monitored", delta: "28%", trend: "up", note: "vs. last year", caption: "More drivers. Safer roads.", chart: "blue" },
    { icon: "family", value: 5000, suffix: "+", label: "Families connected", delta: "42%", trend: "up", note: "vs. last year", caption: "Keeping loved ones informed.", chart: "violet" },
    { icon: "siren", value: 2.3, decimals: 1, suffix: " min", label: "Average incident response time", delta: "65%", trend: "down", note: "faster", caption: "Faster help when it matters.", chart: "red" },
    { icon: "shield", value: 99.9, decimals: 1, suffix: "%", label: "Platform uptime", delta: "0.2%", trend: "up", note: "vs. last year", caption: "Built for always-on reliability.", chart: "blue" },
    { icon: "globe", value: 50, suffix: "+", label: "Organizations using Mediane", delta: "67%", trend: "up", note: "vs. last year", caption: "Trusted across industries.", chart: "bars" },
  ],

  /** PLACEHOLDER: testimonial and case study from the mockup. */
  TESTIMONIAL: {
    quote:
      "Mediane has transformed how we care for our drivers. Incidents are detected faster, our teams respond quicker, and families feel more at ease. It’s an essential part of our fleet operations.",
    name: "Mike Taylor",
    role: "Fleet Operations Director, Continental Logistics",
    company: "Continental",
    results: [
      { value: "40%", label: "Fewer incidents" },
      { value: "60%", label: "Faster response" },
      { value: "98%", label: "Driver satisfaction" },
    ],
  },

  /** PLACEHOLDER: year-over-year results from the mockup. */
  RESULTS: [
    { value: "-40%", label: "High-risk events", trend: "down" },
    { value: "+35%", label: "Proactive alerts", trend: "up" },
    { value: "+28%", label: "Driver engagement", trend: "up" },
  ],

  /* Privacy (product facts) ---------------------------------------------- */

  PRIVACY: [
    { icon: "eyeOff", title: "Medical details stay with the driver", body: "Families see that someone needs help, and when — never readings, diagnoses or history." },
    { icon: "lock", title: "Quiet lock screens", body: "Notification previews are generic by default. Names appear only if the driver opts in." },
    { icon: "clock", title: "Data with an expiry date", body: "Event readings and locations are deleted after 90 days, incident summaries after a year." },
    { icon: "cpu", title: "Signed cabin units", body: "Each unit signs every report with its own key. Replayed or altered requests are refused." },
    { icon: "key", title: "Two-step sign-in", body: "Authenticator codes, recovery codes and a list of signed-in devices you can revoke." },
    { icon: "scroll", title: "A complete audit trail", body: "Every administrative change is recorded with who did it and when." },
  ],

  /* Plans ---------------------------------------------------------------- */

  PLANS: [
    {
      name: "Family",
      audience: "For households who want peace of mind on every trip.",
      features: ["Driver app with SOS and “I’m OK”", "Up to 10 family members", "Emergency contacts by priority", "Family incident alerts"],
      action: "sales",
      cta: "Talk to us",
      featured: false,
    },
    {
      name: "Fleet",
      audience: "For operators running drivers on the road every day.",
      features: ["Everything in Family", "Admin console and analytics", "In-cabin unit management", "Incident management and audit log"],
      action: "demo",
      cta: "Request a demo",
      featured: true,
    },
    {
      name: "Enterprise",
      audience: "For organizations with custom integrations and controls.",
      features: ["Everything in Fleet", "Custom integrations", "Dedicated onboarding", "Security review support"],
      action: "sales",
      cta: "Talk to sales",
      featured: false,
    },
  ],

  /* FAQ ------------------------------------------------------------------ */

  FAQ: [
    {
      icon: "settings",
      question: "How easy is it to set up Mediane?",
      answer:
        "Setup takes just a few minutes. Install the Mediane device in your vehicle, pair it with the mobile app or web dashboard, and you’re ready to go. Our guided onboarding walks you through each step, and our team is always available to help.",
    },
    {
      icon: "heart",
      question: "What types of driver health alerts does Mediane detect?",
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
      question: "What integrations does Mediane support?",
      answer:
        "Mediane connects in-cabin units through a signed device API and reaches people through the app and email. Fleet and enterprise customers can discuss further integrations with our team.",
    },
    {
      icon: "siren",
      question: "What happens during an emergency?",
      answer:
        "The phone and the cabin unit ask the driver “Are you OK?”. Without an answer, Mediane alerts emergency contacts in priority order and notifies the family, sharing the location while help is being called. One tap on “I’m OK” ends the alert for everyone.",
    },
  ],

  /* Footer --------------------------------------------------------------- */

  FOOTER_COLUMNS: [
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
        { label: "Contact support", href: supportMail },
        { label: "Talk to sales", href: salesMail("Talk to Mediane sales") },
        { label: "Request a demo", href: salesMail("Mediane demo request") },
      ],
    },
  ],
} as const;

/** Keys that pick an icon, a colour or a tab: identical in every language. */
type Fixed = "icon" | "tone" | "trend" | "chart" | "id" | "level" | "action";

/** The English tree with its text widened, so another language can fill it. */
type Copy<T> = T extends string
  ? string
  : T extends object
    ? { readonly [K in keyof T]: K extends Fixed ? T[K] : Copy<T[K]> }
    : T;

export type MarketingContent = Omit<Copy<typeof en>, "NAV"> & {
  readonly NAV: readonly NavGroup[];
};

const fr: MarketingContent = {
  demoHref: salesMail("Demande de démo Mediane"),
  salesHref: salesMail("Contact commercial Mediane"),

  NAV: [
    {
      label: "Produit",
      links: [
        { label: "Console d’administration", href: "#features", description: "Conducteurs, familles et incidents au même endroit." },
        { label: "Application conducteur", href: "#app", description: "Répondre aux alertes et appeler à l’aide depuis le téléphone." },
        { label: "Boîtier embarqué", href: "#detection", description: "Le capteur qui veille sur le conducteur." },
      ],
    },
    {
      label: "Fonctions",
      links: [
        { label: "Suivi de santé", href: "#features", description: "Rythme cardiaque, fatigue et bien-être, en direct." },
        { label: "Alertes d’urgence", href: "#detection", description: "Compte à rebours, escalade et fin d’alerte." },
        { label: "Gestion des incidents", href: "#how-it-works", description: "De la détection à l’intervention." },
      ],
    },
    {
      label: "Sécurité",
      links: [
        { label: "Fonctionnement", href: "#how-it-works", description: "Surveiller, détecter, intervenir." },
        { label: "Ce que nous détectons", href: "#detection", description: "Six signaux et leurs délais de réponse." },
        { label: "Confidentialité et sécurité", href: "#privacy", description: "Ce qui reste privé, et pour combien de temps." },
      ],
    },
    {
      label: "Familles",
      links: [
        { label: "Alertes familiales", href: "#how-it-works", description: "Qui est prévenu, et quand." },
        { label: "Contrôle du partage", href: "#privacy", description: "Le conducteur décide de ce que voit sa famille." },
      ],
    },
    {
      label: "Ressources",
      links: [
        { label: "FAQ", href: "#faq", description: "Réponses aux questions fréquentes." },
        { label: "Contacter le support", href: supportMail, description: "Écrire à l’équipe." },
      ],
    },
    { label: "Tarifs", href: "#pricing" },
  ],

  HERO: {
    eyebrow: "Des conducteurs protégés. Des familles rassurées.",
    title: ["La santé au volant,", "pour un "],
    accent: "avenir plus sûr",
    lead: "Mediane réunit la surveillance en temps réel de la santé des conducteurs, la sécurité des familles, les alertes d’urgence et la gestion des incidents dans une seule plateforme — pour aider particuliers, familles et organisations à sécuriser chaque trajet.",
    highlights: [
      { icon: "heart", label: ["Surveiller", "la santé du conducteur"] },
      { icon: "users", label: ["Tenir les familles", "informées"] },
      { icon: "siren", label: ["Alertes d’urgence", "instantanées"] },
      { icon: "chart", label: ["Gérer les incidents", "dans une console"] },
    ],
  },

  TRUST_STATS: [
    { icon: "users", value: 10000, suffix: "+", label: "Conducteurs suivis" },
    { icon: "family", value: 5000, suffix: "+", label: "Familles connectées" },
    { icon: "shield", value: 99.9, decimals: 1, suffix: " %", label: "Disponibilité de la plateforme" },
    { icon: "globe", value: 50, suffix: "+", label: "Organisations" },
  ],

  CUSTOMERS: ["Continental", "FedEx", "Uber", "Lyft", "Geotab", "DHL", "Walmart", "Penske"],

  FEATURES: [
    {
      icon: "heart",
      tone: "blue",
      title: "Suivi de santé en temps réel",
      body: "Suivez en temps réel le rythme cardiaque, la fatigue et les indicateurs de bien-être pour détecter les risques au plus tôt.",
    },
    {
      icon: "family",
      tone: "blue",
      title: "Notifications familiales",
      body: "Tenez vos proches informés grâce à des mises à jour automatiques sur les trajets, les arrivées et tout souci sur la route.",
    },
    {
      icon: "siren",
      tone: "red",
      title: "Alertes d’urgence",
      body: "Prévenez instantanément la famille et les contacts d’urgence en cas de mesures anormales ou d’incident grave.",
    },
    {
      icon: "file",
      tone: "violet",
      title: "Gestion des incidents",
      body: "Consultez, analysez et gérez les événements de santé, incidents de conduite et alertes d’urgence dans une console sécurisée.",
    },
    {
      icon: "chart",
      tone: "blue",
      title: "Analyse de l’activité des conducteurs",
      body: "Comprenez les habitudes de conduite, les tendances de santé et les indicateurs de risque pour encourager une conduite plus sûre.",
    },
    {
      icon: "shield",
      tone: "blue",
      title: "Administration sécurisée",
      body: "Gérez conducteurs, familles, autorisations et paramètres de l’organisation avec une sécurité et une conformité de niveau entreprise.",
    },
  ],

  STEPS: [
    {
      number: 1,
      eyebrow: "Surveiller",
      title: ["Suivre la santé du conducteur", "et les signaux du trajet"],
      body: "Mediane surveille en continu la santé du conducteur, les données du véhicule et le contexte du trajet — du rythme cardiaque et de la vigilance au comportement de conduite, à la position et aux conditions de route.",
    },
    {
      number: 2,
      eyebrow: "Détecter",
      title: ["Repérer les anomalies", "et incidents en temps réel"],
      body: "Notre IA analyse plusieurs signaux pour détecter, au moment où ils surviennent, les signes de fatigue, les problèmes de santé, la conduite dangereuse ou les incidents potentiels.",
    },
    {
      number: 3,
      eyebrow: "Intervenir",
      title: ["Prévenir les familles", "et gérer l’intervention"],
      body: "Dès qu’un incident est détecté, Mediane prévient instantanément la famille et les contacts de confiance, et fournit les outils pour gérer l’intervention depuis une seule plateforme.",
    },
  ],

  ECOSYSTEM: [
    { id: "drivers", icon: "steering", title: "Conducteurs", body: ["Surveiller et", "protéger"] },
    { id: "families", icon: "family", title: "Familles", body: ["Rester informé", "et rassuré"] },
    { id: "incidents", icon: "siren", title: "Incidents", body: ["Détecter et", "réagir plus vite"] },
    { id: "health", icon: "heart", title: "Santé", body: ["Suivre les tendances", "et le bien-être"] },
  ],

  DETECTIONS: [
    { icon: "heart", name: "Arrêt cardiaque", level: "Critical", severity: "Critique", response: "Secours appelés après 30 s sans réponse" },
    { icon: "brain", name: "AVC", level: "Critical", severity: "Critique", response: "Secours appelés après 30 s sans réponse" },
    { icon: "zap", name: "Crise d’épilepsie", level: "Critical", severity: "Critique", response: "Secours appelés après 30 s sans réponse" },
    { icon: "activity", name: "Rythme cardiaque", level: "Urgent", severity: "Urgent", response: "Secours appelés après 60 s sans réponse" },
    { icon: "moon", name: "Somnolence", level: "Warning", severity: "Avertissement", response: "Avertissement dans l’app uniquement — jamais d’escalade" },
    { icon: "hand", name: "Bouton SOS", level: "Immediate", severity: "Immédiat", response: "Maintenir 2 s, 5 s pour annuler, puis les secours sont appelés" },
  ],

  ESCALATION: [
    { title: "Détecté", body: "Le boîtier signale l’événement, signé avec sa propre clé." },
    { title: "Tout va bien ?", body: "Le téléphone et le bouton de l’habitacle lancent le même compte à rebours." },
    { title: "Secours appelés", body: "Les contacts d’urgence par ordre de priorité, puis la famille." },
    { title: "Fin d’alerte", body: "Un appui sur « Je vais bien » rassure tout le monde." },
  ],

  APP_POINTS: [
    { icon: "check", title: "« Je vais bien » en un appui", body: "Annulez une fausse alerte avant que quiconque soit appelé — ou après, et toutes les personnes prévenues apprennent que vous êtes en sécurité." },
    { icon: "hand", title: "Maintenez pour le SOS", body: "Deux secondes pour appeler à l’aide, cinq secondes pour changer d’avis." },
    { icon: "bell", title: "Toutes les alertes au même endroit", body: "Sécurité, famille et compte dans un centre de notifications que vous contrôlez." },
    { icon: "lock", title: "Discret sur l’écran verrouillé", body: "Les aperçus restent neutres, sauf si vous choisissez d’afficher les noms." },
  ],

  IMPACT_STATS: [
    { icon: "users", value: 10000, suffix: "+", label: "Conducteurs suivis", delta: "28 %", trend: "up", note: "par rapport à l’an dernier", caption: "Plus de conducteurs. Des routes plus sûres.", chart: "blue" },
    { icon: "family", value: 5000, suffix: "+", label: "Familles connectées", delta: "42 %", trend: "up", note: "par rapport à l’an dernier", caption: "Des proches toujours informés.", chart: "violet" },
    { icon: "siren", value: 2.3, decimals: 1, suffix: " min", label: "Délai moyen de réponse aux incidents", delta: "65 %", trend: "down", note: "plus rapide", caption: "Une aide plus rapide quand ça compte.", chart: "red" },
    { icon: "shield", value: 99.9, decimals: 1, suffix: " %", label: "Disponibilité de la plateforme", delta: "0,2 %", trend: "up", note: "par rapport à l’an dernier", caption: "Conçue pour une fiabilité sans interruption.", chart: "blue" },
    { icon: "globe", value: 50, suffix: "+", label: "Organisations utilisant Mediane", delta: "67 %", trend: "up", note: "par rapport à l’an dernier", caption: "Adoptée dans de nombreux secteurs.", chart: "bars" },
  ],

  TESTIMONIAL: {
    quote:
      "Mediane a transformé notre façon de prendre soin de nos conducteurs. Les incidents sont détectés plus tôt, nos équipes réagissent plus vite et les familles sont plus sereines. C’est devenu un élément essentiel de la gestion de notre flotte.",
    name: "Mike Taylor",
    role: "Directeur des opérations de flotte, Continental Logistics",
    company: "Continental",
    results: [
      { value: "40 %", label: "D’incidents en moins" },
      { value: "60 %", label: "De réactivité en plus" },
      { value: "98 %", label: "De conducteurs satisfaits" },
    ],
  },

  RESULTS: [
    { value: "-40 %", label: "Événements à haut risque", trend: "down" },
    { value: "+35 %", label: "Alertes proactives", trend: "up" },
    { value: "+28 %", label: "Engagement des conducteurs", trend: "up" },
  ],

  PRIVACY: [
    { icon: "eyeOff", title: "Les données médicales restent au conducteur", body: "La famille voit que quelqu’un a besoin d’aide, et quand — jamais les mesures, les diagnostics ni l’historique." },
    { icon: "lock", title: "Écrans verrouillés discrets", body: "Les aperçus de notification sont neutres par défaut. Les noms n’apparaissent que si le conducteur l’accepte." },
    { icon: "clock", title: "Des données à durée limitée", body: "Les mesures et positions sont supprimées après 90 jours, les résumés d’incident après un an." },
    { icon: "cpu", title: "Boîtiers signés", body: "Chaque boîtier signe chaque rapport avec sa propre clé. Les requêtes rejouées ou modifiées sont refusées." },
    { icon: "key", title: "Connexion en deux étapes", body: "Codes d’authentification, codes de récupération et liste des appareils connectés que vous pouvez révoquer." },
    { icon: "scroll", title: "Une traçabilité complète", body: "Chaque modification administrative est enregistrée, avec son auteur et sa date." },
  ],

  PLANS: [
    {
      name: "Famille",
      audience: "Pour les foyers qui veulent l’esprit tranquille à chaque trajet.",
      features: ["Application conducteur avec SOS et « Je vais bien »", "Jusqu’à 10 membres de la famille", "Contacts d’urgence par priorité", "Alertes d’incident pour la famille"],
      action: "sales",
      cta: "Nous contacter",
      featured: false,
    },
    {
      name: "Flotte",
      audience: "Pour les opérateurs dont les conducteurs sont sur la route chaque jour.",
      features: ["Tout le forfait Famille", "Console d’administration et analyses", "Gestion des boîtiers embarqués", "Gestion des incidents et journal d’audit"],
      action: "demo",
      cta: "Demander une démo",
      featured: true,
    },
    {
      name: "Entreprise",
      audience: "Pour les organisations qui ont besoin d’intégrations et de contrôles sur mesure.",
      features: ["Tout le forfait Flotte", "Intégrations sur mesure", "Accompagnement dédié", "Aide aux audits de sécurité"],
      action: "sales",
      cta: "Contacter les ventes",
      featured: false,
    },
  ],

  FAQ: [
    {
      icon: "settings",
      question: "Mediane est-il simple à installer ?",
      answer:
        "L’installation ne prend que quelques minutes. Installez le boîtier Mediane dans votre véhicule, associez-le à l’application mobile ou au tableau de bord web, et c’est parti. Notre accompagnement guidé vous aide à chaque étape, et notre équipe reste disponible.",
    },
    {
      icon: "heart",
      question: "Quelles alertes de santé Mediane détecte-t-il ?",
      answer:
        "Le boîtier embarqué signale les arrêts cardiaques, AVC, crises d’épilepsie, troubles du rythme cardiaque et la somnolence possibles, et le conducteur peut déclencher un SOS à tout moment. Les événements critiques laissent 30 secondes au conducteur pour répondre, les troubles du rythme 60 secondes, et la somnolence est un simple avertissement qui n’appelle personne.",
    },
    {
      icon: "users",
      question: "Comment fonctionnent les notifications familiales ?",
      answer:
        "Lorsqu’un conducteur qui partage ses alertes avec sa famille a besoin d’aide, chaque membre est prévenu dans l’application et par e-mail. Ils voient qui a besoin d’aide et depuis quand, jamais les détails médicaux. Quand le conducteur indique qu’il va bien, toutes les personnes prévenues reçoivent une fin d’alerte.",
    },
    {
      icon: "shield",
      question: "Comment mes données restent-elles privées et sécurisées ?",
      answer:
        "Les mesures et positions sont conservées 90 jours et les résumés d’incident un an. Les familles et les administrateurs ne voient jamais les détails médicaux, les aperçus sur l’écran verrouillé restent neutres par défaut, et chaque boîtier signe ses rapports avec sa propre clé.",
    },
    {
      icon: "link",
      question: "Quelles intégrations Mediane propose-t-il ?",
      answer:
        "Mediane relie les boîtiers embarqués via une API d’appareil signée et joint les personnes par l’application et par e-mail. Les clients Flotte et Entreprise peuvent étudier d’autres intégrations avec notre équipe.",
    },
    {
      icon: "siren",
      question: "Que se passe-t-il en cas d’urgence ?",
      answer:
        "Le téléphone et le boîtier demandent au conducteur « Tout va bien ? ». Sans réponse, Mediane alerte les contacts d’urgence par ordre de priorité et prévient la famille, en partageant la position pendant l’appel des secours. Un appui sur « Je vais bien » met fin à l’alerte pour tout le monde.",
    },
  ],

  FOOTER_COLUMNS: [
    {
      title: "Produit",
      links: [
        { label: "Console d’administration", href: "#features" },
        { label: "Application conducteur", href: "#app" },
        { label: "Boîtier embarqué", href: "#detection" },
        { label: "Tarifs", href: "#pricing" },
        { label: "Connexion à la console", href: "/sign-in" },
      ],
    },
    {
      title: "Sécurité",
      links: [
        { label: "Fonctionnement", href: "#how-it-works" },
        { label: "Ce que nous détectons", href: "#detection" },
        { label: "Intervention d’urgence", href: "#detection" },
        { label: "Alertes familiales", href: "#how-it-works" },
      ],
    },
    {
      title: "Confiance",
      links: [
        { label: "Confidentialité et sécurité", href: "#privacy" },
        { label: "Conservation des données", href: "#privacy" },
        { label: "Témoignages clients", href: "#impact" },
      ],
    },
    {
      title: "Support",
      links: [
        { label: "FAQ", href: "#faq" },
        { label: "Contacter le support", href: supportMail },
        { label: "Contacter les ventes", href: salesMail("Contact commercial Mediane") },
        { label: "Demander une démo", href: salesMail("Demande de démo Mediane") },
      ],
    },
  ],
};

export const marketingContent: Messages<MarketingContent> = { en, fr };

export type EcosystemId = MarketingContent["ECOSYSTEM"][number]["id"];
