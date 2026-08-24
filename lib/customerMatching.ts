export function normalizePhoneForMatching(
  phone: string | null | undefined
): string {
  const value = (phone ?? "").trim();
  const digits = value.replace(/\D/g, "");

  if (!digits) return "";

  // International numbers compare identically whether entered as +33... or
  // 0033.... The original number is still stored and displayed unchanged.
  if (value.startsWith("+")) {
    return digits;
  }

  if (digits.startsWith("00") && digits.length > 2) {
    return digits.slice(2);
  }

  // My Way Cars is UK-based, so a normal 10/11 digit national number can be
  // compared with the same number entered using +44 or 0044.
  if (
    digits.startsWith("0") &&
    (digits.length === 10 || digits.length === 11)
  ) {
    return `44${digits.slice(1)}`;
  }

  return digits;
}
