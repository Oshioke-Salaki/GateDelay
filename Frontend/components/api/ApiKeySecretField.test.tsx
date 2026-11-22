import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiKeySecretField from "./ApiKeySecretField";
import ApiKeyRevokeDialog from "./ApiKeyRevokeDialog";
import { API_KEY_SCOPE_COPY } from "../../lib/apiKeyDisplay";

const SECRET = "gdk_super_secret_value_do_not_leak";

describe("ApiKeySecretField", () => {
  it("masks the secret by default", () => {
    render(
      <ApiKeySecretField
        name="Production"
        secret={SECRET}
        prefix="gdk_super"
        maskedKey="gdk_super••••••••••••••"
      />,
    );

    const field = screen.getByTestId("api-key-secret");
    expect(field).toHaveTextContent("gdk_super••••••••••••••");
    expect(field).not.toHaveTextContent(SECRET);
    expect(screen.getByText(/full secret is shown only/i)).toBeInTheDocument();
  });

  it("reveals the secret only after an explicit action", async () => {
    const user = userEvent.setup();
    render(
      <ApiKeySecretField
        name="Production"
        secret={SECRET}
        prefix="gdk_super"
        maskedKey="gdk_super••••••••••••••"
      />,
    );

    await user.click(screen.getByRole("button", { name: /reveal/i }));
    expect(screen.getByTestId("api-key-secret")).toHaveTextContent(SECRET);
  });
});

describe("ApiKeyRevokeDialog", () => {
  it("requires confirmation before revoke", () => {
    render(
      <ApiKeyRevokeDialog
        keyName="Production"
        maskedSecret="gdk_super••••"
        state="confirm"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByRole("dialog", { name: /revoke api key/i })).toBeInTheDocument();
    expect(screen.getByTestId("confirm-revoke")).toBeInTheDocument();
    expect(screen.queryByTestId("revoke-success")).not.toBeInTheDocument();
  });

  it("shows a pending state while revoking", () => {
    render(
      <ApiKeyRevokeDialog
        keyName="Production"
        maskedSecret="gdk_super••••"
        state="revoking"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByTestId("revoke-pending")).toHaveTextContent(/revoking production/i);
  });

  it("shows a revoked confirmation state", () => {
    render(
      <ApiKeyRevokeDialog
        keyName="Production"
        maskedSecret="gdk_super••••"
        state="revoked"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByTestId("revoke-success")).toHaveTextContent(/has been revoked/i);
  });

  it("explains key scope in product copy used by the management page", () => {
    expect(API_KEY_SCOPE_COPY).toMatch(/scopes granted at creation/i);
    expect(API_KEY_SCOPE_COPY).toMatch(/revoked key/i);
  });
});
