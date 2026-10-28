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
        "flex flex-col gap-3 border-b px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4 sm:py-2.5",
        loanTone(days),
        flash && "motion-safe:animate-flash"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        <DeviceImage phone={phone} className="h-16 w-12 shrink-0 rounded-md p-1" />
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-[8.5rem] flex-col gap-0.5">
            <span className="text-sm font-semibold leading-tight">{phone.model}</span>
            <DeviceSpec phone={phone} />
          </div>
          <div className="min-w-0 flex-1 text-sm leading-snug">
            <span className="font-semibold">{borrowerName}</span>
            <span className="block text-xs text-muted-foreground">
              {borrowerOrg ? `${borrowerOrg} · ` : ""}
              {borrowedAt} 대여
            </span>
          </div>
        </div>
        <span
          className={cn(
            "min-w-[3.5rem] self-start text-right font-mono text-sm tabular-nums sm:self-center",
            long ? "font-semibold text-status-busy" : "text-muted-foreground"
          )}
        >
          {days === 0 ? "오늘" : `${days}일째`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 [&>button]:flex-1 sm:[&>button]:flex-none">
        {confirmingReturn ? (
          <>
            <span className="w-full text-sm font-semibold text-amber-700 dark:text-amber-300 sm:w-auto">
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
