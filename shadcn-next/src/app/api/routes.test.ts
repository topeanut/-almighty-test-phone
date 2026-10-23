import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetStoreForTests } from "@/lib/db";
import { GET as getState } from "@/app/api/state/route";
import { POST as borrow } from "@/app/api/phones/[id]/borrow/route";
import { POST as transfer } from "@/app/api/phones/[id]/transfer/route";
import { POST as returnPhone } from "@/app/api/phones/[id]/return/route";
import { POST as addBorrower } from "@/app/api/borrowers/route";
import { DELETE as deleteBorrower } from "@/app/api/borrowers/[id]/route";
import { POST as addBanner, DELETE as deleteBanner } from "@/app/api/banner/route";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "test-phone-api-"));
  process.env.TEST_PHONE_DB_PATH = path.join(dir, "db.sqlite");
  resetStoreForTests();
});

afterEach(() => {
  resetStoreForTests();
  delete process.env.TEST_PHONE_DB_PATH;
  fs.rmSync(dir, { recursive: true, force: true });
});

const json = (body: unknown) =>
  new Request("http://local/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const del = () => new Request("http://local/x", { method: "DELETE" });

async function expectError(res: Response, status: number) {
  expect(res.status).toBe(status);
  const body = await res.json();
  expect(typeof body.error).toBe("string");
  expect(body.error.length).toBeGreaterThan(0);
}

async function newBorrower(name = "A") {
  const res = await addBorrower(json({ name, organization: "QA" }));
  const body = await res.json();
  return body.borrowers[body.borrowers.length - 1].id as string;
}

describe("API 라우트", () => {
  it("같은 폰 동시 대여 요청은 하나만 성공", async () => {
    const u1 = await newBorrower("A");
    const u2 = await newBorrower("B");
    const results = await Promise.all([
      borrow(json({ borrowerId: u1 }), params("a01")),
      borrow(json({ borrowerId: u2 }), params("a01")),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("GET /api/state", async () => {
    const res = await getState();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phones.a01.status).toBe("available");
  });

  it("대여 → 이관 → 반납 → 대여자 삭제", async () => {
    let res = await addBorrower(json({ name: "A", organization: "QA" }));
    expect(res.status).toBe(200);
    const u1 = (await res.json()).borrowers[0].id;
    res = await addBorrower(json({ name: "B", organization: "QA" }));
    const u2 = (await res.json()).borrowers[1].id;

    res = await borrow(json({ borrowerId: u1 }), params("a01"));
    expect(res.status).toBe(200);

    res = await borrow(json({ borrowerId: u2 }), params("a01"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/대여 중/);

    res = await transfer(json({ borrowerId: u2 }), params("a01"));
    expect(res.status).toBe(200);

    res = await deleteBorrower(del(), params(u2));
    await expectError(res, 409);

    res = await returnPhone(json({}), params("a01"));
    expect(res.status).toBe(200);
    expect((await res.json()).phones.a01.status).toBe("available");

    res = await deleteBorrower(new Request("http://local/x", { method: "DELETE" }), params(u2));
    expect(res.status).toBe(200);
  });

  it("알 수 없는 기기는 404", async () => {
    const res = await borrow(json({ borrowerId: "x" }), params("zzz"));
    await expectError(res, 404);
  });

  it("본문이 JSON이 아니면 400", async () => {
    const res = await addBorrower(
      new Request("http://local/x", { method: "POST", body: "not json" })
    );
    await expectError(res, 400);
  });

  it("borrowerId가 없으면 400", async () => {
    const res = await borrow(json({}), params("a01"));
    await expectError(res, 400);
  });

  it("배너 추가와 빈 값", async () => {
    let res = await addBanner(json({ message: "hi" }));
    expect((await res.json()).bannerMessages).toContain("hi");
    res = await addBanner(json({ message: " " }));
    await expectError(res, 400);
  });

  it("배너 삭제와 없는 배너 404", async () => {
    await addBanner(json({ message: "bye" }));
    const res = await deleteBanner(json({ message: "bye" }));
    expect((await res.json()).bannerMessages).not.toContain("bye");
    await expectError(await deleteBanner(json({ message: "bye" })), 404);
  });

  it("중복 배너는 200이며 중복 추가되지 않는다", async () => {
    await addBanner(json({ message: "hi" }));
    const res = await addBanner(json({ message: "hi" }));
    expect(res.status).toBe(200);
    const msgs: string[] = (await res.json()).bannerMessages;
    expect(msgs.filter((m) => m === "hi")).toHaveLength(1);
  });

  it("존재하지 않는 대여자로 대여/이관은 404", async () => {
    await expectError(await borrow(json({ borrowerId: "nope" }), params("a01")), 404);
    const u = await newBorrower();
    await borrow(json({ borrowerId: u }), params("a01"));
    await expectError(await transfer(json({ borrowerId: "nope" }), params("a01")), 404);
  });

  it("대여 중이 아닌 기기의 이관/반납은 409", async () => {
    const u = await newBorrower();
    await expectError(await transfer(json({ borrowerId: u }), params("a01")), 409);
    await expectError(await returnPhone(json({}), params("a01")), 409);
  });

  it("알 수 없는 기기 반납은 404", async () => {
    await expectError(await returnPhone(json({}), params("zzz")), 404);
  });

  it("알 수 없는 대여자 삭제는 404", async () => {
    await expectError(await deleteBorrower(del(), params("nope")), 404);
  });

  it("대여자 이름 또는 소속이 비면 400", async () => {
    await expectError(await addBorrower(json({ name: " ", organization: "QA" })), 400);
    await expectError(await addBorrower(json({ name: "A", organization: "" })), 400);
    await expectError(await addBorrower(json({})), 400);
  });
});
