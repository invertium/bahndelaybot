// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AcceptInviteButton } from "./accept-invite-button";

describe("AcceptInviteButton", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows a confirmation after the magic link request succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true })));
    render(<AcceptInviteButton token={"a".repeat(43)} />);

    await userEvent.click(screen.getByRole("button", { name: "Anmeldelink senden" }));

    expect(await screen.findByText(/E-Mail ist unterwegs/)).toBeVisible();
    expect(fetch).toHaveBeenCalledWith("/api/invitations/accept", expect.objectContaining({ method: "POST" }));
  });

  it("renders the server error and offers a retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Einladung ist abgelaufen" }, { status: 410 })));
    render(<AcceptInviteButton token={"a".repeat(43)} />);

    await userEvent.click(screen.getByRole("button", { name: "Anmeldelink senden" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Einladung ist abgelaufen");
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeEnabled();
  });

  it("handles a network failure without leaving the button disabled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<AcceptInviteButton token={"a".repeat(43)} />);

    await userEvent.click(screen.getByRole("button", { name: "Anmeldelink senden" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Netzwerkfehler");
    expect(screen.getByRole("button", { name: "Erneut versuchen" })).toBeEnabled();
  });
});
