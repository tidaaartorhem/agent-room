import { describe, it, expect } from "vitest";
import { ticketKey } from "@/lib/tickets";

describe("ticketKey", () => {
  it("derives a short uppercase key from a task id", () => {
    expect(ticketKey("task_1a2b3c0000000001")).toBe("TKT-1A2B3C");
  });
  it("falls back safely for odd ids", () => {
    expect(ticketKey("task_")).toBe("TKT-000000");
    expect(ticketKey("")).toBe("TKT-000000");
  });
  it("is stable for the same id", () => {
    expect(ticketKey("task_abcdef1234567890")).toBe(ticketKey("task_abcdef1234567890"));
  });
});
