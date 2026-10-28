"use client";

import * as React from "react";
import { Check, Lock, Search } from "lucide-react";

import { LoanRow } from "@/components/loan-row";
import { MotivationBanner } from "@/components/motivation-banner";
import { DeviceImage, DeviceSpec, PhoneTile } from "@/components/phone-tile";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PHONES, PHONE_BY_ID, type PhoneId, type Platform } from "@/lib/phones";
import { api, ApiError, isOfflineError } from "@/lib/api";
import { readMeId, writeMeId } from "@/lib/me";
import type { AppState, Borrower, PhoneStateMap } from "@/lib/types";
import {
  LONG_LOAN_DAYS,
  createDefaultPhoneStates,
  ensurePhoneState,
  loanDays,
  recentBorrowerIds,
} from "@/lib/phone-state";
import {
  defaultBorrowerId,
  resolveSelectedBorrowerId,
} from "@/lib/dialog-selection";

type BorrowerOrgOption = "프론트엔드팀" | "백엔드팀" | "QA" | "기타";

const BORROWER_ORG_OPTIONS: BorrowerOrgOption[] = [
  "프론트엔드팀",
  "백엔드팀",
  "QA",
  "기타",
];

type PlatformFilter = "all" | Platform;

const PLATFORM_FILTERS: { value: PlatformFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "android", label: "안드로이드" },
  { value: "ios", label: "아이폰" },
];

const UNLOCK_CODES = [
  { label: "4자리", value: "0727" },
  { label: "6자리", value: "000000" },
  { label: "패턴", value: "2489" },
];

