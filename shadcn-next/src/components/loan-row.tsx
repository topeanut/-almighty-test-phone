import { Button } from "@/components/ui/button";
import { DeviceImage, DeviceSpec } from "@/components/phone-tile";
import { loanTone } from "@/lib/loan-age";
import { cn } from "@/lib/utils";
import type { PhoneDefinition } from "@/lib/phones";

type LoanRowProps = {
  phone: PhoneDefinition;
  borrowerName: string;
  borrowerOrg?: string;
  borrowedAt: string;
  days: number;
  long: boolean;
  confirmingReturn: boolean;
  disabled: boolean;
  flash: boolean;
  onTransfer: () => void;
  onAskReturn: () => void;
  onCancelReturn: () => void;
  onConfirmReturn: () => void;
};

export function LoanRow({
  phone,
  borrowerName,
  borrowerOrg,
  borrowedAt,
  days,
  long,
  confirmingReturn,
  disabled,
  flash,
  onTransfer,
  onAskReturn,
  onCancelReturn,
  onConfirmReturn,
}: LoanRowProps) {
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2.5 last:border-b-0",
        loanTone(days),
        flash && "motion-safe:animate-flash"
      )}
    >
      <DeviceImage phone={phone} className="h-16 w-12 shrink-0 rounded-md p-1" />
      <div className="flex min-w-[8.5rem] flex-col gap-0.5">
        <span className="text-sm font-semibold leading-tight">{phone.model}</span>
        <DeviceSpec phone={phone} />
      </div>
      <div className="min-w-[7rem] flex-1 text-sm leading-snug">
        <span className="font-semibold">{borrowerName}</span>
        <span className="block text-xs text-muted-foreground">
          {borrowerOrg ? `${borrowerOrg} · ` : ""}
          {borrowedAt} 대여
        </span>
      </div>
      <span
        className={cn(
          "min-w-[3.5rem] text-right font-mono text-sm tabular-nums",
          long ? "font-semibold text-status-busy" : "text-muted-foreground"
        )}
      >
        {days === 0 ? "오늘" : `${days}일째`}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {confirmingReturn ? (
          <>
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              충전기 꽂았나요?
            </span>
            <Button variant="ghost" className="h-10" onClick={onCancelReturn}>
              아직이에요
            </Button>
            <Button className="h-10" onClick={onConfirmReturn} disabled={disabled}>
              꽂았어요, 반납
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              className="h-10"
              onClick={onTransfer}
              disabled={disabled}
              aria-label={`${phone.model} 대여자 변경`}
            >
              변경
            </Button>
            <Button
              variant="outline"
              className="h-10"
              onClick={onAskReturn}
              disabled={disabled}
              aria-label={`${phone.model} 반납`}
            >
              반납
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
