// 대여 중 행 배경. 하루가 지날 때마다 한 단계씩 진해진다.
// Tailwind가 클래스를 찾을 수 있도록 전체 문자열로 적어 둔다.
export const LOAN_TONES = [
  "bg-red-500/[0.06]",
  "bg-red-500/[0.12]",
  "bg-red-500/[0.18]",
  "bg-red-500/[0.25]",
  "bg-red-500/[0.32]",
  "bg-red-500/[0.40]",
  "bg-red-500/[0.48]",
] as const;

export function loanTone(days: number): string {
  return LOAN_TONES[Math.min(Math.max(days, 0), LOAN_TONES.length - 1)];
}
