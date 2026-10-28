import { describe, expect, it } from "vitest";
import { PHONES } from "@/lib/phones";
import {
  createDefaultPhoneStates,
  ensurePhoneState,
  loanDays,
  recentBorrowerIds,
  sanitizePhoneStates,
} from "@/lib/phone-state";

describe("phone-state", () => {
  it("기본 상태는 모든 기기가 available", () => {
    const map = createDefaultPhoneStates();
    expect(Object.keys(map).sort()).toEqual(PHONES.map((p) => p.id).sort());
    expect(map.a01.status).toBe("available");
  });

  it("sanitize는 알 수 없는 기기를 버리고 깨진 날짜를 보정한다", () => {
    const map = sanitizePhoneStates({
      a01: { status: "borrowed", currentLoan: { borrowerId: "u1" } },
      zzz: { status: "borrowed" },
    });
    expect(map.a01.status).toBe("borrowed");
    expect(typeof map.a01.currentLoan?.borrowedAt).toBe("string");
    expect((map as Record<string, unknown>).zzz).toBeUndefined();
  });

  it("sanitize는 객체가 아니면 기본 상태", () => {
    expect(sanitizePhoneStates(null).i01.status).toBe("available");
  });

  it("ensurePhoneState는 없는 키에 available을 돌려준다", () => {
    const map = {} as ReturnType<typeof createDefaultPhoneStates>;
    expect(ensurePhoneState(map, "a02")).toEqual({ id: "a02", status: "available" });
  });
});

describe("loanDays", () => {
  const now = new Date(2026, 9, 28, 9, 0);
  it("같은 날 빌리면 0", () => {
    expect(loanDays(new Date(2026, 9, 28, 0, 30).toISOString(), now)).toBe(0);
  });
  it("어제 저녁에 빌리면 24시간이 안 돼도 1", () => {
    expect(loanDays(new Date(2026, 9, 27, 18, 0).toISOString(), now)).toBe(1);
  });
  it("나흘 전이면 4, 깨진 날짜는 0", () => {
    expect(loanDays(new Date(2026, 9, 24, 12, 0).toISOString(), now)).toBe(4);
    expect(loanDays("not-a-date", now)).toBe(0);
  });
});

describe("recentBorrowerIds", () => {
  it("대여·반납 중 최근 순, 중복과 삭제된 대여자를 뺀다", () => {
    const phones = createDefaultPhoneStates();
    phones.a01 = { id: "a01", status: "borrowed", currentLoan: { borrowerId: "u1", borrowedAt: "2026-10-28T01:00:00.000Z" } };
    phones.a02 = { id: "a02", status: "available", lastReturn: { borrowerId: "u2", returnedAt: "2026-10-28T03:00:00.000Z" } };
    phones.i01 = { id: "i01", status: "available", lastReturn: { borrowerId: "u1", returnedAt: "2026-10-27T03:00:00.000Z" } };
    phones.i02 = { id: "i02", status: "available", lastReturn: { borrowerId: "gone", returnedAt: "2026-10-28T05:00:00.000Z" } };
    expect(recentBorrowerIds(phones, ["u1", "u2", "u3"])).toEqual(["u2", "u1"]);
  });
});
