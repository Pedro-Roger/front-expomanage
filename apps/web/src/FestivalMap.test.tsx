import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Stand } from "@expomanage/shared";
import { FestivalMap } from "./FestivalMap";

function businessStands(quantity: number): Stand[] {
  return Array.from({ length: quantity }, (_, index) => ({
    id: `stand-n-${index + 1}`,
    code: `N-${String(index + 1).padStart(2, "0")}`,
    size: "3x3",
    status: "available",
    type: "Feira de Negócios"
  }));
}

describe("FestivalMap", () => {
  it("distributes any odd business stand quantity between balanced columns", () => {
    render(
      <FestivalMap
        stands={businessStands(7)}
        mode="public"
        onStandClick={vi.fn()}
      />
    );

    expect(
      within(screen.getByLabelText("Coluna esquerda da Feira de Negócios")).getAllByRole("button")
    ).toHaveLength(4);
    expect(
      within(screen.getByLabelText("Coluna direita da Feira de Negócios")).getAllByRole("button")
    ).toHaveLength(3);
  });

  it("distributes an even business stand quantity equally", () => {
    render(
      <FestivalMap
        stands={businessStands(6)}
        mode="public"
        onStandClick={vi.fn()}
      />
    );

    expect(
      within(screen.getByLabelText("Coluna esquerda da Feira de Negócios")).getAllByRole("button")
    ).toHaveLength(3);
    expect(
      within(screen.getByLabelText("Coluna direita da Feira de Negócios")).getAllByRole("button")
    ).toHaveLength(3);
  });
});
