const TIERS = [
  {
    name: "Free",
    price: "$0",
    subtitle: "Current v1 default",
    features: [
      "Live queue board",
      "Assistant chat for operations",
      "Day planner + basic replan"
    ],
    cta: "Current plan",
    highlight: true
  },
  {
    name: "Pro",
    price: "$19/mo",
    subtitle: "Coming soon",
    features: [
      "Advanced optimization windows",
      "Priority proactive signals",
      "Preference memory across sessions"
    ],
    cta: "Notify me",
    highlight: false
  },
  {
    name: "Family",
    price: "$29/mo",
    subtitle: "Coming soon",
    features: [
      "Multi-group itinerary sync",
      "Child-friendly pacing presets",
      "Shared plan updates and alerts"
    ],
    cta: "Notify me",
    highlight: false
  }
];

export function PricingGrid() {
  return (
    <section className="space-y-4">
      <div className="glass-card rounded-3xl p-6 shadow-card">
        <p className="text-xs uppercase tracking-[0.22em] text-soft">Pricing Vision</p>
        <h2 className="mt-2 text-3xl font-semibold">Simple tiers. Powerful assistant.</h2>
        <p className="mt-2 max-w-3xl text-sm text-soft">
          Everything is free in v1 while we prove value and collect feedback. Paid capabilities are shown as product direction.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((tier) => (
          <article
            key={tier.name}
            className={`glass-card rounded-3xl p-5 shadow-card ${
              tier.highlight ? "border-cyan-200/30 shadow-glow" : ""
            }`}
          >
            <p className="text-xs uppercase tracking-[0.22em] text-soft">{tier.subtitle}</p>
            <h3 className="mt-2 text-2xl font-semibold">{tier.name}</h3>
            <p className="mt-1 text-soft">{tier.price}</p>
            <ul className="mt-4 space-y-2 text-sm text-white">
              {tier.features.map((feature) => (
                <li key={feature} className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                  {feature}
                </li>
              ))}
            </ul>
            <button type="button" className={`mt-4 w-full px-4 py-2 text-sm ${tier.highlight ? "button-primary" : "button-ghost"}`}>
              {tier.cta}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
