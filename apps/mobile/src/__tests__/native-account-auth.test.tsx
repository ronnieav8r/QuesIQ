import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ router: { push: mockPush, replace: mockReplace } }));
jest.mock("lucide-react-native", () => ({ LockKeyhole: () => null, UserPlus: () => null }));
jest.mock("react-native-safe-area-context", () => { const { View: MockView } = require("react-native"); return { SafeAreaView: (props: object) => <MockView {...props} /> }; });
jest.mock("react-native/Libraries/Components/Keyboard/KeyboardAvoidingView", () => { const { View: MockView } = require("react-native"); return { __esModule: true, default: (props: object) => <MockView {...props} /> }; });
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ ready: false, tokens: null, signInEmail: jest.fn(), signInDev: jest.fn() }) }));

import SignInScreen from "../app/sign-in";
import CreateAccountScreen from "../app/create-account";
import ForgotPasswordScreen from "../app/forgot-password";

beforeEach(() => {
  jest.clearAllMocks();
  (router as unknown as { push: typeof mockPush; replace: typeof mockReplace }).push = mockPush;
  (router as unknown as { push: typeof mockPush; replace: typeof mockReplace }).replace = mockReplace;
});

test("sign-in exposes account creation and password recovery links", async () => {
  const screen = await render(<SignInScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Create an account" }));
  await fireEvent.press(screen.getByRole("button", { name: "Forgot password?" }));
  expect(mockPush).toHaveBeenNthCalledWith(1, "/create-account");
  expect(mockPush).toHaveBeenNthCalledWith(2, "/forgot-password");
});

test("create account rejects mismatched passwords before making a request", async () => {
  const fetchMock = jest.spyOn(global, "fetch");
  const screen = await render(<CreateAccountScreen />);
  await fireEvent.changeText(screen.getByLabelText("Email"), "riley@example.test");
  await fireEvent.changeText(screen.getByLabelText("Password"), "password-one");
  await fireEvent.changeText(screen.getByLabelText("Confirm password"), "password-two");
  await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
  expect(screen.getByRole("alert").props.children).toBe("Passwords do not match.");
  expect(fetchMock).not.toHaveBeenCalled();
});

test("create account posts all fields and keeps the user on email verification", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Verification email sent." }), { status: 200, headers: { "Content-Type": "application/json" } }));
  const screen = await render(<CreateAccountScreen />);
  await fireEvent.changeText(screen.getByLabelText("First name (optional)"), "Riley");
  await fireEvent.changeText(screen.getByLabelText("Email"), "riley@example.test");
  await fireEvent.changeText(screen.getByLabelText("Password"), "password-one");
  await fireEvent.changeText(screen.getByLabelText("Confirm password"), "password-one");
  await fireEvent.press(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() => expect(screen.getByText(/Check your inbox/)).toBeTruthy());
  const registerCall = fetchMock.mock.calls[0];
  expect(registerCall[0]).toEqual(expect.stringContaining("/api/mobile/v1/interview/auth/register"));
  expect(registerCall[1]).toEqual(expect.objectContaining({ method: "POST" }));
  expect(JSON.parse(String(registerCall[1]?.body))).toEqual({ confirmPassword: "password-one", email: "riley@example.test", firstName: "Riley", password: "password-one" });
  expect(mockReplace).not.toHaveBeenCalledWith("/(tabs)/home");
  await fireEvent.press(screen.getByRole("button", { name: "Resend verification email" }));
  expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("/api/mobile/v1/interview/auth/resend-verification"), expect.anything());
});

test("forgot password posts the email and displays structured API errors", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { code: "rate_limited", message: "Please wait before trying again." } }), { status: 429, headers: { "Content-Type": "application/json" } }));
  const screen = await render(<ForgotPasswordScreen />);
  await fireEvent.changeText(screen.getByLabelText("Email"), "riley@example.test");
  await fireEvent.press(screen.getByRole("button", { name: "Email reset link" }));
  await waitFor(() => expect(screen.getByRole("alert").props.children).toBe("Please wait before trying again."));
});

test("forgot password displays the success message without navigating", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "Reset email sent." }), { status: 200, headers: { "Content-Type": "application/json" } }));
  const screen = await render(<ForgotPasswordScreen />);
  await fireEvent.changeText(screen.getByLabelText("Email"), "riley@example.test");
  await fireEvent.press(screen.getByRole("button", { name: "Email reset link" }));
  await waitFor(() => expect(screen.getByText(/Reset email sent\. Check your inbox/)).toBeTruthy());
  expect(mockReplace).not.toHaveBeenCalled();
});