const osVersionNumber = (version: string | null) =>
  version ? parseFloat(version.replace(/[^\d.]/g, "")) || 0 : 0;

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatShortDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function Home() {
  const [borrowers, setBorrowers] = React.useState<Borrower[]>([]);
  const [phones, setPhones] = React.useState<PhoneStateMap>(
    createDefaultPhoneStates
  );
  const [hydrated, setHydrated] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(() => new Date());
  const [platformFilter, setPlatformFilter] =
    React.useState<PlatformFilter>("all");

  const [phoneDialogOpen, setPhoneDialogOpen] = React.useState(false);
  const [phoneDialogMode, setPhoneDialogMode] = React.useState<
    "borrow" | "manage" | null
  >(null);
  const [selectedPhoneId, setSelectedPhoneId] = React.useState<PhoneId | null>(
    null
  );
  const [selectedBorrowerId, setSelectedBorrowerId] = React.useState<
    string | null
  >(null);
  const [borrowerQuery, setBorrowerQuery] = React.useState("");
  const [meId, setMeId] = React.useState<string | null>(null);
  const [rememberChoice, setRememberChoice] = React.useState(false);

  const [borrowerDialogOpen, setBorrowerDialogOpen] = React.useState(false);
  const [borrowerName, setBorrowerName] = React.useState("");
  const [borrowerOrgOption, setBorrowerOrgOption] =
    React.useState<BorrowerOrgOption>("프론트엔드팀");
  const [borrowerOrgCustom, setBorrowerOrgCustom] = React.useState("");
  const [borrowerError, setBorrowerError] = React.useState<string | null>(null);
  const [returnConfirmPhoneId, setReturnConfirmPhoneId] =
    React.useState<PhoneId | null>(null);
  const [bannerMessages, setBannerMessages] =
    React.useState<string[]>([]);
  const [bannerDialogOpen, setBannerDialogOpen] = React.useState(false);
  const [bannerInput, setBannerInput] = React.useState("");
  const [offline, setOffline] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimer = React.useRef<number | null>(null);
  const [flashPhoneId, setFlashPhoneId] = React.useState<PhoneId | null>(null);
  const flashTimer = React.useRef<number | null>(null);

  const seqRef = React.useRef(0);
  const latestAppliedSeqRef = React.useRef(0);

  const applyState = React.useCallback((state: AppState) => {
    setBorrowers(state.borrowers);
    setPhones(state.phones);
    setBannerMessages(state.bannerMessages);
    setOffline(false);
  }, []);

  const showToast = React.useCallback((message: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3000);
  }, []);

  // Briefly outlines the phone that just moved between sections.
  const flashPhone = React.useCallback((phoneId: PhoneId) => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    setFlashPhoneId(phoneId);
    flashTimer.current = window.setTimeout(() => {
      setFlashPhoneId(null);
      flashTimer.current = null;
    }, 1400);
  }, []);

  // Apply a response only if it is newer than the last applied one, so a GET
  // that started before a write cannot overwrite the write's result.
  const applyIfNewer = React.useCallback(
    (seq: number, state: AppState) => {
      if (seq <= latestAppliedSeqRef.current) return;
      latestAppliedSeqRef.current = seq;
      applyState(state);
    },
    [applyState]
  );

  const refresh = React.useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      applyIfNewer(seq, await api.getState());
    } catch (error) {
      if (isOfflineError(error)) setOffline(true);
    }
  }, [applyIfNewer]);

  const runAction = React.useCallback(
    async (
      action: () => Promise<AppState>,
      onClientError?: (message: string) => void,
      onSuccess?: () => void
    ) => {
      setBusy(true);
      const seq = ++seqRef.current;
      try {
        applyIfNewer(seq, await action());
        onSuccess?.();
        return true;
      } catch (error) {
        if (isOfflineError(error)) {
          setOffline(true);
          showToast("서버에 연결할 수 없습니다.");
        } else if (error instanceof ApiError && error.status === 409) {
          if (onClientError) onClientError(error.message);
          else showToast("방금 다른 기기에서 처리됐습니다.");
          await refresh();
        } else if (error instanceof ApiError) {
          (onClientError ?? showToast)(error.message);
        } else {
          showToast("알 수 없는 오류가 발생했습니다.");
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [applyIfNewer, refresh, showToast]
  );

  React.useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    []
  );

  const openPhoneDialog = React.useCallback(
    (phoneId: PhoneId, mode: "borrow" | "manage") => {
      setSelectedPhoneId(phoneId);
      setPhoneDialogMode(mode);
      setBorrowerQuery("");
      setRememberChoice(false);
      setReturnConfirmPhoneId(null);
      // Default selection is computed once on open; polling must not reset it.
      setSelectedBorrowerId(
        defaultBorrowerId(
          mode,
          ensurePhoneState(phones, phoneId),
          borrowers,
          meId
        )
      );
      setPhoneDialogOpen(true);
    },
    [borrowers, phones, meId]
  );

  const closePhoneDialog = React.useCallback(() => {
    setPhoneDialogOpen(false);
    setPhoneDialogMode(null);
    setSelectedPhoneId(null);
    setSelectedBorrowerId(null);
  }, []);

  React.useEffect(() => {
    setMeId(readMeId());
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const seq = ++seqRef.current;
      try {
        const state = await api.getState();
        if (!cancelled) applyIfNewer(seq, state);
      } catch (error) {
        if (!cancelled && isOfflineError(error)) setOffline(true);
      } finally {
        if (!cancelled) {
          setHydrated(true);
          setCurrentTime(new Date());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyIfNewer]);

  React.useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void refresh();
    }, 5_000);
    return () => window.clearInterval(id);
  }, [hydrated, refresh]);

  React.useEffect(() => {
    if (!hydrated) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [hydrated, refresh]);

  React.useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);
    return () => window.clearInterval(id);
  }, [hydrated]);

  // Derived during render so a poll never overrides the user's choice; only
  // falls back to the default when the chosen borrower has been deleted.
  const effectiveSelectedBorrowerId =
    phoneDialogOpen && selectedPhoneId
      ? resolveSelectedBorrowerId(
          selectedBorrowerId,
          phoneDialogMode,
          ensurePhoneState(phones, selectedPhoneId),
          borrowers,
          meId
        )
      : null;

  const handleStartLoan = async () => {
    if (!selectedPhoneId || !effectiveSelectedBorrowerId) return;
    const phoneId = selectedPhoneId;
    const borrowerId = effectiveSelectedBorrowerId;
    const borrower = borrowers.find((b) => b.id === borrowerId);
    if (rememberChoice) {
      writeMeId(borrowerId);
      setMeId(borrowerId);
    }
    closePhoneDialog();
    await runAction(
      () => api.borrow(phoneId, borrowerId),
      undefined,
      () => {
        showToast(
          `${PHONE_BY_ID[phoneId].model} · ${borrower?.name ?? ""} 님 대여`
        );
        flashPhone(phoneId);
      }
    );
  };

  const handleTransferLoan = async () => {
    if (!selectedPhoneId || !effectiveSelectedBorrowerId) return;
    const phoneId = selectedPhoneId;
    const borrowerId = effectiveSelectedBorrowerId;
    const borrower = borrowers.find((b) => b.id === borrowerId);
    closePhoneDialog();
    await runAction(
      () => api.transfer(phoneId, borrowerId),
      undefined,
      () => {
        showToast(
          `${PHONE_BY_ID[phoneId].model} 대여자를 ${borrower?.name ?? ""} 님으로 변경`
        );
        flashPhone(phoneId);
      }
    );
  };

  // Return from the manage dialog asks the same charger question inline.
  const handleManualReturn = () => {
    if (!selectedPhoneId) return;
    const targetPhoneId = selectedPhoneId;
    closePhoneDialog();
    setReturnConfirmPhoneId(targetPhoneId);
  };

  const finalizeReturn = async (phoneId: PhoneId) => {
    setReturnConfirmPhoneId(null);
    await runAction(
      () => api.returnPhone(phoneId),
      undefined,
      () => {
        showToast(`${PHONE_BY_ID[phoneId].model} 반납 완료`);
        flashPhone(phoneId);
      }
    );
  };

  const handleCopyCode = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${value} 복사됨`);
    } catch {
      showToast(`비밀번호 ${value}`);
    }
  };

  const handleAddBannerMessage = async () => {
    const message = bannerInput.trim();
    if (!message) return;
    const ok = await runAction(() => api.addBanner(message));
    if (ok) {
      setBannerInput("");
      setBannerDialogOpen(false);
    }
  };

  const handleAddBorrower = async () => {
    const name = borrowerName.trim();
    const organization =
      borrowerOrgOption === "기타"
        ? borrowerOrgCustom.trim()
        : borrowerOrgOption;
    if (!name || !organization) {
      setBorrowerError("이름과 소속을 모두 입력해 주세요.");
      return;
    }
    const ok = await runAction(
      () => api.addBorrower(name, organization),
      setBorrowerError
    );
    if (ok) {
      setBorrowerName("");
      setBorrowerOrgOption("프론트엔드팀");
      setBorrowerOrgCustom("");
      setBorrowerError(null);
    }
  };

  const isBorrowerInUse = React.useCallback(
    (borrowerId: string) => {
      return PHONES.some((phone) => {
        const state = ensurePhoneState(phones, phone.id);
        return (
          state.status === "borrowed" &&
          state.currentLoan?.borrowerId === borrowerId
        );
      });
    },
    [phones]
  );

  const handleDeleteBorrower = async (borrowerId: string) => {
    if (isBorrowerInUse(borrowerId)) {
      setBorrowerError("대여 중인 대여자는 삭제할 수 없습니다.");
      return;
    }
    const ok = await runAction(
      () => api.deleteBorrower(borrowerId),
      setBorrowerError
    );
    if (ok) setBorrowerError(null);
  };

  const getBorrower = React.useCallback(
    (borrowerId?: string | null) => {
      if (!borrowerId) return undefined;
      return borrowers.find((borrower) => borrower.id === borrowerId);
    },
    [borrowers]
  );

  const currentDialogPhone = selectedPhoneId
    ? ensurePhoneState(phones, selectedPhoneId)
    : null;
  const dialogPhone = selectedPhoneId ? PHONE_BY_ID[selectedPhoneId] : null;
  const selectedBorrower = getBorrower(effectiveSelectedBorrowerId);
  // A remembered borrower that was deleted simply stops counting as "me".
  const me = getBorrower(meId);

  const forgetMe = () => {
    writeMeId(null);
    setMeId(null);
    showToast("이 브라우저의 기본 대여자를 해제했습니다.");
  };

  const visiblePhones = PHONES.filter(
    (phone) => platformFilter === "all" || phone.platform === platformFilter
  );
  const availablePhones = visiblePhones
    .filter((phone) => ensurePhoneState(phones, phone.id).status !== "borrowed")
    .sort(
      (a, b) =>
        a.platform.localeCompare(b.platform) ||
        osVersionNumber(a.osVersion) - osVersionNumber(b.osVersion)
    );
  const loanedPhones = visiblePhones
    .filter((phone) => {
      const state = ensurePhoneState(phones, phone.id);
      return state.status === "borrowed" && state.currentLoan;
    })
    .sort((a, b) =>
      (ensurePhoneState(phones, a.id).currentLoan?.borrowedAt ?? "").localeCompare(
        ensurePhoneState(phones, b.id).currentLoan?.borrowedAt ?? ""
      )
    );

  const query = borrowerQuery.trim();
  const matchesQuery = (borrower: Borrower) =>
    !query ||
    borrower.name.includes(query) ||
    borrower.organization.includes(query);
  const recentIds = recentBorrowerIds(
    phones,
    borrowers.map((b) => b.id)
  );
  const recentBorrowers = recentIds
    .map((id) => getBorrower(id))
    .filter((b): b is Borrower => !!b && matchesQuery(b));
  const filteredBorrowers = borrowers.filter(matchesQuery);

  const renderBorrowerOption = (borrower: Borrower) => {
    const selected = effectiveSelectedBorrowerId === borrower.id;
    return (
      <button
        key={borrower.id}
        type="button"
        aria-pressed={selected}
        onClick={() => setSelectedBorrowerId(borrower.id)}
        className={cn(
          "flex min-h-12 items-center justify-between gap-2 rounded-lg border p-2.5 text-left transition",
          selected
            ? "border-2 border-foreground bg-foreground/5 p-[9px]"
            : "hover:border-foreground/40"
        )}
      >
        <span>
          <span className="block text-[11px] text-muted-foreground">
            {borrower.organization}
          </span>
          <span className="text-sm font-semibold">{borrower.name}</span>
        </span>
        {selected && (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
            <Check className="size-3" aria-hidden />
          </span>
        )}
      </button>
    );
  };

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:py-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              전능아이티 테스트폰 대여
            </h1>
            <p className="text-sm text-muted-foreground">
              카드를 눌러 빌리고, 반납할 때는 충전기를 꽂아 주세요.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {me && (
              <button
                type="button"
                onClick={forgetMe}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition hover:bg-accent"
                aria-label={`기본 대여자 ${me.name} 해제`}
              >
                <span className="font-semibold">나: {me.name}</span>
                <span className="text-muted-foreground">해제</span>
              </button>
            )}
            {offline && (
              <span className="rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground">
                서버 연결 끊김
              </span>
            )}
            <div
              className="flex flex-wrap gap-1.5"
              aria-label="테스트폰 잠금 해제 번호, 누르면 복사"
            >
              {UNLOCK_CODES.map((code, index) => (
                <button
                  key={code.label}
                  type="button"
                  onClick={() => handleCopyCode(code.value)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-muted px-2.5 text-xs text-muted-foreground transition hover:bg-accent"
                >
                  {index === 0 && <Lock className="size-3" aria-hidden />}
                  {code.label}
                  <span className="font-mono font-semibold text-foreground">
                    {code.value}
                  </span>
                </button>
              ))}
            </div>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <MotivationBanner messages={bannerMessages} className="sm:w-[28rem]" />
          <Button
            variant="link"
            size="sm"
            className="px-0 text-xs text-muted-foreground underline-offset-4 hover:text-primary"
            onClick={() => setBannerDialogOpen(true)}
            disabled={offline}
          >
            롤링 배너 추가하기
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="기기 필터">
        {PLATFORM_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            aria-pressed={platformFilter === filter.value}
            onClick={() => setPlatformFilter(filter.value)}
            className={cn(
              "h-8 rounded-full border px-3.5 text-sm transition",
              platformFilter === filter.value
                ? "border-foreground bg-foreground text-background"
                : "bg-background hover:bg-accent"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <section aria-labelledby="available-heading" className="flex flex-col gap-3">
        <h2
          id="available-heading"
          className="flex items-center gap-2 text-base font-semibold"
        >
          <span className="size-2.5 rounded-full bg-status-ok" aria-hidden />
          지금 빌릴 수 있어요
          <span className="font-mono text-sm text-muted-foreground tabular-nums">
            {availablePhones.length}
          </span>
        </h2>
        {availablePhones.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            지금 빌릴 수 있는 폰이 없어요.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]">
            {availablePhones.map((phone) => {
              const state = ensurePhoneState(phones, phone.id);
              const lastBorrower = getBorrower(state.lastReturn?.borrowerId);
              const lastReturn = state.lastReturn
                ? `${formatShortDateTime(state.lastReturn.returnedAt)} · ${
                    lastBorrower?.name ?? "삭제된 대여자"
                  }`
                : "기록 없음";
              return (
                <PhoneTile
                  key={phone.id}
                  phone={phone}
                  lastReturn={lastReturn}
                  actionLabel={me ? `${me.name} 님으로 빌리기` : "빌리기"}
                  disabled={offline}
                  flash={flashPhoneId === phone.id}
                  onBorrow={() => openPhoneDialog(phone.id, "borrow")}
                />
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="loaned-heading" className="flex flex-col gap-3">
        <h2
          id="loaned-heading"
          className="flex items-center gap-2 text-base font-semibold"
        >
          <span className="size-2.5 rounded-full bg-status-busy" aria-hidden />
          대여 중
          <span className="font-mono text-sm text-muted-foreground tabular-nums">
            {loanedPhones.length}
          </span>
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            오래 빌린 순
          </span>
        </h2>
        {loanedPhones.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            대여 중인 폰이 없어요.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-xl border">
            {loanedPhones.map((phone) => {
              const loan = ensurePhoneState(phones, phone.id).currentLoan!;
              const borrower = getBorrower(loan.borrowerId);
              const days = loanDays(loan.borrowedAt, currentTime);
              return (
                <LoanRow
                  key={phone.id}
                  phone={phone}
                  borrowerName={borrower?.name ?? "삭제된 대여자"}
                  borrowerOrg={borrower?.organization}
                  borrowedAt={formatShortDateTime(loan.borrowedAt)}
                  days={days}
                  long={days >= LONG_LOAN_DAYS}
                  confirmingReturn={returnConfirmPhoneId === phone.id}
                  disabled={offline || busy}
                  flash={flashPhoneId === phone.id}
                  onTransfer={() => openPhoneDialog(phone.id, "manage")}
                  onAskReturn={() => setReturnConfirmPhoneId(phone.id)}
                  onCancelReturn={() => setReturnConfirmPhoneId(null)}
                  onConfirmReturn={() => finalizeReturn(phone.id)}
                />
              );
            })}
          </ul>
        )}
      </section>

      <footer className="flex flex-col gap-3 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p>· 반드시 대여를 신청하고 대여합니다. 반납은 반납 버튼으로 처리합니다.</p>
          <p>· 오른쪽에 있는 종이는 쓰지 않으셔도 됩니다. 구시대의 유물입니다.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="self-start sm:self-auto"
          onClick={() => setBorrowerDialogOpen(true)}
          disabled={offline}
        >
          대여자 관리
        </Button>
      </footer>

      <Dialog
        open={phoneDialogOpen}
        onOpenChange={(open) => !open && closePhoneDialog()}
      >
        <DialogContent
          className="max-w-2xl"
          onOpenAutoFocus={(event) => {
            // On the shared tablet, focusing the search box pops the keyboard
            // over the borrower list; most people tap a name instead.
            if (window.matchMedia("(pointer: coarse)").matches) {
              event.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              {dialogPhone && (
                <DeviceImage
                  phone={dialogPhone}
                  className="h-24 w-20 shrink-0 rounded-md p-1.5"
                />
              )}
              <div className="flex flex-col gap-1 text-left">
                <DialogTitle>
                  {dialogPhone?.model}{" "}
                  {phoneDialogMode === "manage" ? "대여자 변경" : "빌리기"}
                </DialogTitle>
                {dialogPhone && <DeviceSpec phone={dialogPhone} />}
              </div>
            </div>
            <DialogDescription className="text-left">
              {phoneDialogMode === "manage"
                ? "새로 빌릴 사람을 고르거나 반납하세요."
                : "누구 이름으로 빌릴지 고르세요."}
            </DialogDescription>
          </DialogHeader>

          {phoneDialogMode === "manage" && currentDialogPhone?.currentLoan && (
            <div className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="text-xs text-muted-foreground">현재 대여자</p>
              <p className="font-semibold">
                {(() => {
                  const borrower = getBorrower(
                    currentDialogPhone.currentLoan?.borrowerId
                  );
                  return borrower
                    ? `${borrower.name} · ${borrower.organization}`
                    : "삭제된 대여자";
                })()}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(currentDialogPhone.currentLoan.borrowedAt)} 대여
              </p>
            </div>
          )}

          {borrowers.length === 0 ? (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              먼저 대여자를 등록해야 대여를 진행할 수 있습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <label
                htmlFor="borrower-search"
                className="flex items-center gap-2 rounded-md border bg-background px-3"
              >
                <Search className="size-4 text-muted-foreground" aria-hidden />
                <span className="sr-only">대여자 이름으로 찾기</span>
                <input
                  id="borrower-search"
                  type="search"
                  value={borrowerQuery}
                  onChange={(event) => setBorrowerQuery(event.target.value)}
                  placeholder="이름이나 소속으로 찾기"
                  autoComplete="off"
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              <div className="flex max-h-[50dvh] flex-col gap-3 overflow-y-auto sm:max-h-[420px]">
                {recentBorrowers.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      최근 빌린 사람
                    </Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {recentBorrowers.map(renderBorrowerOption)}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">전체</Label>
                  {filteredBorrowers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      &ldquo;{query}&rdquo;와 맞는 대여자가 없습니다.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {filteredBorrowers.map(renderBorrowerOption)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {phoneDialogMode === "borrow" &&
            selectedBorrower &&
            selectedBorrower.id !== me?.id && (
              <label
                htmlFor="remember-me"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberChoice}
                  onChange={(event) => setRememberChoice(event.target.checked)}
                  className="size-4 accent-foreground"
                />
                이 브라우저에서는 {selectedBorrower.name} 님을 기본으로 선택
                (공용 태블릿에서는 켜지 마세요)
              </label>
            )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closePhoneDialog}>
              닫기
            </Button>
            {phoneDialogMode === "manage" ? (
              <>
                <Button
                  variant="ghost"
                  onClick={handleManualReturn}
                  disabled={offline || busy}
                >
                  반납하기
                </Button>
                <Button
                  onClick={handleTransferLoan}
                  disabled={
                    offline ||
                    busy ||
                    !effectiveSelectedBorrowerId ||
                    effectiveSelectedBorrowerId ===
                      currentDialogPhone?.currentLoan?.borrowerId
                  }
                >
                  {selectedBorrower &&
                  effectiveSelectedBorrowerId !==
                    currentDialogPhone?.currentLoan?.borrowerId
                    ? `${selectedBorrower.name} 님으로 변경`
                    : "대여자 변경"}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleStartLoan}
                disabled={
                  offline ||
                  busy ||
                  !effectiveSelectedBorrowerId ||
                  borrowers.length === 0
                }
              >
                {selectedBorrower
                  ? `${selectedBorrower.name} 님 이름으로 빌리기`
                  : "빌릴 사람을 고르세요"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={borrowerDialogOpen}
        onOpenChange={(open) => {
          setBorrowerDialogOpen(open);
          if (!open) {
            setBorrowerError(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>대여자 관리</DialogTitle>
            <DialogDescription>
              대여자를 등록하거나 삭제해 리스트를 관리하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="borrower-name">이름</Label>
                <Input
                  id="borrower-name"
                  value={borrowerName}
                  onChange={(event) => setBorrowerName(event.target.value)}
                  placeholder="이정한"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="borrower-organization">소속</Label>
                <Select
                  value={borrowerOrgOption}
                  onValueChange={(value) =>
                    setBorrowerOrgOption(value as BorrowerOrgOption)
                  }
                >
                  <SelectTrigger id="borrower-organization">
                    <SelectValue placeholder="소속을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {BORROWER_ORG_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {borrowerOrgOption === "기타" && (
                <div className="grid gap-2">
                  <Label htmlFor="borrower-organization-custom">
                    소속 입력
                  </Label>
                  <Input
                    id="borrower-organization-custom"
                    value={borrowerOrgCustom}
                    onChange={(event) =>
                      setBorrowerOrgCustom(event.target.value)
                    }
                    placeholder="소속을 직접 입력하세요"
                  />
                </div>
              )}
              {borrowerError && (
                <p className="text-xs text-destructive">{borrowerError}</p>
              )}
              <Button
                type="button"
                onClick={handleAddBorrower}
                disabled={offline || busy}
              >
                대여자 추가
              </Button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">등록된 대여자</p>
              {borrowers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  아직 등록된 대여자가 없습니다.
                </p>
              ) : (
                <ul className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {borrowers.map((borrower) => {
                    const inUse = isBorrowerInUse(borrower.id);
                    return (
                      <li
                        key={borrower.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{borrower.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {borrower.organization}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBorrower(borrower.id)}
                          disabled={inUse || offline || busy}
                        >
                          {inUse ? "대여 중" : "삭제"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBorrowerDialogOpen(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bannerDialogOpen}
        onOpenChange={(open) => {
          setBannerDialogOpen(open);
          if (!open) {
            setBannerInput("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>응원 문구 추가</DialogTitle>
            <DialogDescription>
              롤링 배너에 표시할 문구를 입력해 주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="banner-message">응원 문구</Label>
              <Input
                id="banner-message"
                value={bannerInput}
                onChange={(event) => setBannerInput(event.target.value)}
                placeholder="예: 오늘도 최고의 QA 팀입니다!"
                maxLength={80}
              />
              <p className="text-xs text-muted-foreground">
                최대 80자까지 입력할 수 있습니다.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBannerDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              onClick={handleAddBannerMessage}
              disabled={!bannerInput.trim() || offline || busy}
            >
              추가하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg"
        >
          {toast}
        </div>
      )}
    </main>
  );
}
