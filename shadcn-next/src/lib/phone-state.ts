import { PHONES, type PhoneId } from "@/lib/phones";
import type { PhoneState, PhoneStateMap } from "@/lib/types";

export const createDefaultPhoneStates = (): PhoneStateMap => {
  const map = {} as PhoneStateMap;
  for (const phone of PHONES) {
    map[phone.id] = { id: phone.id, status: "available" };
  }
  return map;
};

export const sanitizePhoneStates = (raw: unknown): PhoneStateMap => {
  const defaults = createDefaultPhoneStates();
  if (!raw || typeof raw !== "object") return defaults;
  const parsed = raw as Record<string, Partial<PhoneState>>;
  for (const phone of PHONES) {
    const value = parsed[phone.id];
    if (value) {
      defaults[phone.id] = {
        id: phone.id,
        status: value.status === "borrowed" ? "borrowed" : "available",
        currentLoan: value.currentLoan?.borrowerId
          ? {
              borrowerId: value.currentLoan.borrowerId,
              borrowedAt:
                value.currentLoan.borrowedAt ?? new Date().toISOString(),
            }
          : undefined,
        lastReturn: value.lastReturn?.borrowerId
          ? {
              borrowerId: value.lastReturn.borrowerId,
              returnedAt:
                value.lastReturn.returnedAt ?? new Date().toISOString(),
            }
          : undefined,
      };
    }
  }
  return defaults;
};

export const ensurePhoneState = (map: PhoneStateMap, phoneId: PhoneId) =>
  map[phoneId] ?? { id: phoneId, status: "available" };

/** A loan at or past this many days is highlighted as long. */
export const LONG_LOAN_DAYS = 3;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Calendar days since the loan started in local time; 0 means today. */
export const loanDays = (borrowedAt: string, now: Date) => {
  const start = new Date(borrowedAt);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(start)) / 86_400_000));
};

/** Borrowers who most recently borrowed or returned a phone, newest first. */
export const recentBorrowerIds = (
  phones: PhoneStateMap,
  existingIds: string[],
  limit = 3
) => {
  const events: { borrowerId: string; at: string }[] = [];
  for (const state of Object.values(phones)) {
    if (state.currentLoan) {
      events.push({ borrowerId: state.currentLoan.borrowerId, at: state.currentLoan.borrowedAt });
    }
    if (state.lastReturn) {
      events.push({ borrowerId: state.lastReturn.borrowerId, at: state.lastReturn.returnedAt });
    }
  }
  events.sort((a, b) => b.at.localeCompare(a.at));
  const ids: string[] = [];
  for (const { borrowerId } of events) {
    if (ids.length >= limit) break;
    if (!ids.includes(borrowerId) && existingIds.includes(borrowerId)) ids.push(borrowerId);
  }
  return ids;
};
