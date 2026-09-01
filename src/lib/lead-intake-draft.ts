export const LEAD_INTAKE_STORAGE_KEY = "gxj_lead_intake_v1";

export type LeadIntakeDraft = {
  firstName: string;
  email: string;
  consentGranted: true;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validFirstName(value: string): boolean {
  return value.trim().length > 0 && value.trim().length <= 60;
}

export function validEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function parseLeadIntakeDraft(value: unknown): LeadIntakeDraft | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<LeadIntakeDraft>;
  if (
    typeof candidate.firstName !== "string" ||
    typeof candidate.email !== "string" ||
    candidate.consentGranted !== true ||
    !validFirstName(candidate.firstName) ||
    !validEmail(candidate.email)
  ) {
    return null;
  }
  return {
    firstName: candidate.firstName.trim(),
    email: candidate.email.trim(),
    consentGranted: true,
  };
}

export function readLeadIntakeDraft(): LeadIntakeDraft | null {
  try {
    const raw = window.sessionStorage.getItem(LEAD_INTAKE_STORAGE_KEY);
    return raw ? parseLeadIntakeDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeLeadIntakeDraft(draft: LeadIntakeDraft): void {
  try {
    window.sessionStorage.setItem(LEAD_INTAKE_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // The completion screen retains its form as a safe fallback.
  }
}

export function clearLeadIntakeDraft(): void {
  try {
    window.sessionStorage.removeItem(LEAD_INTAKE_STORAGE_KEY);
  } catch {
    // Nothing else is required after a successful enrollment.
  }
}
