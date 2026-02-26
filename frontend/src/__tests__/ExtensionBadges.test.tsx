import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExtensionBadges } from "../components/dashboard/ExtensionBadges";

describe("ExtensionBadges", () => {
  it("renders all three badges", () => {
    render(
      <ExtensionBadges permanentDelegate={false} transferHook={false} defaultAccountFrozen={false} />,
    );
    expect(screen.getByText("Permanent Delegate")).toBeInTheDocument();
    expect(screen.getByText("Transfer Hook")).toBeInTheDocument();
    expect(screen.getByText("Default Frozen")).toBeInTheDocument();
  });

  it("active badges use success styling", () => {
    render(
      <ExtensionBadges permanentDelegate={true} transferHook={true} defaultAccountFrozen={false} />,
    );
    const pd = screen.getByText("Permanent Delegate");
    expect(pd.className).toContain("pill-success");
    const th = screen.getByText("Transfer Hook");
    expect(th.className).toContain("pill-success");
    const df = screen.getByText("Default Frozen");
    expect(df.className).toContain("pill-neutral");
  });
});
