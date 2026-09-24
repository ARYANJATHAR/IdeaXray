import { vi } from "vitest";
vi.mock("server-only", () => ({}));
// Tests must never contact paid providers. Individual tests mock the relevant SDK/provider.
vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request in regression tests"); }));
