import { getStore } from "@/lib/db";
import { handle, readJson } from "@/lib/api-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<{ message: string }>(req);
    return getStore().addBanner(String(body.message ?? ""));
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const body = await readJson<{ message: string }>(req);
    return getStore().deleteBanner(String(body.message ?? ""));
  });
}
