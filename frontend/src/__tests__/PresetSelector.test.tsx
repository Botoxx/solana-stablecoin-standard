import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PresetSelector } from "../components/create/PresetSelector";
import { Presets } from "../lib/constants";

describe("PresetSelector", () => {
  it("renders SSS-1 and SSS-2 options", () => {
    render(<PresetSelector value={Presets.SSS_1} onChange={() => {}} />);
    expect(screen.getByText("SSS-1")).toBeInTheDocument();
    expect(screen.getByText("SSS-2")).toBeInTheDocument();
  });

  it("shows Minimal and Compliant tags", () => {
    render(<PresetSelector value={Presets.SSS_1} onChange={() => {}} />);
    expect(screen.getByText("Minimal")).toBeInTheDocument();
    expect(screen.getByText("Compliant")).toBeInTheDocument();
  });

  it("calls onChange when clicking SSS-2", async () => {
    const onChange = vi.fn();
    render(<PresetSelector value={Presets.SSS_1} onChange={onChange} />);
    await userEvent.click(screen.getByText("SSS-2"));
    expect(onChange).toHaveBeenCalledWith(Presets.SSS_2);
  });

  it("lists SSS-2 features including Token seizure", () => {
    render(<PresetSelector value={Presets.SSS_2} onChange={() => {}} />);
    expect(screen.getByText("Token seizure (freeze-before-seize)")).toBeInTheDocument();
  });
});
