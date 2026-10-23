// js/knowledge.js
// Small local knowledge base used to EXPLAIN verdicts and suggest alternatives.
// General cosmetic-ingredient info only – not medical advice. Example products are well-known,
// widely available ones (no prices, no affiliate links). Concern keys match js/concerns.js.

// 1) What a product the user typed is generally good for (matched by keywords in its name).
const ACTIVES = [
  { id: 'niacinamide', re: /niacinamide|vitamin\s*b3|\bb3\b/i, name: 'Niacinamide (vitamin B3)', goodFor: ['oiliness', 'pore', 'age_spot', 'redness', 'acne'],
    blurb: 'calms oil, makes pores look smaller, soothes skin and slowly fades dark marks',
    watch: 'Oil and pores usually get better first (2–4 weeks). Dark spots take longer (6–12 weeks). Strong versions can sting a bit.' },
  { id: 'zinc', re: /\bzinc\b|zinc pca/i, name: 'Zinc', goodFor: ['oiliness', 'acne', 'redness'],
    blurb: 'helps control shine and calms spots',
    watch: 'Watch oil control and clear skin. Zinc can feel a little drying.' },
  { id: 'vitc', re: /vitamin\s*c|ascorb|\bvit\.?\s*c\b|ethyl ascorbic/i, name: 'Vitamin C', goodFor: ['age_spot', 'radiance', 'dark_circle_v2', 'wrinkle'],
    blurb: 'brightens dull skin, fades dark spots and helps protect from the sun',
    watch: "You'll see more glow first. Dark spots fade at 8–12 weeks. It may tingle. Keep it out of the light." },
  { id: 'retinoid', re: /retin|adapalene|differin|tretinoin|bakuchiol/i, name: 'Retinoid (retinol / adapalene)', goodFor: ['texture', 'wrinkle', 'pore', 'acne', 'age_spot'],
    blurb: 'helps skin renew faster, so it feels smoother, pores stay clear and lines soften',
    watch: 'Some dryness or peeling in the first month is normal. Use it at night and wear sunscreen by day. Watch calm skin and hydration.' },
  { id: 'azelaic', re: /azelaic/i, name: 'Azelaic acid', goodFor: ['age_spot', 'acne', 'redness'],
    blurb: 'fades pimple marks and calms breakouts – great for brown skin',
    watch: 'A little tingling at first is normal. Marks usually fade by weeks 6–12.' },
  { id: 'salicylic', re: /salicylic|\bbha\b|beta hydroxy/i, name: 'Salicylic acid (BHA)', goodFor: ['acne', 'pore', 'oiliness', 'texture'],
    blurb: 'clears oil out of pores, so you get fewer blackheads and pimples',
    watch: 'Pimples and pores should improve in 3–6 weeks. If skin feels dry or upset, use it less often.' },
  { id: 'bpo', re: /benzoyl|\bbpo\b|panoxyl/i, name: 'Benzoyl peroxide', goodFor: ['acne'],
    blurb: 'fights the germs behind pimples',
    watch: 'It can dry skin and bleach towels. Watch hydration and calm skin. A low strength (2.5–5%) is enough.' },
  { id: 'aha', re: /glycolic|lactic|mandelic|\baha\b|alpha hydroxy/i, name: 'AHA exfoliant (glycolic / lactic / mandelic)', goodFor: ['texture', 'radiance', 'age_spot'],
    blurb: 'gently removes dead skin, so skin looks smoother and brighter',
    watch: 'Start 2–3 times a week and wear sunscreen. If skin gets upset, use it less.' },
  { id: 'hyaluronic', re: /hyaluron|sodium hyaluronate|\bha\b/i, name: 'Hyaluronic acid', goodFor: ['moisture', 'wrinkle'],
    blurb: 'pulls water into skin so it looks plump',
    watch: 'Hydration can improve in days. Put it on damp skin, then moisturiser on top.' },
  { id: 'ceramides', re: /ceramide|cerave|barrier/i, name: 'Ceramides / barrier repair', goodFor: ['moisture', 'redness', 'texture'],
    blurb: 'repairs your skin’s protective layer, so it stays moist and calm',
    watch: 'Hydration and calm skin should improve in 2–4 weeks.' },
  { id: 'petrolatum', re: /petroleum|petrolatum|vaseline|aquaphor|occlusive|\bbalm\b|baume|shea/i, name: 'Petroleum jelly / thick balm', goodFor: ['moisture', 'redness'],
    blurb: 'locks moisture in – great for dry, flaky or sore skin',
    watch: 'Use a thin layer as your last step. It can feel heavy on oily skin, so watch oil control and clear skin.',
    heavy: true },
  { id: 'sunscreen', re: /spf|sunscreen|sun\s*screen|sunblock|uv/i, name: 'Sunscreen', goodFor: ['age_spot', 'wrinkle', 'radiance', 'redness'],
    blurb: 'stops the sun from making spots darker – a must for brown skin',
    watch: 'Use two finger-lengths every day and top up outside. Spots stop getting darker within weeks.' },
  { id: 'arbutin', re: /arbutin|tranexamic|kojic|licorice/i, name: 'Spot faders (arbutin / tranexamic acid)', goodFor: ['age_spot'],
    blurb: 'fades dark spots and evens out skin tone',
    watch: 'Spots fade slowly, over 8–12 weeks. Always use sunscreen too.' },
  { id: 'centella', re: /centella|cica|panthenol|aloe/i, name: 'Soothing (centella / panthenol)', goodFor: ['redness', 'moisture'],
    blurb: 'calms upset skin and helps it heal',
    watch: 'Skin should feel calmer in 1–3 weeks.' },
  { id: 'caffeine', re: /caffeine|eye cream|eye serum/i, name: 'Caffeine (eye care)', goodFor: ['eye_bag', 'dark_circle_v2'],
    blurb: 'makes under-eyes look less puffy and brighter for a while',
    watch: 'Puffiness gets better fast. Under-eye darkness often runs in families, so it changes slowly.' }
];

