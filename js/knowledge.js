// js/knowledge.js
// Small local knowledge base used to EXPLAIN verdicts and suggest alternatives.
// General cosmetic-ingredient info only – not medical advice. Example products are well-known,
// widely available ones (no prices, no affiliate links). Concern keys match js/concerns.js.

// 1) What a product the user typed is generally good for (matched by keywords in its name).
const ACTIVES = [
  { id: 'niacinamide', re: /niacinamide|vitamin\s*b3|\bb3\b/i, name: 'Niacinamide (vitamin B3)', goodFor: ['oiliness', 'pore', 'age_spot', 'redness', 'acne'],
    blurb: 'balances oil, tightens the look of pores, calms redness and slowly fades dark marks',
    watch: 'Oiliness and pores usually move first (2–4 weeks), dark spots later (6–12 weeks). Above 10% it can sting some people.' },
  { id: 'zinc', re: /\bzinc\b|zinc pca/i, name: 'Zinc', goodFor: ['oiliness', 'acne', 'redness'],
    blurb: 'helps control shine and calms spots',
    watch: 'Watch oiliness and acne; zinc can feel slightly drying.' },
  { id: 'vitc', re: /vitamin\s*c|ascorb|\bvit\.?\s*c\b|ethyl ascorbic/i, name: 'Vitamin C', goodFor: ['age_spot', 'radiance', 'dark_circle_v2', 'wrinkle'],
    blurb: 'brightens dull skin, fades dark spots and protects against sun-related damage',
    watch: 'Expect brightness first, then dark spots at 8–12 weeks. Strong formulas can tingle; keep it in a dark bottle.' },
  { id: 'retinoid', re: /retin|adapalene|differin|tretinoin|bakuchiol/i, name: 'Retinoid (retinol / adapalene)', goodFor: ['texture', 'wrinkle', 'pore', 'acne', 'age_spot'],
    blurb: 'speeds up cell turnover to smooth texture, unclog pores and soften fine lines',
    watch: 'A little dryness or peeling in weeks 1–4 is common ("retinisation"). Use at night with SPF by day. Watch redness and hydration closely.' },
  { id: 'azelaic', re: /azelaic/i, name: 'Azelaic acid', goodFor: ['age_spot', 'acne', 'redness'],
    blurb: 'fades post-acne dark marks, calms breakouts and redness – a great fit for melanin-rich skin',
    watch: 'Mild tingling at first is normal. Dark spots and acne marks usually improve by weeks 6–12.' },
  { id: 'salicylic', re: /salicylic|\bbha\b|beta hydroxy/i, name: 'Salicylic acid (BHA)', goodFor: ['acne', 'pore', 'oiliness', 'texture'],
    blurb: 'dissolves oil inside pores to clear blackheads and breakouts',
    watch: 'Acne and pores should improve within 3–6 weeks. If hydration drops or redness rises, use it less often.' },
  { id: 'bpo', re: /benzoyl|\bbpo\b|panoxyl/i, name: 'Benzoyl peroxide', goodFor: ['acne'],
    blurb: 'kills acne bacteria to calm active breakouts',
    watch: 'Can be drying and bleaches fabric. Watch hydration and redness; 2.5–5% is usually enough.' },
  { id: 'aha', re: /glycolic|lactic|mandelic|\baha\b|alpha hydroxy/i, name: 'AHA exfoliant (glycolic / lactic / mandelic)', goodFor: ['texture', 'radiance', 'age_spot'],
    blurb: 'exfoliates the surface for smoother, brighter skin and gently fades marks',
    watch: 'Use 2–3 times a week to start and always wear SPF. If redness rises, cut back.' },
  { id: 'hyaluronic', re: /hyaluron|sodium hyaluronate|\bha\b/i, name: 'Hyaluronic acid', goodFor: ['moisture', 'wrinkle'],
    blurb: 'pulls water into the skin for plumper, hydrated skin',
    watch: 'Hydration can improve within days. Apply on damp skin and seal with a moisturiser.' },
  { id: 'ceramides', re: /ceramide|cerave|barrier/i, name: 'Ceramides / barrier repair', goodFor: ['moisture', 'redness', 'texture'],
    blurb: 'rebuilds the skin barrier so it holds moisture and gets irritated less',
    watch: 'Hydration and redness should improve in 2–4 weeks.' },
  { id: 'petrolatum', re: /petroleum|petrolatum|vaseline|aquaphor|occlusive|\bbalm\b|baume|shea/i, name: 'Occlusive (petroleum jelly / balms)', goodFor: ['moisture', 'redness'],
    blurb: 'forms a seal that stops water loss – excellent for dryness, flaking and a damaged barrier',
    watch: 'Use a thin layer as the LAST step. It can feel heavy and trap oil on oily or acne-prone skin, so watch oiliness and acne.',
    heavy: true },
  { id: 'sunscreen', re: /spf|sunscreen|sun\s*screen|sunblock|uv/i, name: 'Sunscreen', goodFor: ['age_spot', 'wrinkle', 'radiance', 'redness'],
    blurb: 'stops the sun from darkening spots and marks – the base of every routine on melanin-rich skin',
    watch: 'Use 2 finger-lengths daily and reapply outdoors. Dark spots stop getting darker within weeks.' },
  { id: 'arbutin', re: /arbutin|tranexamic|kojic|licorice/i, name: 'Brightening actives (arbutin / tranexamic acid)', goodFor: ['age_spot'],
    blurb: 'targets the pigment behind dark spots and uneven tone',
    watch: 'Dark spots fade slowly, over 8–12 weeks. Always pair with SPF.' },
  { id: 'centella', re: /centella|cica|panthenol|aloe/i, name: 'Soothing (centella / panthenol)', goodFor: ['redness', 'moisture'],
    blurb: 'calms irritation and supports healing',
    watch: 'Redness should settle within 1–3 weeks.' },
  { id: 'caffeine', re: /caffeine|eye cream|eye serum/i, name: 'Caffeine (eye care)', goodFor: ['eye_bag', 'dark_circle_v2'],
    blurb: 'temporarily de-puffs and brightens the under-eye area',
    watch: 'Puffiness improves quickly; dark circles on deeper skin are often genetic and change slowly.' }
];

