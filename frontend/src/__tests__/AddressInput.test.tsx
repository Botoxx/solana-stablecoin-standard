import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddressInput } from "../components/shared/AddressInput";
import { useState } from "react";

/** Wrapper that tracks value state so controlled input works correctly */
function Harness({ initial = "", onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <AddressInput
      label="Addr"
      value={value}
      onChange={(v) => { setValue(v); onChange?.(v); }}
    />
  );
}

describe("AddressInput", () => {
  it("renders label and input", () => {
    render(<AddressInput label="Test Label" value="" onChange={() => {}} />);
    expect(screen.getByText("Test Label")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Base58 address...")).toBeInTheDocument();
  });

  it("calls onChange on input", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByPlaceholderText("Base58 address...");
    await userEvent.type(input, "abc");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("shows error for invalid base58", async () => {
    render(<Harness initial="not-a-valid-address!!!" />);
    const input = screen.getByPlaceholderText("Base58 address...");
    await userEvent.clear(input);
    await userEvent.type(input, "xyz");
    expect(screen.getByText("Invalid address")).toBeInTheDocument();
  });

  it("no error for valid pubkey", async () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("Base58 address...");
    // Type system program address — valid base58 pubkey
    await userEvent.type(input, "11111111111111111111111111111111");
    expect(screen.queryByText("Invalid address")).not.toBeInTheDocument();
  });

  it("uses custom placeholder", () => {
    render(<AddressInput label="Addr" value="" onChange={() => {}} placeholder="Enter PDA..." />);
    expect(screen.getByPlaceholderText("Enter PDA...")).toBeInTheDocument();
  });
});
