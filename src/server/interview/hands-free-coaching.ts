import { isAdminEmail } from "@/server/admin";

export const handsFreeCoachingModeKey = "hands_free_coaching";
export const handsFreeCoachingFeatureFlag = "INTERVIEW_HANDS_FREE_COACHING_ENABLED";

export function isHandsFreeCoachingEnabled() {
  return process.env[handsFreeCoachingFeatureFlag]?.trim().toLowerCase() === "true";
}

export function canUseHandsFreeCoaching(email?: string | null) {
  return isHandsFreeCoachingEnabled() || isAdminEmail(email);
}