// Matches every known active in a product name (e.g. "Niacinamide 10% + Zinc 1%" -> niacinamide + zinc).
function matchActives(productName) { return ACTIVES.filter((a) => a.re.test(productName || '')); }

// 2) Alternative product TYPES to try, per concern.
const ALTERNATIVES = {
  azelaic: { name: 'Azelaic acid 10%', why: 'Fades post-acne dark marks and calms breakouts without bleaching healthy skin.',
    label: '"Azelaic acid" at 10% or more, fragrance-free.', examples: ['The Ordinary Azelaic Acid Suspension 10%', "Paula's Choice 10% Azelaic Acid Booster"] },
  vitc: { name: 'Vitamin C serum', why: 'Brightens and fades dark spots while boosting protection from sun damage.',
    label: '"Ascorbic acid", "ethyl ascorbic acid" or "ascorbyl glucoside"; opaque or dark bottle.', examples: ['Garnier Bright Complete Vitamin C Serum', 'The Ordinary Ascorbyl Glucoside Solution 12%'] },
  arbutin: { name: 'Alpha arbutin / tranexamic acid', why: 'Targets the pigment behind stubborn dark spots and uneven tone.',
    label: '"Alpha arbutin" (about 2%) or "tranexamic acid".', examples: ['The Ordinary Alpha Arbutin 2% + HA'] },
  sunscreen: { name: 'Daily SPF 30–50', why: 'Without SPF, dark spots on melanin-rich skin keep darkening, whatever serum you use.',
    label: '"Broad spectrum" with SPF 30+ and a light, no-white-cast texture.', examples: ['La Roche-Posay Anthelios UVMune 400 Invisible Fluid SPF50+', 'Nivea Sun Protect & Moisture SPF 50'] },
  salicylic: { name: 'Salicylic acid (BHA) 0.5–2%', why: 'Clears oil from inside pores – fewer blackheads, breakouts and less shine.',
    label: '"Salicylic acid" 0.5–2%, as a cleanser or leave-on.', examples: ['CeraVe SA Smoothing Cleanser', 'The Ordinary Salicylic Acid 2% Solution'] },
  bpo: { name: 'Benzoyl peroxide 2.5–5%', why: 'Kills acne bacteria to calm red, active spots.',
    label: '"Benzoyl peroxide" 2.5–5% (higher is not better); rinse-off is gentlest.', examples: ['CeraVe Acne Foaming Cream Cleanser', 'PanOxyl Acne Foaming Wash'] },
  adapalene: { name: 'Adapalene 0.1% (retinoid)', why: 'Prevents clogged pores long-term and fades marks; start 2–3 nights a week.',
    label: '"Adapalene 0.1%" gel.', examples: ['Differin Adapalene Gel 0.1%'] },
  niacinamide: { name: 'Niacinamide 5–10%', why: 'Balances oil, refines the look of pores and calms redness – gentle and easy to combine.',
    label: '"Niacinamide" 4–10% near the top of the ingredient list.', examples: ['The Ordinary Niacinamide 10% + Zinc 1%', 'CeraVe PM Facial Moisturising Lotion'] },
  clay: { name: 'Weekly clay mask', why: 'Soaks up excess oil in humid weather and helps pores look clearer.',
    label: '"Kaolin" or "bentonite" clay; use 1–2 times a week.', examples: ["L'Oréal Paris Pure Clay Mask", 'Garnier Pure Active Charcoal Mask'] },
  gelmoist: { name: 'Light gel moisturiser', why: 'Hydrates without heaviness – skipping moisturiser makes oily skin produce more oil.',
    label: '"Oil-free", "non-comedogenic", gel or gel-cream texture.', examples: ['Neutrogena Hydro Boost Water Gel', 'La Roche-Posay Effaclar Mat'] },
  retinoid: { name: 'Retinol serum (night)', why: 'Smooths texture, refines pores and softens fine lines over time.',
    label: '"Retinol" 0.2–0.5% to start; use at night with SPF by day.', examples: ['CeraVe Resurfacing Retinol Serum', 'The Ordinary Retinol 0.2% in Squalane'] },
  lactic: { name: 'Gentle AHA (lactic / mandelic acid)', why: 'Exfoliates for smoother, brighter skin – gentler than glycolic on deeper skin tones.',
    label: '"Lactic acid" 5–10% or "mandelic acid"; 2–3 nights a week.', examples: ['The Ordinary Lactic Acid 5% + HA'] },
  hyaluronic: { name: 'Hyaluronic acid serum', why: 'Pulls water into dehydrated skin – even oily skin can be thirsty.',
    label: '"Sodium hyaluronate" or "hyaluronic acid"; apply to damp skin.', examples: ['The Ordinary Hyaluronic Acid 2% + B5', 'Neutrogena Hydro Boost Hydrating Serum'] },
  ceramides: { name: 'Ceramide barrier moisturiser', why: 'Repairs the skin barrier so it holds moisture and reacts less.',
    label: '"Ceramide NP / AP / EOP", plus "cholesterol" and fatty acids; fragrance-free.', examples: ['CeraVe Moisturising Cream', 'Cetaphil Moisturising Cream'] },
  petrolatum: { name: 'Petroleum jelly (occlusive)', why: 'Seals in moisture for very dry, flaky or irritated skin – cheap and extremely effective.',
    label: '"Petrolatum" / "white soft paraffin". Use a thin final layer at night; can feel heavy on oily or acne-prone areas.', examples: ['Vaseline Original Petroleum Jelly', 'La Roche-Posay Cicaplast Baume B5+'] },
  centella: { name: 'Soothing centella / panthenol', why: 'Calms redness and irritation and helps the skin recover.',
    label: '"Centella asiatica", "madecassoside" or "panthenol"; fragrance-free.', examples: ['La Roche-Posay Cicaplast Baume B5+', 'SKIN1004 Madagascar Centella Ampoule'] },
  gentle: { name: 'Gentle, non-stripping cleanser', why: 'When skin is reacting, a mild cleanser lets the barrier recover.',
    label: '"Soap-free", "fragrance-free", pH-balanced.', examples: ['Cetaphil Gentle Skin Cleanser', 'CeraVe Hydrating Cleanser'] },
  caffeine: { name: 'Caffeine eye serum', why: 'De-puffs and brightens the under-eye area.',
    label: '"Caffeine" 3–5%, light serum.', examples: ['The Ordinary Caffeine Solution 5% + EGCG'] }
};

