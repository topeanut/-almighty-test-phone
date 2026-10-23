const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// 대여 시작일부터 오늘까지 지난 날짜 수. 자정을 넘을 때마다 1씩 늘어난다.
export function loanDays(borrowedAt: string | undefined, now: Date): number {
  if (!borrowedAt) return 0;
  const start = new Date(borrowedAt);
  if (Number.isNaN(start.getTime())) return 0;
  const days = Math.round((startOfDay(now) - startOfDay(start)) / DAY_MS);
  return Math.max(0, days);
}

// 대여 중 카드 배경. 하루가 지날 때마다 한 단계씩 진해진다.
// Tailwind가 클래스를 찾을 수 있도록 전체 문자열로 적어 둔다.
export const LOAN_TONES = [
  "border-red-500/40 bg-red-500/10",
  "border-red-500/50 bg-red-500/[0.16]",
  "border-red-500/60 bg-red-500/[0.22]",
  "border-red-500/70 bg-red-500/[0.30]",
  "border-red-500/80 bg-red-500/[0.38]",
  "border-red-500/90 bg-red-500/[0.46]",
  "border-red-500 bg-red-500/[0.55]",
] as const;

export function loanTone(days: number): string {
  return LOAN_TONES[Math.min(Math.max(days, 0), LOAN_TONES.length - 1)];
}

export function loanLabel(days: number): string {
  return days === 0 ? "오늘 대여" : `${days}일째`;
}
