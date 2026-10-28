// Per-browser "this is me" borrower, so a personal PC can borrow in one tap.
// Never shared with the server; the shared tablet simply leaves it unset.
const ME_KEY = "test-phone-me";

export const readMeId = (): string | null => {
  try {
    return window.localStorage.getItem(ME_KEY);
  } catch {
    return null;
  }
};

export const writeMeId = (borrowerId: string | null) => {
  try {
    if (borrowerId) window.localStorage.setItem(ME_KEY, borrowerId);
    else window.localStorage.removeItem(ME_KEY);
  } catch {
    // Storage can be blocked (private mode); the feature just stays off.
  }
};
