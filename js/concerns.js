// js/concerns.js
// Friendly names + ingredient tips for each YouCam skin concern.
// YouCam scores: HIGHER = HEALTHIER skin (1–100) for every concern.
// "focus: true" marks concerns that matter most for deeper skin tones in humid climates.
const CONCERNS = {
  age_spot: {
    label: 'Dark spots', focus: true,
    tip: 'Niacinamide (4–10%), azelaic acid (10–20%), vitamin C, tranexamic acid, alpha arbutin. Daily SPF 30+ is non-negotiable – sun makes dark spots on melanin-rich skin darker.',
    avoid: 'Avoid harsh scrubs and unregulated "bleaching" creams (mercury/hydroquinone abuse) – they can cause rebound darkening.'
  },
  acne: {
    label: 'Acne & post-acne marks', focus: true,
    tip: 'Salicylic acid (BHA 0.5–2%) unclogs pores; benzoyl peroxide 2.5% for active spots; adapalene at night; azelaic acid also fades the marks left behind.',
    avoid: "Don't pick spots – on deeper skin this leaves dark marks (PIH) that last months."
  },
  oiliness: {
    label: 'Oiliness', focus: true,
    tip: 'Niacinamide, zinc PCA, salicylic acid. Use a light gel moisturiser – skipping moisturiser makes skin produce more oil in humid weather.',
    avoid: 'Avoid heavy oils/butters on the face (e.g. thick shea, coconut oil) if you break out easily.'
  },
  pore: {
    label: 'Pores', focus: true,
    tip: 'Salicylic acid, niacinamide, retinoids (start slowly, 2–3 nights a week). Clay mask once a week helps in humid months.',
    avoid: 'Pore strips and harsh scrubs irritate skin without shrinking pores.'
  },
  redness: {
    label: 'Redness / irritation', focus: false,
    tip: 'Centella asiatica, panthenol, ceramides, aloe. Redness can be harder to see on deeper skin, so a drop here may mean irritation.',
    avoid: 'If this score falls after starting a product, it may be irritating you – pause actives.'
  },
  texture: {
    label: 'Texture', focus: false,
    tip: 'Gentle chemical exfoliants (lactic or mandelic acid, 1–2x a week), retinoids at night.',
    avoid: "Don't combine several strong acids and retinoids in one routine."
  },
  moisture: {
    label: 'Hydration', focus: false,
    tip: 'Glycerin, hyaluronic acid, ceramides. Even oily skin can be dehydrated, especially with air-conditioning.',
    avoid: 'Very foamy, stripping cleansers.'
  },
  radiance: {
    label: 'Radiance / glow', focus: false,
    tip: 'Vitamin C in the morning, regular gentle exfoliation, sleep and water.',
    avoid: ''
  },
  dark_circle_v2: {
    label: 'Dark circles', focus: false,
    tip: 'Caffeine eye serums, vitamin C, niacinamide; on deeper skin dark circles are often genetic pigment, so expect slow change.',
    avoid: ''
  },
  eye_bag: { label: 'Eye bags', focus: false, tip: 'Caffeine, peptides, cold compress, enough sleep and less salt at night.', avoid: '' },
  wrinkle: { label: 'Fine lines', focus: false, tip: 'Retinol/retinal at night, peptides, and daily sunscreen.', avoid: '' }
};

// Colour for a score: green good, amber ok, red needs attention.
function scoreColor(n) {
  if (n >= 75) return 'var(--good)';
  if (n >= 55) return 'var(--warn)';
  return 'var(--bad)';
}
