// This workshop services bikes of every brand, but the Model field on a
// jobsheet is free text (typed or OCR-read off the paper form), not picked
// from a catalog — so there's no structured brand to just read off. This
// classifies it from the text itself, matching real jobsheet data seen in
// production (checked against 597 real Walk-in jobs before writing this
// list) rather than a generic Yamaha lineup — e.g. "EGO AVANTIZ", "NVX ABS
// V3 ( GPR155 - A )" and "( INACTIVE ) YAMAHA 135LC" all needed to match.
//
// Order matters: an explicit brand name (either way) is checked first and
// wins outright, before falling through to the model-keyword lists — a
// model string that happens to be ambiguous otherwise is still classified
// correctly once "HONDA" or "YAMAHA" literally appears in it.
export type YamahaClassification = "yamaha" | "other" | "unknown";

const OTHER_BRAND_NAMES = [
  "HONDA", "MODENAS", "SYM", "DEMAK", "BENELLI", "KTM", "SUZUKI", "KAWASAKI",
  "VESPA", "PIAGGIO", "WMOTO", "CFMOTO", "ROYAL ENFIELD", "APRILIA", "DUCATI",
  "TRIUMPH", "KYMCO", "PEUGEOT", "HYOSUNG",
];

// Model codes actually seen in the real data for other brands, so a model
// with no brand name typed at all (e.g. "VARIO 160 ( ACB160CAT )") still
// gets classified correctly.
const OTHER_BRAND_MODEL_KEYWORDS = [
  "VARIO", "WAVE", "ADV", "ANF", "KRISS", "ELIT", "FORZA", "DASH", "CBR",
  "PCX", "BEAT", "SCOOPY", "SUPRA", "EX5", "RS150", "RSX", "SPARK",
  "RAIDER", "FZ150", // Suzuki's FZ150 collides with Yamaha's own FZ line by
  // number alone — the brand-name check above already catches genuine
  // Suzuki jobs typed as "SUZUKI FZ150", so this stays out of the Yamaha
  // list rather than risk crediting a rival's bike.
];

// Yamaha Malaysia's actual model lineup, spelled the way this workshop's
// own jobsheets spell it.
const YAMAHA_MODEL_KEYWORDS = [
  "Y15ZR", "Y16ZR", "135LC", "LC135", "EGO", "XMAX", "NMAX", "NVX", "NVS",
  "MT15", "MT25", "MT135", "MT09", "YZF", "Z15GT", "LAGENDA", "TMAX",
  "FINO", "MIO", "SNIPER", "TRICITY", "AEROX", "T135", "FZ", "FZS", "125ZR",
  "GEAR", "YPVS", "125Z", "RXZ", "SRZ", "XTZ", "TRACER", "XSR", "WR", "EZ115",
];

function normalize(model: string): string {
  return model.trim().toUpperCase();
}

// Keywords and real jobsheet text alike write the same model with wildly
// different spacing/punctuation ("MT-15", "MT 15", "MT - 15" all appear) —
// stripping everything but letters/digits before comparing catches all of
// them without needing every variant spelled out.
function compact(s: string): string {
  return s.replace(/[^A-Z0-9]/g, "");
}

export function classifyYamahaModel(model: string): YamahaClassification {
  const m = normalize(model);
  if (!m) return "unknown";
  if (m.includes("YAMAHA")) return "yamaha";
  if (OTHER_BRAND_NAMES.some((b) => m.includes(b))) return "other";
  const mCompact = compact(m);
  if (YAMAHA_MODEL_KEYWORDS.some((k) => mCompact.includes(compact(k)))) return "yamaha";
  if (OTHER_BRAND_MODEL_KEYWORDS.some((k) => mCompact.includes(compact(k)))) return "other";
  return "unknown";
}

export function isYamahaModel(model: string): boolean {
  return classifyYamahaModel(model) === "yamaha";
}
