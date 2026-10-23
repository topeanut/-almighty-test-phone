"use client";

import * as React from "react";
import Image from "next/image";

import { MotivationBanner } from "@/components/motivation-banner";
import { Button } from "@/components/ui/button";
import { loanDays, loanLabel, loanTone } from "@/lib/loan-age";
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
import { PHONES, type PhoneId, type Platform } from "@/lib/phones";
import { api, ApiError, isOfflineError } from "@/lib/api";
import type {
  AppState,
  Borrower,
  PhoneStateMap,
} from "@/lib/types";
import {
  createDefaultPhoneStates,
  ensurePhoneState,
} from "@/lib/phone-state";
import {
  defaultBorrowerId,
  resolveSelectedBorrowerId,
} from "@/lib/dialog-selection";

const PHONE_GROUPS = (["android", "ios"] as const).map((platform) => ({
  platform,
  phones: PHONES.filter((phone) => phone.platform === platform),
}));

type BorrowerOrgOption = "프론트엔드팀" | "백엔드팀" | "QA" | "기타";

const BORROWER_ORG_OPTIONS: BorrowerOrgOption[] = [
  "프론트엔드팀",
  "백엔드팀",
  "QA",
  "기타",
];

const PLATFORM_LABELS: Record<Platform, string> = {
  android: "안드로이드",
  ios: "아이폰",
};

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

const formatCardDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const time = date.toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
};

const formatClock = (date: Date) =>
  `${date.getMonth() + 1}/${date.getDate()} (${date.toLocaleDateString("ko-KR", {
    weekday: "short",
  })}) ${date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })}`;

