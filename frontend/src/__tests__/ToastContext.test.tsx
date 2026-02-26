import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { FC, ReactNode } from "react";
import { ToastProvider, useToast } from "../context/ToastContext";

const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
  <ToastProvider network="devnet">{children}</ToastProvider>
);

describe("ToastContext", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("starts with no toasts", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("adds a toast", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.addToast("success", "Done!"));
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe("Done!");
    expect(result.current.toasts[0].type).toBe("success");
  });

  it("adds toast with signature", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.addToast("success", "Tx sent", "abc123"));
    expect(result.current.toasts[0].signature).toBe("abc123");
  });

  it("removes a toast", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    let id = "";
    act(() => { id = result.current.addToast("info", "Test"); });
    expect(result.current.toasts).toHaveLength(1);
    act(() => result.current.removeToast(id));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("updates a toast", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    let id = "";
    act(() => { id = result.current.addToast("loading", "Pending..."); });
    act(() => result.current.updateToast(id, { type: "success", message: "Done!" }));
    expect(result.current.toasts[0].type).toBe("success");
    expect(result.current.toasts[0].message).toBe("Done!");
  });

  it("auto-dismisses non-loading toasts after 6s", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.addToast("success", "Flash"));
    expect(result.current.toasts).toHaveLength(1);
    act(() => vi.advanceTimersByTime(6001));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("does NOT auto-dismiss loading toasts", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.addToast("loading", "Working..."));
    act(() => vi.advanceTimersByTime(10000));
    expect(result.current.toasts).toHaveLength(1);
  });

  it("exposes network", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(result.current.network).toBe("devnet");
  });
});
