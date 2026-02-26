import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../components/shared/EmptyState";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders children", () => {
    render(<EmptyState title="Test"><span>Extra content</span></EmptyState>);
    expect(screen.getByText("Extra content")).toBeInTheDocument();
  });

  it("renders without children", () => {
    const { container } = render(<EmptyState title="Solo" />);
    expect(container.querySelector("div")).not.toBeNull();
  });
});
