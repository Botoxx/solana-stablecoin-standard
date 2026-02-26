import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNetwork } from "../hooks/useNetwork";

describe("useNetwork", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to devnet", () => {
    const { result } = renderHook(() => useNetwork());
    expect(result.current.network).toBe("devnet");
  });

  it("returns devnet endpoint by default", () => {
    const { result } = renderHook(() => useNetwork());
    expect(result.current.endpoint).toContain("devnet");
  });

  it("switches to localnet", () => {
    const { result } = renderHook(() => useNetwork());
    act(() => result.current.setNetwork("localnet"));
    expect(result.current.network).toBe("localnet");
    expect(result.current.endpoint).toBe("http://127.0.0.1:8899");
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useNetwork());
    act(() => result.current.setNetwork("mainnet-beta"));
    expect(localStorage.getItem("sss-network")).toBe("mainnet-beta");
  });

  it("loads from localStorage", () => {
    localStorage.setItem("sss-network", "localnet");
    const { result } = renderHook(() => useNetwork());
    expect(result.current.network).toBe("localnet");
  });

  it("ignores invalid localStorage values", () => {
    localStorage.setItem("sss-network", "invalid-network");
    const { result } = renderHook(() => useNetwork());
    expect(result.current.network).toBe("devnet");
  });
});