// Matches every known active in a product name (e.g. "Niacinamide 10% + Zinc 1%" -> niacinamide + zinc).
function matchActives(productName) { return ACTIVES.filter((a) => a.re.test(productName || '')); }

// 2) Alternative product TYPES to try, per concern.
const ALTERNATIVES = {
  azelaic: { name: 'Azelaic acid 10%', why: 'Fades pimple marks and calms breakouts, without lightening the rest of your skin.',
    label: '"Azelaic acid" at 10% or more, fragrance-free.', examples: ['The Ordinary Azelaic Acid Suspension 10%', "Paula's Choice 10% Azelaic Acid Booster"] },
  vitc: { name: 'Vitamin C serum', why: 'Brightens skin and fades dark spots.',
    label: '"Ascorbic acid", "ethyl ascorbic acid" or "ascorbyl glucoside"; opaque or dark bottle.', examples: ['Garnier Bright Complete Vitamin C Serum', 'The Ordinary Ascorbyl Glucoside Solution 12%'] },
  arbutin: { name: 'Alpha arbutin / tranexamic acid', why: 'Fades stubborn dark spots and evens your tone.',
    label: '"Alpha arbutin" (about 2%) or "tranexamic acid".', examples: ['The Ordinary Alpha Arbutin 2% + HA'] },
  sunscreen: { name: 'Daily SPF 30–50', why: 'Without sunscreen, dark spots keep getting darker, whatever else you use.',
    label: '"Broad spectrum" with SPF 30+ and a light, no-white-cast texture.', examples: ['La Roche-Posay Anthelios UVMune 400 Invisible Fluid SPF50+', 'Nivea Sun Protect & Moisture SPF 50'] },
  salicylic: { name: 'Salicylic acid (BHA) 0.5–2%', why: 'Clears oil from pores – fewer blackheads, pimples and less shine.',
    label: '"Salicylic acid" 0.5–2%, as a cleanser or leave-on.', examples: ['CeraVe SA Smoothing Cleanser', 'The Ordinary Salicylic Acid 2% Solution'] },
  bpo: { name: 'Benzoyl peroxide 2.5–5%', why: 'Fights the germs behind fresh pimples.',
    label: '"Benzoyl peroxide" 2.5–5% (higher is not better); rinse-off is gentlest.', examples: ['CeraVe Acne Foaming Cream Cleanser', 'PanOxyl Acne Foaming Wash'] },
  adapalene: { name: 'Adapalene 0.1% (retinoid)', why: 'Stops pores clogging and fades marks. Start 2–3 nights a week.',
    label: '"Adapalene 0.1%" gel.', examples: ['Differin Adapalene Gel 0.1%'] },
  niacinamide: { name: 'Niacinamide 5–10%', why: 'Calms oil, shrinks the look of pores and soothes skin. Gentle and easy to use.',
    label: '"Niacinamide" 4–10% near the top of the ingredient list.', examples: ['The Ordinary Niacinamide 10% + Zinc 1%', 'CeraVe PM Facial Moisturising Lotion'] },
  clay: { name: 'Weekly clay mask', why: 'Soaks up extra oil on hot days and makes pores look clearer.',
    label: '"Kaolin" or "bentonite" clay; use 1–2 times a week.', examples: ["L'Oréal Paris Pure Clay Mask", 'Garnier Pure Active Charcoal Mask'] },
  gelmoist: { name: 'Light gel moisturiser', why: 'Hydrates without feeling heavy. Skipping moisturiser makes oily skin even oilier.',
    label: '"Oil-free", "non-comedogenic", gel or gel-cream texture.', examples: ['Neutrogena Hydro Boost Water Gel', 'La Roche-Posay Effaclar Mat'] },
  retinoid: { name: 'Retinol serum (night)', why: 'Makes skin smoother, pores smaller and lines softer over time.',
    label: '"Retinol" 0.2–0.5% to start; use at night with SPF by day.', examples: ['CeraVe Resurfacing Retinol Serum', 'The Ordinary Retinol 0.2% in Squalane'] },
  lactic: { name: 'Gentle AHA (lactic / mandelic acid)', why: 'Gently removes dead skin for a smoother glow. Kind to brown skin.',
    label: '"Lactic acid" 5–10% or "mandelic acid"; 2–3 nights a week.', examples: ['The Ordinary Lactic Acid 5% + HA'] },
  hyaluronic: { name: 'Hyaluronic acid serum', why: 'Gives thirsty skin a drink of water. Even oily skin needs it.',
    label: '"Sodium hyaluronate" or "hyaluronic acid"; apply to damp skin.', examples: ['The Ordinary Hyaluronic Acid 2% + B5', 'Neutrogena Hydro Boost Hydrating Serum'] },
  ceramides: { name: 'Ceramide barrier moisturiser', why: 'Repairs your skin’s protective layer so it stays soft and calm.',
    label: '"Ceramide NP / AP / EOP", plus "cholesterol" and fatty acids; fragrance-free.', examples: ['CeraVe Moisturising Cream', 'Cetaphil Moisturising Cream'] },
  petrolatum: { name: 'Petroleum jelly', why: 'Locks in moisture for very dry, flaky or sore skin. Cheap and it works.',
    label: '"Petrolatum" / "white soft paraffin". Use a thin final layer at night; can feel heavy on oily or acne-prone areas.', examples: ['Vaseline Original Petroleum Jelly', 'La Roche-Posay Cicaplast Baume B5+'] },
  centella: { name: 'Soothing centella / panthenol', why: 'Calms upset skin and helps it heal.',
    label: '"Centella asiatica", "madecassoside" or "panthenol"; fragrance-free.', examples: ['La Roche-Posay Cicaplast Baume B5+', 'SKIN1004 Madagascar Centella Ampoule'] },
  gentle: { name: 'Gentle, non-stripping cleanser', why: 'When skin is upset, a mild wash gives it a rest.',
    label: '"Soap-free", "fragrance-free", pH-balanced.', examples: ['Cetaphil Gentle Skin Cleanser', 'CeraVe Hydrating Cleanser'] },
  caffeine: { name: 'Caffeine eye serum', why: 'Makes under-eyes less puffy and brighter.',
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
