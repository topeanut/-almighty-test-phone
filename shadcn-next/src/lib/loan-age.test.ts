import { describe, expect, it } from "vitest";

import { LOAN_TONES, loanTone } from "@/lib/loan-age";

describe("loanTone", () => {
  it("하루마다 한 단계씩 진해지고 마지막 단계에서 멈춘다", () => {
    expect(loanTone(0)).toBe(LOAN_TONES[0]);
    expect(loanTone(1)).toBe(LOAN_TONES[1]);
    expect(loanTone(100)).toBe(LOAN_TONES[LOAN_TONES.length - 1]);
  });

  it("음수는 첫 단계", () => {
    expect(loanTone(-3)).toBe(LOAN_TONES[0]);
  });
});
