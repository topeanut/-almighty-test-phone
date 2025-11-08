"use client";

import * as React from "react";
import Image from "next/image";

import { MotivationBanner } from "@/components/motivation-banner";
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

const PHONES = [
  {
    id: "a01",
    label: "A01",
    platform: "android",
    model: "갤럭시 S8",
    color: "미드나이트 블랙",
    image: "/devices/a01-s8.avif",
  },
  {
    id: "a02",
    label: "A02",
    platform: "android",
    model: "갤럭시 S9",
    color: "선라이즈 골드",
    image: "/devices/a02-s9.jpg",
  },
  {
    id: "a03",
    label: "A03",
    platform: "android",
    model: "갤럭시 S10 5G",
    color: "크라운 골드",
    image: "/devices/a03-s10.jpg",
  },
  {
    id: "a04",
    label: "A04",
    platform: "android",
    model: "LG V50 ThinQ",
    color: "아스트로 블랙",
    image: "/devices/a04-v50.webp",
  },
  {
    id: "i01",
    label: "I01",
    platform: "ios",
    model: "아이폰 SE",
    color: "PRODUCT(RED)",
    image: "/devices/i01_se1.jpeg",
  },
  {
    id: "i02",
    label: "I02",
    platform: "ios",
    model: "아이폰 X",
    color: "스페이스 그레이",
    image: "/devices/i02-X.webp",
  },
  {
    id: "i03",
    label: "I03",
    platform: "ios",
    model: "아이폰 12 mini",
    color: "블랙",
    image: "/devices/i03-12mini.avif",
  },
] as const;

type PhoneDefinition = (typeof PHONES)[number];
type PhoneId = PhoneDefinition["id"];
type Platform = PhoneDefinition["platform"];

type GridItem = { type: "phone"; phoneId: PhoneId } | { type: "borrower-card" };

const GRID_LAYOUT: GridItem[] = [
  { type: "phone", phoneId: "a01" },
  { type: "phone", phoneId: "i01" },
  { type: "phone", phoneId: "a02" },
  { type: "phone", phoneId: "i02" },
  { type: "phone", phoneId: "a03" },
  { type: "phone", phoneId: "i03" },
  { type: "phone", phoneId: "a04" },
  { type: "borrower-card" },
];

const PHONE_BY_ID: Record<PhoneId, PhoneDefinition> = PHONES.reduce(
  (acc, phone) => {
    acc[phone.id] = phone;
    return acc;
  },
  {} as Record<PhoneId, PhoneDefinition>
);

type Borrower = {
  id: string;
  name: string;
  organization: string;
  createdAt: string;
};

type LoanInfo = {
  borrowerId: string;
  borrowedAt: string;
};

type ReturnInfo = {
  borrowerId: string;
  returnedAt: string;
};

type PhoneState = {
  id: PhoneId;
  status: "available" | "borrowed";
  currentLoan?: LoanInfo;
  lastReturn?: ReturnInfo;
};

type PhoneStateMap = Record<PhoneId, PhoneState>;

type BorrowerOrgOption = "프론트엔드팀" | "백엔드팀" | "QA" | "기타";

const BORROWERS_STORAGE_KEY = "test-phone-borrowers";
const PHONE_STORAGE_KEY = "test-phone-statuses";
const BORROWER_ORG_OPTIONS: BorrowerOrgOption[] = [
  "프론트엔드팀",
  "백엔드팀",
  "QA",
  "기타",
];
const MOTIVATION_MESSAGES = [
  "상태 초기화 버그 수정 완료",
  "롤링 배너 구매 문의",
];

const PLATFORM_LABELS: Record<Platform, string> = {
  android: "안드로이드",
  ios: "아이폰",
};

const createDefaultPhoneStates = (): PhoneStateMap => {
  const map = {} as PhoneStateMap;
  for (const phone of PHONES) {
    map[phone.id] = { id: phone.id, status: "available" };
  }
  return map;
};

