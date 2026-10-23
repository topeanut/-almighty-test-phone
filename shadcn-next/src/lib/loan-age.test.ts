import { describe, expect, it } from "vitest";

import { LOAN_TONES, loanDays, loanLabel, loanTone } from "@/lib/loan-age";

const at = (s: string) => new Date(s);

describe("loanDays", () => {
  it("같은 날이면 0", () => {
    expect(loanDays("2026-10-23T09:00:00", at("2026-10-23T23:59:00"))).toBe(0);
  });

  it("자정을 넘으면 24시간이 안 돼도 하루로 센다", () => {
    expect(loanDays("2026-10-22T23:00:00", at("2026-10-23T08:00:00"))).toBe(1);
  });

  it("여러 날", () => {
    expect(loanDays("2026-09-04T11:07:00", at("2026-10-23T10:00:00"))).toBe(49);
  });

  it("값이 없거나 미래면 0", () => {
    expect(loanDays(undefined, at("2026-10-23T10:00:00"))).toBe(0);
    expect(loanDays("2026-10-25T10:00:00", at("2026-10-23T10:00:00"))).toBe(0);
    expect(loanDays("not-a-date", at("2026-10-23T10:00:00"))).toBe(0);
  });
});

describe("loanTone / loanLabel", () => {
  it("하루마다 한 단계씩 진해지고 마지막 단계에서 멈춘다", () => {
    expect(loanTone(0)).toBe(LOAN_TONES[0]);
    expect(loanTone(1)).toBe(LOAN_TONES[1]);
    expect(loanTone(100)).toBe(LOAN_TONES[LOAN_TONES.length - 1]);
  });

  it("라벨", () => {
    expect(loanLabel(0)).toBe("오늘 대여");
    expect(loanLabel(3)).toBe("3일째");
  });
});
