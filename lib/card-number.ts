import { supabaseAdmin } from "./supabase-server";
import type { Branch } from "./branch";

const BRANCH_PREFIX: Record<Branch, string> = { kapar: "HQ", setia_alam: "ST", puncak_alam: "PA" };

function randomCardNumber(branch: Branch): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MC-${BRANCH_PREFIX[branch]}-${rand}`;
}

// Shared by the self-signup /join flow and staff manually adding a card —
// checks for a collision instead of trusting randomness alone, since staff
// adding many cards over time makes one far more likely than the rare
// one-off self-signup.
export async function generateUniqueCardNumber(branch: Branch): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomCardNumber(branch);
    const { data } = await supabaseAdmin.from("cc_customer_cards").select("id").eq("card_number", candidate).limit(1);
    if (!data || data.length === 0) return candidate;
  }
  return randomCardNumber(branch);
}