const sanitizePhoneStates = (raw: unknown): PhoneStateMap => {
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

const formatClock = (date: Date) =>
  date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const ensurePhoneState = (map: PhoneStateMap, phoneId: PhoneId) =>
  map[phoneId] ?? { id: phoneId, status: "available" };

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

  const [borrowerDialogOpen, setBorrowerDialogOpen] = React.useState(false);
  const [borrowerName, setBorrowerName] = React.useState("");
  const [borrowerOrgOption, setBorrowerOrgOption] =
    React.useState<BorrowerOrgOption>("프론트엔드팀");
  const [borrowerOrgCustom, setBorrowerOrgCustom] = React.useState("");
  const [borrowerError, setBorrowerError] = React.useState<string | null>(null);
  const [returnConfirmPhoneId, setReturnConfirmPhoneId] =
    React.useState<PhoneId | null>(null);

  const openPhoneDialog = React.useCallback(
    (phoneId: PhoneId, mode: "borrow" | "manage") => {
      setSelectedPhoneId(phoneId);
      setPhoneDialogMode(mode);
      setPhoneDialogOpen(true);
    },
    []
  );

  const closePhoneDialog = React.useCallback(() => {
    setPhoneDialogOpen(false);
    setPhoneDialogMode(null);
    setSelectedPhoneId(null);
    setSelectedBorrowerId(null);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedBorrowers = window.localStorage.getItem(
        BORROWERS_STORAGE_KEY
      );
      if (storedBorrowers) {
        const parsed = JSON.parse(storedBorrowers) as Borrower[];
        if (Array.isArray(parsed)) {
          setBorrowers(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load borrowers", error);
    }

    try {
      const storedPhones = window.localStorage.getItem(PHONE_STORAGE_KEY);
      if (storedPhones) {
        const parsed = JSON.parse(storedPhones);
        setPhones(sanitizePhoneStates(parsed));
      }
    } catch (error) {
      console.error("Failed to load phone statuses", error);
    }

    setHydrated(true);
    setCurrentTime(new Date());
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    const id = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);
    return () => window.clearInterval(id);
  }, [hydrated]);

  React.useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      BORROWERS_STORAGE_KEY,
      JSON.stringify(borrowers)
    );
  }, [borrowers, hydrated]);

  React.useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(PHONE_STORAGE_KEY, JSON.stringify(phones));
  }, [phones, hydrated]);

  React.useEffect(() => {
    if (!phoneDialogOpen || !selectedPhoneId) {
      setSelectedBorrowerId(null);
      return;
    }
    const phoneState = ensurePhoneState(phones, selectedPhoneId);
    if (phoneDialogMode === "manage" && phoneState.currentLoan) {
      setSelectedBorrowerId(phoneState.currentLoan.borrowerId);
      return;
    }
    if (phoneDialogMode === "borrow" && borrowers.length > 0) {
      setSelectedBorrowerId(borrowers[0].id);
      return;
    }
    setSelectedBorrowerId(null);
  }, [borrowers, phoneDialogMode, phoneDialogOpen, phones, selectedPhoneId]);

  const handleStartLoan = () => {
    if (!selectedPhoneId || !selectedBorrowerId) return;
    setPhones((prev) => {
      const next = { ...prev };
      const current = ensurePhoneState(prev, selectedPhoneId);
      next[selectedPhoneId] = {
        id: selectedPhoneId,
        status: "borrowed",
        currentLoan: {
          borrowerId: selectedBorrowerId,
          borrowedAt: new Date().toISOString(),
        },
        lastReturn: current.lastReturn,
      };
      return next;
    });
    closePhoneDialog();
  };

  const handleTransferLoan = () => {
    if (!selectedPhoneId || !selectedBorrowerId) return;
    setPhones((prev) => {
      const current = ensurePhoneState(prev, selectedPhoneId);
      if (current.status !== "borrowed" || !current.currentLoan) return prev;
      if (current.currentLoan.borrowerId === selectedBorrowerId) return prev;
      return {
        ...prev,
        [selectedPhoneId]: {
          ...current,
          status: "borrowed",
          currentLoan: {
            borrowerId: selectedBorrowerId,
            borrowedAt: new Date().toISOString(),
          },
        },
      };
    });
    closePhoneDialog();
  };

  const handleReturnLoan = (phoneId: PhoneId, returnedAt?: string) => {
    setPhones((prev) => {
      const current = ensurePhoneState(prev, phoneId);
      const borrowerId = current.currentLoan?.borrowerId;
      const next: PhoneState = {
        id: phoneId,
        status: "available",
        lastReturn: borrowerId
          ? {
              borrowerId,
              returnedAt: returnedAt ?? new Date().toISOString(),
            }
          : current.lastReturn,
      };
      return {
        ...prev,
        [phoneId]: next,
      };
    });
  };

  const handleManualReturn = () => {
    if (!selectedPhoneId) return;
    const targetPhoneId = selectedPhoneId;
    closePhoneDialog();
    setReturnConfirmPhoneId(targetPhoneId);
  };

  const finalizeReturn = () => {
    if (!returnConfirmPhoneId) return;
    handleReturnLoan(returnConfirmPhoneId);
    setReturnConfirmPhoneId(null);
  };

  const handleAddBorrower = () => {
    const name = borrowerName.trim();
    const organization =
      borrowerOrgOption === "기타"
        ? borrowerOrgCustom.trim()
        : borrowerOrgOption;
    if (!name || !organization) {
      setBorrowerError("이름과 소속을 모두 입력해 주세요.");
      return;
    }
    const newBorrower: Borrower = {
      id: crypto.randomUUID(),
      name,
      organization,
      createdAt: new Date().toISOString(),
    };
    setBorrowers((prev) => [...prev, newBorrower]);
    setBorrowerName("");
    setBorrowerOrgOption("프론트엔드팀");
    setBorrowerOrgCustom("");
    setBorrowerError(null);
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

  const handleDeleteBorrower = (borrowerId: string) => {
    if (isBorrowerInUse(borrowerId)) {
      setBorrowerError("대여 중인 대여자는 삭제할 수 없습니다.");
      return;
    }
    setBorrowers((prev) =>
      prev.filter((borrower) => borrower.id !== borrowerId)
    );
    setBorrowerError(null);
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

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">
            전능아이티 테스트폰 이력관리
          </h1>
          <MotivationBanner messages={MOTIVATION_MESSAGES} />
        </div>
        <span className="text-sm text-muted-foreground">
          현재 시각 {formatClock(currentTime)}
        </span>
      </header>

      <section className="grid grid-cols-2 grid-rows-4 gap-6">
        {GRID_LAYOUT.map((item) => {
          if (item.type === "phone") {
            const phone = PHONE_BY_ID[item.phoneId];
            if (!phone) return null;
            const state = ensurePhoneState(phones, phone.id);
            const isBorrowed = state.status === "borrowed" && state.currentLoan;
            const borrower = getBorrower(state.currentLoan?.borrowerId);
            const lastBorrower = getBorrower(state.lastReturn?.borrowerId);

            return (
              <button
                key={phone.id}
                type="button"
                onClick={() =>
                  openPhoneDialog(phone.id, isBorrowed ? "manage" : "borrow")
                }
                className="group flex h-full flex-col rounded-xl border p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {PLATFORM_LABELS[phone.platform]}
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold">
                      {phone.label}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {phone.model} · {phone.color}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                      isBorrowed
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-sky-200 bg-sky-100 text-sky-600"
                    )}
                  >
                    {isBorrowed ? "대여 중" : "대여 가능"}
                  </span>
                </div>

                <div className="mt-4 flex flex-1 items-center justify-center">
                  <div className="relative h-40 w-20 sm:h-44 sm:w-24">
                    <Image
                      src={phone.image}
                      alt={`${phone.model} ${phone.color}`}
                      fill
                      sizes="(max-width: 640px) 80px, 96px"
                      className="object-contain drop-shadow-md"
                    />
                  </div>
                </div>

                <div className="mt-4 flex-1 space-y-2.5 text-sm">
                  {isBorrowed ? (
                    <>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          대여자
                        </p>
                        <p className="text-sm font-semibold">
                          {borrower
                            ? `${borrower.name} · ${borrower.organization}`
                            : "삭제된 대여자"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">
                          대여 시작
                        </p>
                        <p>{formatDateTime(state.currentLoan?.borrowedAt)}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-primary">
                        탭하여 대여자를 선택하세요
                      </p>
                      <div className="rounded-lg bg-muted/40 p-2.5">
                        <p className="text-[11px] text-muted-foreground">
                          마지막 반납
                        </p>
                        <p className="text-xs font-medium sm:text-sm">
                          {state.lastReturn
                            ? formatDateTime(state.lastReturn.returnedAt)
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

                <p className="mt-4 text-[11px] text-muted-foreground">
                  {isBorrowed
                    ? "누르면 반납하거나 대여자를 변경할 수 있어요."
                    : "누르면 대여자를 선택해 대여할 수 있어요."}
                </p>
              </button>
            );
          }

          return (
            <div
              key="borrower-card"
              className="flex h-full flex-col justify-between rounded-xl border p-5 shadow-sm"
            >
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">대여자 관리</h2>
                <p className="text-sm text-muted-foreground">
                  대여 가능 인원을 등록하고 관리하세요.
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => setBorrowerDialogOpen(true)}
                >
                  대여자 등록하기
                </Button>

                <div className="space-y-1.5 text-xs sm:text-sm">
                  <p className="font-semibold">대여 규칙</p>
                  <p>· 반드시 대여를 신청하고 대여한다.</p>
                  <p>· 반납 시에는 직접 반납하기 버튼을 눌러 처리한다.</p>
                </div>
              </div>
            </div>
          );
        })}
      </section>

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
            <Label>대여자 선택</Label>
            <div className="max-h-[480px] overflow-y-auto rounded-xl border p-4">
              {borrowers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  먼저 대여자를 등록해야 대여를 진행할 수 있습니다.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {borrowers.map((borrower) => (
                    <button
                      key={borrower.id}
                      type="button"
                      onClick={() => setSelectedBorrowerId(borrower.id)}
                      className={cn(
                        "flex h-full flex-col justify-between rounded-lg border p-3 text-left shadow-sm transition",
                        selectedBorrowerId === borrower.id
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
                      {selectedBorrowerId === borrower.id && (
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
                    !selectedBorrowerId ||
                    selectedBorrowerId ===
                      currentDialogPhone?.currentLoan?.borrowerId
                  }
                >
                  대여자 변경
                </Button>
                <Button variant="destructive" onClick={handleManualReturn}>
                  반납하기
                </Button>
              </>
            ) : (
              <Button
                onClick={handleStartLoan}
                disabled={!selectedBorrowerId || borrowers.length === 0}
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
              <Button type="button" onClick={handleAddBorrower}>
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
                          disabled={inUse}
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
            <Button onClick={finalizeReturn}>충전 완료</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
