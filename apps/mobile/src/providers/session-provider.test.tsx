import { useEffect } from "react";
import { expect, jest, test } from "@jest/globals";
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";
import type { SessionSetupSnapshot } from "@quesiq/interview-contracts";
import { SessionProvider, useActiveSession } from "./session-provider";
let mockUser: { id: string } | undefined = { id: "a" };
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: mockUser }) }));
let sessionContext!: ReturnType<typeof useActiveSession>;
function Probe() { const context = useActiveSession(); useEffect(() => { sessionContext = context; }, [context]); return <Text>{context.activeSession?.id ?? "none"}</Text>; }
test("account switching removes active capture state and cannot revive it on sign-in", async () => {
  const screen = await render(<SessionProvider><Probe /></SessionProvider>);
  await act(() => sessionContext.setActiveSession({ id: "session-a", snapshot: {} as SessionSetupSnapshot }));
  expect(screen.getByText("session-a")).toBeTruthy();
  mockUser = { id: "b" }; await screen.rerender(<SessionProvider><Probe /></SessionProvider>);
  expect(screen.getByText("none")).toBeTruthy();
  mockUser = { id: "a" }; await screen.rerender(<SessionProvider><Probe /></SessionProvider>);
  expect(screen.getByText("none")).toBeTruthy();
});
