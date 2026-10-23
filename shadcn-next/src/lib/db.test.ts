import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_BANNER_MESSAGES, Store, StoreError } from "@/lib/db";
import { PHONES } from "@/lib/phones";

let dir: string;
let store: Store;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "test-phone-"));
  store = new Store(path.join(dir, "nested", "db.sqlite"));
});

afterEach(() => {
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("Store 읽기", () => {
  it("없는 디렉터리를 만들고 초기 상태를 돌려준다", () => {
    const state = store.getState();
    expect(state.borrowers).toEqual([]);
    expect(Object.keys(state.phones).sort()).toEqual(PHONES.map((p) => p.id).sort());
    expect(state.phones.a01).toEqual({ id: "a01", status: "available" });
    expect(state.bannerMessages).toEqual(DEFAULT_BANNER_MESSAGES);
    expect(Number.isNaN(Date.parse(state.serverTime))).toBe(false);
  });

  it("같은 파일을 다시 열어도 시드가 중복되지 않는다", () => {
    const file = path.join(dir, "again.sqlite");
    const a = new Store(file);
    a.close();
    const b = new Store(file);
    expect(b.getState().bannerMessages).toEqual(DEFAULT_BANNER_MESSAGES);
    b.close();
  });
});

describe("배너 삭제", () => {
  it("지정한 배너만 지운다", () => {
    store.addBanner("지울 문구");
    const state = store.deleteBanner("지울 문구");
    expect(state.bannerMessages).toEqual(DEFAULT_BANNER_MESSAGES);
  });

  it("없는 배너를 지우면 404", () => {
    expect(() => store.deleteBanner("없는 문구")).toThrow(StoreError);
  });

  it("모두 지운 뒤 다시 열어도 기본 문구가 되살아나지 않는다", () => {
    const file = path.join(dir, "empty.sqlite");
    const a = new Store(file);
    for (const m of DEFAULT_BANNER_MESSAGES) a.deleteBanner(m);
    a.close();
    const b = new Store(file);
    expect(b.getState().bannerMessages).toEqual([]);
    b.close();
  });
});

const addUser = (name = "홍길동", org = "QA") => {
  const state = store.addBorrower(name, org);
  return state.borrowers[state.borrowers.length - 1].id;
};

describe("Store 쓰기", () => {
  it("같은 시각에 추가된 대여자도 추가한 순서대로 돌려준다", () => {
    const names = ["가", "나", "다", "라", "마", "바", "사", "아"];
    for (const n of names) store.addBorrower(n, "QA");
    expect(store.getState().borrowers.map((b) => b.name)).toEqual(names);
  });

  it("대여 → 이관 → 반납 흐름", () => {
    const u1 = addUser("A");
    const u2 = addUser("B");

    let s = store.borrow("a01", u1);
    expect(s.phones.a01.status).toBe("borrowed");
    expect(s.phones.a01.currentLoan?.borrowerId).toBe(u1);

    s = store.transfer("a01", u2);
    expect(s.phones.a01.currentLoan?.borrowerId).toBe(u2);

    s = store.returnPhone("a01");
    expect(s.phones.a01.status).toBe("available");
    expect(s.phones.a01.currentLoan).toBeUndefined();
    expect(s.phones.a01.lastReturn?.borrowerId).toBe(u2);
  });

  it("이미 대여 중이면 두 번째 대여는 409이고 첫 대여자가 유지된다", () => {
    const u1 = addUser("A");
    const u2 = addUser("B");
    store.borrow("a01", u1);
    expect(() => store.borrow("a01", u2)).toThrowError(StoreError);
    try {
      store.borrow("a01", u2);
    } catch (e) {
      expect((e as StoreError).status).toBe(409);
    }
    expect(store.getState().phones.a01.currentLoan?.borrowerId).toBe(u1);
  });

  it("알 수 없는 기기는 404이고 행이 생기지 않는다", () => {
    const u1 = addUser();
    expect(() => store.borrow("zzz", u1)).toThrowError(/기기/);
    expect(Object.keys(store.getState().phones)).not.toContain("zzz");
  });

  it("없는 대여자로 대여하면 404", () => {
    try {
      store.borrow("a01", "nope");
      throw new Error("should throw");
    } catch (e) {
      expect((e as StoreError).status).toBe(404);
    }
  });

  it("대여 중이 아닌 기기 이관·반납은 409", () => {
    const u1 = addUser();
    expect(() => store.transfer("a01", u1)).toThrowError(StoreError);
    expect(() => store.returnPhone("a01")).toThrowError(StoreError);
  });

  it("같은 사람에게 이관은 409", () => {
    const u1 = addUser();
    store.borrow("a01", u1);
    expect(() => store.transfer("a01", u1)).toThrowError(StoreError);
  });

  it("공백 이름 대여자 추가는 400이고 DB 변화 없음", () => {
    expect(() => store.addBorrower("   ", "QA")).toThrowError(StoreError);
    expect(store.getState().borrowers).toHaveLength(0);
  });

  it("대여 중인 대여자 삭제는 409, 아니면 삭제", () => {
    const u1 = addUser();
    store.borrow("a01", u1);
    expect(() => store.deleteBorrower(u1)).toThrowError(/대여 중/);
    store.returnPhone("a01");
    const s = store.deleteBorrower(u1);
    expect(s.borrowers).toHaveLength(0);
    expect(s.phones.a01.lastReturn?.borrowerId).toBe(u1);
  });

  it("없는 대여자 삭제는 404", () => {
    expect(() => store.deleteBorrower("nope")).toThrowError(StoreError);
  });

  it("금지어는 하트로 바꿔서 저장한다", () => {
    const state = store.addBanner("담배 끊고 금연 성공");
    expect(state.bannerMessages).toContain("❤️ 끊고 ❤️ 성공");
    expect(state.bannerMessages.some((m) => /담배|금연/.test(m))).toBe(false);
  });

  it("배너는 최신 5개만 남는다", () => {
    let state = store.getState();
    for (let i = 1; i <= 7; i++) state = store.addBanner(`배너 ${i}`);
    expect(state.bannerMessages).toEqual(["배너 3", "배너 4", "배너 5", "배너 6", "배너 7"]);
  });

  it("배너 추가는 중복을 무시하고 빈 값은 400", () => {
    const s1 = store.addBanner("새 문구");
    expect(s1.bannerMessages).toContain("새 문구");
    const s2 = store.addBanner("새 문구");
    expect(s2.bannerMessages.filter((m) => m === "새 문구")).toHaveLength(1);
    expect(() => store.addBanner("  ")).toThrowError(StoreError);
  });

});
