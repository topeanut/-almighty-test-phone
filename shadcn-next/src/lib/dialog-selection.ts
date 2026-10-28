import type { Borrower, PhoneState } from "@/lib/types";

export type PhoneDialogMode = "borrow" | "manage";

/**
 * Selection a phone dialog starts with: the current borrower (manage), or in
 * borrow mode only the borrower this browser remembers. Borrow mode never
 * guesses, so a quick "대여 시작" cannot record the wrong person.
 */
export const defaultBorrowerId = (
  mode: PhoneDialogMode | null,
  phoneState: PhoneState | null,
  borrowers: Borrower[],
  preferredId: string | null = null
): string | null => {
  if (!mode || !phoneState) return null;
  if (mode === "manage") return phoneState.currentLoan?.borrowerId ?? null;
  return preferredId && borrowers.some((b) => b.id === preferredId)
    ? preferredId
    : null;
};

/**
 * Keeps the user's choice across data refreshes; only falls back to the
 * default when the chosen borrower no longer exists (or nothing is chosen).
 */
export const resolveSelectedBorrowerId = (
  selected: string | null,
  mode: PhoneDialogMode | null,
  phoneState: PhoneState | null,
  borrowers: Borrower[],
  preferredId: string | null = null
): string | null => {
  if (selected && borrowers.some((borrower) => borrower.id === selected)) {
    return selected;
  }
  return defaultBorrowerId(mode, phoneState, borrowers, preferredId);
};
