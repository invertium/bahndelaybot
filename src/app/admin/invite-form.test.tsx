// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteForm } from "./invite-form";

describe("InviteForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("submits a normalized browser form and confirms delivery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ id: "invite-1" }, { status: 201 })));
    render(<InviteForm />);

    await userEvent.type(screen.getByLabelText("E-Mail-Adresse"), "person@example.de");
    await userEvent.click(screen.getByRole("button", { name: "Einladen" }));

    expect(await screen.findByText("Einladung versendet.")).toBeVisible();
    expect(screen.getByLabelText("E-Mail-Adresse")).toHaveValue("");
  });

  it("keeps the form usable after a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<InviteForm />);

    await userEvent.type(screen.getByLabelText("E-Mail-Adresse"), "person@example.de");
    await userEvent.click(screen.getByRole("button", { name: "Einladen" }));

    expect(await screen.findByText(/Netzwerkfehler/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Einladen" })).toBeEnabled();
  });
});