// Which alternatives fit each concern (best first). Matches the concern keys in js/concerns.js.
const ALT_FOR = {
  age_spot: ['azelaic', 'vitc', 'arbutin', 'sunscreen'],
  acne: ['salicylic', 'bpo', 'azelaic', 'adapalene'],
  oiliness: ['niacinamide', 'salicylic', 'gelmoist', 'clay'],
  pore: ['salicylic', 'niacinamide', 'retinoid'],
  redness: ['centella', 'ceramides', 'gentle', 'azelaic'],
  texture: ['lactic', 'retinoid', 'salicylic'],
  moisture: ['hyaluronic', 'ceramides', 'petrolatum'],
  radiance: ['vitc', 'lactic', 'sunscreen'],
  dark_circle_v2: ['caffeine', 'vitc', 'sunscreen'],
  eye_bag: ['caffeine'],
  wrinkle: ['retinoid', 'sunscreen', 'vitc']
};
// Alternatives considered "the same" as an active the user already uses (so we don't suggest what they have).
const SAME_AS = { niacinamide: ['niacinamide'], zinc: ['niacinamide'], vitc: ['vitc'], retinoid: ['retinoid', 'adapalene'], azelaic: ['azelaic'],
  salicylic: ['salicylic'], bpo: ['bpo'], aha: ['lactic'], hyaluronic: ['hyaluronic'], ceramides: ['ceramides'], petrolatum: ['petrolatum'],
  sunscreen: ['sunscreen'], arbutin: ['arbutin'], centella: ['centella'], caffeine: ['caffeine'] };

const searchUrl = (q) => 'https://www.google.com/search?q=' + encodeURIComponent(q);