export default function Home() {
  const [borrowers, setBorrowers] = React.useState<Borrower[]>([]);
  const [phones, setPhones] = React.useState<PhoneStateMap>(
    createDefaultPhoneStates
  );
  const [hydrated, setHydrated] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(() => new Date());

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
      onClientError?: (message: string) => void
    ) => {
      setBusy(true);
      const seq = ++seqRef.current;
      try {
        applyIfNewer(seq, await action());
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
    },
    []
  );


  const openPhoneDialog = React.useCallback(
    (phoneId: PhoneId, mode: "borrow" | "manage") => {
      setSelectedPhoneId(phoneId);
      setPhoneDialogMode(mode);
      // Default selection is computed once on open; polling must not reset it.
      setSelectedBorrowerId(
        defaultBorrowerId(mode, ensurePhoneState(phones, phoneId), borrowers)
      );
      setPhoneDialogOpen(true);
    },
    [borrowers, phones]
  );

  const closePhoneDialog = React.useCallback(() => {
    setPhoneDialogOpen(false);
    setPhoneDialogMode(null);
    setSelectedPhoneId(null);
    setSelectedBorrowerId(null);
    setBorrowerQuery("");
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
          borrowers
        )
      : null;

  const handleStartLoan = async () => {
    if (!selectedPhoneId || !effectiveSelectedBorrowerId) return;
    const phoneId = selectedPhoneId;
    const borrowerId = effectiveSelectedBorrowerId;
    closePhoneDialog();
    await runAction(() => api.borrow(phoneId, borrowerId));
  };

  const handleTransferLoan = async () => {
    if (!selectedPhoneId || !effectiveSelectedBorrowerId) return;
    const phoneId = selectedPhoneId;
    const borrowerId = effectiveSelectedBorrowerId;
    closePhoneDialog();
    await runAction(() => api.transfer(phoneId, borrowerId));
  };

  const handleManualReturn = () => {
    if (!selectedPhoneId) return;
    const targetPhoneId = selectedPhoneId;
    closePhoneDialog();
    setReturnConfirmPhoneId(targetPhoneId);
  };

  const finalizeReturn = async () => {
    if (!returnConfirmPhoneId) return;
    const phoneId = returnConfirmPhoneId;
    setReturnConfirmPhoneId(null);
    await runAction(() => api.returnPhone(phoneId));
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

  const query = borrowerQuery.trim();
  // 검색해도 이미 선택한 대여자는 목록에서 사라지지 않게 남겨 둔다.
  const visibleBorrowers = query
    ? borrowers.filter(
        (borrower) =>
          borrower.name.includes(query) ||
          borrower.organization.includes(query) ||
          borrower.id === effectiveSelectedBorrowerId
      )
    : borrowers;

  const currentDialogPhone = selectedPhoneId
    ? ensurePhoneState(phones, selectedPhoneId)
    : null;

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">
            전능아이티 테스트폰 이력관리
          </h1>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            {offline && (
              <span className="rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground">
                서버 연결 끊김
              </span>
            )}
            <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
              {formatClock(currentTime)}
            </span>
          </div>
        </div>
        <div className="rounded-md bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-300 lg:flex lg:gap-6">
          <p>테스트폰 비밀번호 · 네자리 0727 · 여섯자리 000000 · 패턴 2489</p>
          <p>오른쪽에 있는 종이는 쓰지 않으셔도 됩니다. 구시대의 유물입니다.</p>
        </div>
        <MotivationBanner messages={bannerMessages} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Button
            variant="link"
            size="sm"
            className="justify-start px-0 text-xs text-muted-foreground underline-offset-4 hover:text-primary"
            onClick={() => setBannerDialogOpen(true)}
            disabled={offline}
          >
            롤링 배너 관리
          </Button>
          <Button
            variant="link"
            size="sm"
            className="justify-start px-0 text-xs text-muted-foreground underline-offset-4 hover:text-primary"
            onClick={() => setBorrowerDialogOpen(true)}
            disabled={offline}
          >
            대여자 등록하기
          </Button>
          <span className="text-xs text-muted-foreground">
            대여 규칙 · 반드시 대여 신청 후 가져가고, 반납할 땐 반납하기 버튼을 눌러주세요.
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {PHONE_GROUPS.map((group) => (
          <section key={group.platform} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {PLATFORM_LABELS[group.platform]} {group.phones.length}대 ·{" "}
              <span className="text-emerald-400">
                대여 가능{" "}
                {
                  group.phones.filter(
                    (phone) =>
                      ensurePhoneState(phones, phone.id).status !== "borrowed"
                  ).length
                }
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {group.phones.map((phone) => {
                  const state = ensurePhoneState(phones, phone.id);
                  const isBorrowed = state.status === "borrowed" && state.currentLoan;
                  const borrower = getBorrower(state.currentLoan?.borrowerId);
                  const lastBorrower = getBorrower(state.lastReturn?.borrowerId);
                  const days = loanDays(state.currentLoan?.borrowedAt, currentTime);
                  const imageSize =
                    phone.imageSize ??
                    ({ width: 360, height: 360, displayHeight: 176 } as {
                      width: number;
                      height: number;
                      displayHeight?: number;
                    });
                  const displayHeight =
                    imageSize.displayHeight !== undefined
                      ? imageSize.displayHeight
                      : 176;

                  return (
                    <button
                      key={phone.id}
                      type="button"
                      disabled={offline}
                      onClick={() =>
                        openPhoneDialog(phone.id, isBorrowed ? "manage" : "borrow")
                      }
                      className={cn(
                        "group flex h-full flex-col rounded-xl border-2 p-3 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isBorrowed
                          ? cn(loanTone(days), "hover:border-red-400")
                          : "border-emerald-500/50 bg-emerald-500/10 hover:border-emerald-400"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-semibold leading-tight">
                            {phone.label}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {phone.model} · {phone.color}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                            isBorrowed
                              ? "border-red-400/60 bg-red-950/60 text-red-200"
                              : "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                          )}
                        >
                          {isBorrowed ? loanLabel(days) : "대여 가능"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-1 items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                          {isBorrowed ? (
                            <>
                              <div>
                                <p className="text-[11px] text-muted-foreground">
                                  대여자
                                </p>
                                <p className="text-sm font-semibold">
                                  {borrower ? borrower.name : "삭제된 대여자"}
                                </p>
                                {borrower && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {borrower.organization}
                                  </p>
                                )}
                              </div>
                              <div>
                                <p className="text-[11px] text-muted-foreground">
                                  대여 시작
                                </p>
                                <p className="whitespace-nowrap text-xs font-medium">
                                  {formatCardDateTime(state.currentLoan?.borrowedAt)}
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="rounded-lg bg-black/20 p-2">
                                <p className="text-[11px] text-muted-foreground">
                                  마지막 반납
                                </p>
                                <p className="whitespace-nowrap text-xs font-medium">
                                  {state.lastReturn
                                    ? formatCardDateTime(state.lastReturn.returnedAt)
                                    : "기록 없음"}
                                </p>
                                {state.lastReturn && (
                                  <p className="text-[11px] text-muted-foreground">
                                    {lastBorrower
                                      ? `${lastBorrower.name} · ${lastBorrower.organization}`
                                      : "삭제된 대여자"}
                                  </p>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex-shrink-0">
                          <Image
                            src={phone.image}
                            alt={`${phone.model} ${phone.color}`}
                            width={imageSize.width}
                            height={imageSize.height}
                            className="h-[calc(var(--phone-img-h)*0.5)] w-auto max-w-[30vw] object-contain md:max-w-[76px]"
                            style={
                              {
                                "--phone-img-h": `${displayHeight}px`,
                              } as React.CSSProperties
                            }
                          />
                        </div>
                      </div>
                    </button>
                  );
              })}
            </div>
          </section>
        ))}
      </div>

      <Dialog
        open={phoneDialogOpen}
        onOpenChange={(open) => !open && closePhoneDialog()}
      >
        <DialogContent className="max-w-3xl sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {phoneDialogMode === "manage"
                ? `${currentDialogPhone?.id.toUpperCase()} 대여 관리`
                : `${currentDialogPhone?.id.toUpperCase()} 대여하기`}
            </DialogTitle>
            <DialogDescription>
              {phoneDialogMode === "manage"
                ? "대여 중인 정보를 확인하고 반납 또는 대여자 변경을 진행하세요."
                : "대여자를 선택해 대여를 시작합니다."}
            </DialogDescription>
          </DialogHeader>

          {phoneDialogMode === "manage" && currentDialogPhone?.currentLoan && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">현재 대여자</p>
                <p className="text-base font-semibold">
                  {(() => {
                    const borrower = getBorrower(
                      currentDialogPhone.currentLoan?.borrowerId
                    );
                    return borrower
                      ? `${borrower.name} · ${borrower.organization}`
                      : "삭제된 대여자";
                  })()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">대여 시작</p>
                <p>
                  {formatDateTime(currentDialogPhone.currentLoan.borrowedAt)}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="borrower-search">대여자 선택</Label>
              <Input
                id="borrower-search"
                type="search"
                value={borrowerQuery}
                onChange={(event) => setBorrowerQuery(event.target.value)}
                placeholder="이름 또는 팀 검색"
                className="h-8 max-w-[12rem] text-sm"
              />
            </div>
            <div className="max-h-[50dvh] overflow-y-auto rounded-xl border p-2 sm:max-h-[480px] sm:p-4">
              {borrowers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  먼저 대여자를 등록해야 대여를 진행할 수 있습니다.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                  {visibleBorrowers.length === 0 && (
                    <p className="col-span-full text-sm text-muted-foreground">
                      검색 결과가 없습니다.
                    </p>
                  )}
                  {visibleBorrowers.map((borrower) => (
                    <button
                      key={borrower.id}
                      type="button"
                      onClick={() => setSelectedBorrowerId(borrower.id)}
                      className={cn(
                        "flex h-full flex-col justify-between rounded-lg border p-2.5 text-left shadow-sm transition sm:p-3",
                        effectiveSelectedBorrowerId === borrower.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "hover:border-primary/60"
                      )}
                    >
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          {borrower.organization}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {borrower.name}
                        </p>
                      </div>
                      {effectiveSelectedBorrowerId === borrower.id && (
                        <span className="mt-2 text-[10px] font-semibold uppercase text-primary">
                          선택됨
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closePhoneDialog}>
              닫기
            </Button>
            {phoneDialogMode === "manage" ? (
              <>
                <Button
                  variant="secondary"
                  onClick={handleTransferLoan}
                  disabled={
                    offline ||
                    busy ||
                    !effectiveSelectedBorrowerId ||
                    effectiveSelectedBorrowerId ===
                      currentDialogPhone?.currentLoan?.borrowerId
                  }
                >
                  대여자 변경
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleManualReturn}
                  disabled={offline || busy}
                >
                  반납하기
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
                대여 시작
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
            <DialogTitle>롤링 배너 관리</DialogTitle>
            <DialogDescription>
              최대 5개까지 표시되고, 새 문구를 추가하면 가장 오래된 문구가 내려갑니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ul className="space-y-1.5">
              {bannerMessages.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  등록된 문구가 없습니다.
                </li>
              )}
              {bannerMessages.map((message) => (
                <li
                  key={message}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate">{message}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => runAction(() => api.deleteBanner(message))}
                    disabled={offline || busy}
                  >
                    삭제
                  </Button>
                </li>
              ))}
            </ul>
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

      <Dialog
        open={returnConfirmPhoneId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReturnConfirmPhoneId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>충전기 연결 확인</DialogTitle>
            <DialogDescription>
              반납 전에 충전기를 연결했는지 확인해 주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="font-medium">충전기를 연결하셨나요?</p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setReturnConfirmPhoneId(null)}
            >
              아직이에요
            </Button>
            <Button onClick={finalizeReturn} disabled={offline || busy}>
              충전 완료
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
