// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendInviteButton } from "./resend-invite-button";

describe("ResendInviteButton", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("confirms a successful resend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true })));
    render(<ResendInviteButton invitationId="11111111-1111-4111-8111-111111111111" />);

    await userEvent.click(screen.getByRole("button", { name: "Erneut senden" }));

    expect(await screen.findByText("Gesendet")).toBeVisible();
  });

  it("shows a retryable network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<ResendInviteButton invitationId="11111111-1111-4111-8111-111111111111" />);

    await userEvent.click(screen.getByRole("button", { name: "Erneut senden" }));

    expect(await screen.findByText("Netzwerkfehler")).toBeVisible();
    expect(screen.getByRole("button", { name: "Erneut senden" })).toBeEnabled();
  });
});
