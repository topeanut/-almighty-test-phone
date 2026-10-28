import { describe, expect, it } from "vitest";
import {
  defaultBorrowerId,
  resolveSelectedBorrowerId,
} from "@/lib/dialog-selection";
import type { Borrower, PhoneState } from "@/lib/types";

const b = (id: string): Borrower => ({
  id,
  name: `name-${id}`,
  organization: "QA",
  createdAt: "2026-10-14T00:00:00.000Z",
});

const available: PhoneState = { id: "a01", status: "available" };
const borrowedBy = (borrowerId: string): PhoneState => ({
  id: "a01",
  status: "borrowed",
  currentLoan: { borrowerId, borrowedAt: "2026-10-14T00:00:00.000Z" },
});

describe("defaultBorrowerId", () => {
  it("borrow mode starts with nobody selected", () => {
    expect(defaultBorrowerId("borrow", available, [b("a"), b("b")])).toBeNull();
  });
  it("borrow mode starts with the remembered borrower", () => {
    expect(defaultBorrowerId("borrow", available, [b("a"), b("b")], "b")).toBe("b");
  });
  it("borrow mode ignores a remembered borrower that was deleted", () => {
    expect(defaultBorrowerId("borrow", available, [b("a")], "gone")).toBeNull();
  });
  it("manage mode ignores the remembered borrower", () => {
    expect(defaultBorrowerId("manage", borrowedBy("a"), [b("a"), b("b")], "b")).toBe("a");
  });
  it("borrow mode with no borrowers is null", () => {
    expect(defaultBorrowerId("borrow", available, [])).toBeNull();
  });
  it("manage mode picks the current borrower", () => {
    expect(defaultBorrowerId("manage", borrowedBy("b"), [b("a"), b("b")])).toBe("b");
  });
  it("manage mode without a current loan is null", () => {
    expect(defaultBorrowerId("manage", available, [b("a")])).toBeNull();
  });
  it("no mode or phone is null", () => {
    expect(defaultBorrowerId(null, available, [b("a")])).toBeNull();
    expect(defaultBorrowerId("borrow", null, [b("a")])).toBeNull();
  });
});

describe("resolveSelectedBorrowerId", () => {
  it("keeps the selection when borrowers is replaced by an equal-content array", () => {
    const first = [b("a"), b("b"), b("c")];
    const polled = first.map((x) => ({ ...x }));
    expect(resolveSelectedBorrowerId("c", "borrow", available, polled)).toBe("c");
    expect(
      resolveSelectedBorrowerId("c", "manage", borrowedBy("a"), polled)
    ).toBe("c");
  });

  it("keeps the selection when another borrower is added", () => {
    const polled = [b("z"), b("a"), b("b"), b("c")];
    expect(resolveSelectedBorrowerId("b", "borrow", available, polled)).toBe("b");
    expect(
      resolveSelectedBorrowerId("b", "manage", borrowedBy("a"), polled)
    ).toBe("b");
  });

  it("clears the selection in borrow mode when the selected borrower was deleted", () => {
    expect(
      resolveSelectedBorrowerId("c", "borrow", available, [b("a"), b("b")])
    ).toBeNull();
    expect(resolveSelectedBorrowerId("c", "borrow", available, [])).toBeNull();
  });

  it("falls back to the current borrower in manage mode when the selection was deleted", () => {
    expect(
      resolveSelectedBorrowerId("c", "manage", borrowedBy("b"), [b("a"), b("b")])
    ).toBe("b");
    expect(
      resolveSelectedBorrowerId("c", "manage", available, [b("a"), b("b")])
    ).toBeNull();
  });

  it("uses the default when nothing is selected yet", () => {
    expect(resolveSelectedBorrowerId(null, "borrow", available, [b("a")])).toBeNull();
    expect(resolveSelectedBorrowerId(null, "borrow", available, [b("a")], "a")).toBe("a");
  });
});
