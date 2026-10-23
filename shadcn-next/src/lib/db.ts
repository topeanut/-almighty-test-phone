import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isPhoneId, type PhoneId } from "@/lib/phones";
import { replaceBannedWords } from "@/lib/banned-words";
import { createDefaultPhoneStates } from "@/lib/phone-state";
import type { AppState, Borrower, PhoneState, PhoneStateMap } from "@/lib/types";

export const DEFAULT_BANNER_MESSAGES = [
  "상태 초기화 버그 수정 완료",
  "롤링 배너 구매 문의",
];

export const MAX_BANNERS = 5;

export class StoreError extends Error {
  status: 400 | 404 | 409;
  constructor(status: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "StoreError";
    this.status = status;
  }
}

type BorrowerRow = {
  id: string;
  name: string;
  organization: string;
  created_at: string;
};

type PhoneRow = {
  phone_id: string;
  status: "available" | "borrowed";
  loan_borrower_id: string | null;
  loan_at: string | null;
  return_borrower_id: string | null;
  return_at: string | null;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS borrowers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  organization TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS phone_states (
  phone_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('available','borrowed')),
  loan_borrower_id TEXT,
  loan_at TEXT,
  return_borrower_id TEXT,
  return_at TEXT
);
CREATE TABLE IF NOT EXISTS banner_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
`;

const rowToPhoneState = (row: PhoneRow): PhoneState => {
  const id = row.phone_id as PhoneId;
  const state: PhoneState = { id, status: row.status };
  if (row.status === "borrowed" && row.loan_borrower_id && row.loan_at) {
    state.currentLoan = { borrowerId: row.loan_borrower_id, borrowedAt: row.loan_at };
  }
  if (row.return_borrower_id && row.return_at) {
    state.lastReturn = { borrowerId: row.return_borrower_id, returnedAt: row.return_at };
  }
  return state;
};

const rowToBorrower = (row: BorrowerRow): Borrower => ({
  id: row.id,
  name: row.name,
  organization: row.organization,
  createdAt: row.created_at,
});

export class Store {
  private db: Database.Database;

  constructor(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    // 기본 배너는 DB 파일을 처음 만들 때만 넣는다. 사용자가 배너를 모두 지운 뒤
    // 재시작해도 기본 문구가 되살아나지 않게 하기 위해서다.
    const isNewFile = !fs.existsSync(filePath);
    this.db = new Database(filePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 3000");
    this.db.exec(SCHEMA);
    if (isNewFile) this.seed();
  }

  private seed() {
    const count = this.db
      .prepare("SELECT COUNT(*) AS c FROM banner_messages")
      .get() as { c: number };
    if (count.c > 0) return;
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO banner_messages (message, created_at) VALUES (?, ?)"
    );
    const now = new Date().toISOString();
    for (const message of DEFAULT_BANNER_MESSAGES) insert.run(message, now);
  }

  getState(): AppState {
    const borrowers = (
      this.db.prepare("SELECT * FROM borrowers ORDER BY created_at, rowid").all() as BorrowerRow[]
    ).map(rowToBorrower);

    const phones: PhoneStateMap = createDefaultPhoneStates();
    const rows = this.db.prepare("SELECT * FROM phone_states").all() as PhoneRow[];
    for (const row of rows) {
      if (isPhoneId(row.phone_id)) phones[row.phone_id] = rowToPhoneState(row);
    }

    const bannerMessages = (
      this.db.prepare("SELECT message FROM banner_messages ORDER BY id").all() as {
        message: string;
      }[]
    ).map((r) => r.message);

    return { borrowers, phones, bannerMessages, serverTime: new Date().toISOString() };
  }

  private requirePhoneId(phoneId: string): PhoneId {
    if (!isPhoneId(phoneId)) throw new StoreError(404, "존재하지 않는 기기입니다.");
    return phoneId;
  }

  private requireBorrower(borrowerId: string): BorrowerRow {
    const row = this.db
      .prepare("SELECT * FROM borrowers WHERE id = ?")
      .get(borrowerId) as BorrowerRow | undefined;
    if (!row) throw new StoreError(404, "존재하지 않는 대여자입니다.");
    return row;
  }

  private getPhoneRow(phoneId: PhoneId): PhoneRow | undefined {
    return this.db
      .prepare("SELECT * FROM phone_states WHERE phone_id = ?")
      .get(phoneId) as PhoneRow | undefined;
  }

  borrow(phoneIdRaw: string, borrowerId: string): AppState {
    const phoneId = this.requirePhoneId(phoneIdRaw);
    return this.db.transaction(() => {
      this.requireBorrower(borrowerId);
      const row = this.getPhoneRow(phoneId);
      if (row?.status === "borrowed") {
        throw new StoreError(409, "이미 대여 중인 기기입니다.");
      }
      this.db
        .prepare(
          `INSERT INTO phone_states (phone_id, status, loan_borrower_id, loan_at, return_borrower_id, return_at)
           VALUES (@phone_id, 'borrowed', @borrower, @now, @rb, @ra)
           ON CONFLICT(phone_id) DO UPDATE SET
             status = 'borrowed', loan_borrower_id = @borrower, loan_at = @now`
        )
        .run({
          phone_id: phoneId,
          borrower: borrowerId,
          now: new Date().toISOString(),
          rb: row?.return_borrower_id ?? null,
          ra: row?.return_at ?? null,
        });
      return this.getState();
    })();
  }

  transfer(phoneIdRaw: string, borrowerId: string): AppState {
    const phoneId = this.requirePhoneId(phoneIdRaw);
    return this.db.transaction(() => {
      this.requireBorrower(borrowerId);
      const row = this.getPhoneRow(phoneId);
      if (!row || row.status !== "borrowed") {
        throw new StoreError(409, "대여 중인 기기가 아닙니다.");
      }
      if (row.loan_borrower_id === borrowerId) {
        throw new StoreError(409, "이미 같은 대여자입니다.");
      }
      this.db
        .prepare(
          "UPDATE phone_states SET loan_borrower_id = ?, loan_at = ? WHERE phone_id = ?"
        )
        .run(borrowerId, new Date().toISOString(), phoneId);
      return this.getState();
    })();
  }

  returnPhone(phoneIdRaw: string): AppState {
    const phoneId = this.requirePhoneId(phoneIdRaw);
    return this.db.transaction(() => {
      const row = this.getPhoneRow(phoneId);
      if (!row || row.status !== "borrowed" || !row.loan_borrower_id) {
        throw new StoreError(409, "대여 중인 기기가 아닙니다.");
      }
      this.db
        .prepare(
          `UPDATE phone_states
           SET status = 'available', return_borrower_id = loan_borrower_id, return_at = ?,
               loan_borrower_id = NULL, loan_at = NULL
           WHERE phone_id = ?`
        )
        .run(new Date().toISOString(), phoneId);
      return this.getState();
    })();
  }

  addBorrower(nameRaw: string, organizationRaw: string): AppState {
    const name = nameRaw.trim();
    const organization = organizationRaw.trim();
    if (!name || !organization) {
      throw new StoreError(400, "이름과 소속을 모두 입력해 주세요.");
    }
    this.db
      .prepare(
        "INSERT INTO borrowers (id, name, organization, created_at) VALUES (?, ?, ?, ?)"
      )
      .run(crypto.randomUUID(), name, organization, new Date().toISOString());
    return this.getState();
  }

  deleteBorrower(borrowerId: string): AppState {
    return this.db.transaction(() => {
      this.requireBorrower(borrowerId);
      const inUse = this.db
        .prepare(
          "SELECT 1 FROM phone_states WHERE status = 'borrowed' AND loan_borrower_id = ?"
        )
        .get(borrowerId);
      if (inUse) throw new StoreError(409, "대여 중인 대여자는 삭제할 수 없습니다.");
      this.db.prepare("DELETE FROM borrowers WHERE id = ?").run(borrowerId);
      return this.getState();
    })();
  }

  addBanner(messageRaw: string): AppState {
    const message = replaceBannedWords(messageRaw.trim());
    if (!message) throw new StoreError(400, "배너 문구를 입력해 주세요.");
    return this.db.transaction(() => {
      this.db
        .prepare("INSERT OR IGNORE INTO banner_messages (message, created_at) VALUES (?, ?)")
        .run(message, new Date().toISOString());
      // 최신 MAX_BANNERS개만 남기고 오래된 배너부터 내린다.
      this.db
        .prepare(
          "DELETE FROM banner_messages WHERE id NOT IN (SELECT id FROM banner_messages ORDER BY id DESC LIMIT ?)"
        )
        .run(MAX_BANNERS);
      return this.getState();
    })();
  }

  deleteBanner(message: string): AppState {
    const result = this.db
      .prepare("DELETE FROM banner_messages WHERE message = ?")
      .run(message);
    if (result.changes === 0) throw new StoreError(404, "이미 삭제된 배너입니다.");
    return this.getState();
  }

  close() {
    this.db.close();
  }
}

const DEFAULT_DB_PATH = path.join(os.homedir(), "test-phone-data", "test-phone.db");

type GlobalWithStore = typeof globalThis & { __testPhoneStore?: Store };

export function getStore(): Store {
  const g = globalThis as GlobalWithStore;
  if (!g.__testPhoneStore) {
    g.__testPhoneStore = new Store(process.env.TEST_PHONE_DB_PATH ?? DEFAULT_DB_PATH);
  }
  return g.__testPhoneStore;
}

export function resetStoreForTests() {
  const g = globalThis as GlobalWithStore;
  g.__testPhoneStore?.close();
  g.__testPhoneStore = undefined;
}
