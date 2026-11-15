import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Person } from "@/shared/types";

const { readMembers } = vi.hoisted(() => ({ readMembers: vi.fn() }));
vi.mock("@/server/database", () => ({
  rows: readMembers,
  row: vi.fn(),
  execute: vi.fn(),
  transaction: async (action: () => unknown) => action(),
}));
vi.mock("@/server/auth", () => ({
  auth: {},
  ready: vi.fn(),
  appOrigin: "http://127.0.0.1:3100",
}));
import { spaceTransaction, type Context } from "@/server/http";

const person = (id: string): Person => ({
  id,
  name: id,
  timeZone: "UTC",
  color: "#416B67",
  availableFrom: 18,
  availableTo: 22,
});
const ctx: Context = {
  account: {
    id: "a",
    name: "Alex",
    email: "alex@example.test",
    spaceId: "space",
    isDemo: false,
  },
  spaceId: "space",
  me: person("a"),
  members: [person("a"), person("Z")],
};
beforeEach(() => {
  readMembers.mockReset();
});

describe("membership checks across database collations", () => {
  it.each([
    ["a", "Z"],
    ["Z", "a"],
  ])(
    "accepts the same members in database order %j, %j",
    async (first, second) => {
      readMembers.mockResolvedValue([{ user_id: first }, { user_id: second }]);
      await expect(spaceTransaction(ctx, () => "saved")).resolves.toBe("saved");
    },
  );
  it("still rejects a changed partner before running the mutation", async () => {
    readMembers.mockResolvedValue([{ user_id: "a" }, { user_id: "b" }]);
    const mutation = vi.fn();
    await expect(spaceTransaction(ctx, mutation)).rejects.toMatchObject({
      status: 409,
    });
    expect(mutation).not.toHaveBeenCalled();
  });
  it("still rejects an account that left the space", async () => {
    readMembers.mockResolvedValue([{ user_id: "Z" }]);
    const mutation = vi.fn();
    await expect(spaceTransaction(ctx, mutation)).rejects.toMatchObject({
      status: 403,
    });
    expect(mutation).not.toHaveBeenCalled();
  });
});
