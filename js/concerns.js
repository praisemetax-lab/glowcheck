// js/concerns.js
// Friendly, everyday names + simple tips for each YouCam skin concern.
// YouCam scores: HIGHER = HEALTHIER skin (1–100) for every concern.
// Labels are worded so a HIGHER score / "+" always reads as good news (e.g. "Oil control +5").
// "focus: true" marks concerns that matter most for deeper skin tones in humid climates.
const CONCERNS = {
  age_spot: {
    label: 'Even tone', focus: true,
    tip: 'Look for niacinamide, azelaic acid, vitamin C or alpha arbutin on the label. Wear sunscreen every day – sun makes dark spots darker.',
    avoid: 'Skip harsh scrubs and "bleaching" creams. They can make spots come back darker.'
  },
  acne: {
    label: 'Clear skin', focus: true,
    tip: 'Salicylic acid keeps pores clear. Benzoyl peroxide calms a fresh pimple. Azelaic acid fades the marks left behind.',
    avoid: "Try not to pick or squeeze. On brown skin that leaves a dark mark for months."
  },
  oiliness: {
    label: 'Oil control', focus: true,
    tip: 'Niacinamide or zinc help control shine. Still use a light gel moisturiser – dry skin makes more oil.',
    avoid: 'Go easy on thick oils and butters (like coconut oil) on your face if you break out.'
  },
  pore: {
    label: 'Clear pores', focus: true,
    tip: 'Salicylic acid and niacinamide make pores look smaller. A clay mask once a week helps on hot days.',
    avoid: "Pore strips and rough scrubs irritate skin. They don't shrink pores."
  },
  redness: {
    label: 'Calm skin', focus: false,
    tip: 'Soothing picks: centella (cica), panthenol, aloe, ceramides. On brown skin, irritation can look darker, not red.',
    avoid: 'If this drops after a new product, your skin may not like it. Take a break from it.'
  },
  texture: {
    label: 'Smoothness', focus: false,
    tip: 'A gentle exfoliant (lactic or mandelic acid) once or twice a week. Retinol at night also helps.',
    avoid: "Don't stack lots of strong acids at once – one at a time is enough."
  },
  moisture: {
    label: 'Hydration', focus: false,
    tip: 'Glycerin, hyaluronic acid and ceramides keep skin plump. Even oily skin can feel thirsty, especially in AC.',
    avoid: 'Very foamy face washes that leave skin feeling tight.'
  },
  radiance: {
    label: 'Glow', focus: false,
    tip: 'Vitamin C in the morning, good sleep and plenty of water. A gentle exfoliant now and then helps too.',
    avoid: ''
  },
  dark_circle_v2: {
    label: 'Bright under-eyes', focus: false,
    tip: 'Caffeine eye serums and vitamin C can help a bit. On brown skin this often runs in families, so change is slow.',
    avoid: ''
  },
  eye_bag: { label: 'Rested eyes', focus: false, tip: 'Sleep well, eat less salt at night, and try a cold spoon or caffeine eye gel in the morning.', avoid: '' },
  wrinkle: { label: 'Line-free', focus: false, tip: 'Retinol at night, plus sunscreen every morning.', avoid: '' }
};

// Colour for a score: green good, amber ok, red needs attention.
function scoreColor(n) {
  if (n >= 75) return 'var(--good)';
  if (n >= 55) return 'var(--warn)';
  return 'var(--bad)';
}
