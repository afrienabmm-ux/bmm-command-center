// Model names don't carry their cc in a consistent way (Y15ZR is 150cc,
// NMAX 155 is 155cc, XMAX is 250cc), so there's no reliable way to compute
// this from the text alone — instead this lists the specific big-bike
// model names (Yamaha, Honda, Modenas) that ARE over 250cc, checked as
// substrings of whatever the PIC typed. Anything not on this list is
// treated as 250cc-or-below, since that covers the overwhelming majority
// of what's sold (kapcai and scooters) — staff can still flip the
// checkbox by hand if a customer's bike isn't recognized here.
// Deliberately full, unambiguous tokens only — no bare "r1"/"r3"/"r6",
// since those are substrings of common small-bike names too (Yamaha's own
// R15 and R25 are 155cc/249cc, well under the limit, and "r1" is inside
// "sniper150" as well).
const OVER_250CC_MODELS = [
  // Yamaha
  "tmax",
  "mt-03",
  "mt03",
  "mt-07",
  "mt07",
  "mt-09",
  "mt09",
  "mt-10",
  "mt10",
  "yzf-r1",
  "yzfr1",
  "yzf-r3",
  "yzfr3",
  "yzf-r6",
  "yzfr6",
  "yzf-r7",
  "yzfr7",
  "tracer",
  "tenere",
  "xsr700",
  "xsr 700",
  "xsr900",
  "xsr 900",
  "niken",
  "tricity 300",
  // Honda — CBR250RR/Forza 250 stay off this list (250cc exactly is not
  // "more than 250").
  "cb300",
  "cbr300",
  "cb400",
  "cb500",
  "cbr500",
  "cb650",
  "cbr650",
  "cb1000",
  "cbr1000",
  "fireblade",
  "rebel300",
  "rebel 300",
  "rebel500",
  "rebel 500",
  "forza300",
  "forza 300",
  "nc750",
  "africa twin",
  "goldwing",
  "gold wing",
  "crf300",
  "x-adv",
  "xadv",
  // Modenas — Dominar 250 stays off this list for the same reason.
  "dominar400",
  "dominar 400",
];

export function isOver250ccModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  if (!normalized) return false;
  return OVER_250CC_MODELS.some((needle) => normalized.includes(needle));
}
