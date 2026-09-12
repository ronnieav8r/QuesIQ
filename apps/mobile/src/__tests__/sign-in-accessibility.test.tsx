import { beforeEach, expect, jest, test } from "@jest/globals";
import { fireEvent, render, waitFor, within } from "@testing-library/react-native";

const mockSignIn = jest.fn<any>();
const mockDev = jest.fn<any>();
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("lucide-react-native", () => ({ LockKeyhole: () => null }));
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ ready: false, tokens: null, signInEmail: mockSignIn, signInDev: mockDev }) }));
jest.mock("react-native-safe-area-context", () => { const { View: MockView } = require("react-native"); return { SafeAreaView: (props: object) => <MockView {...props} /> }; });
jest.mock("react-native/Libraries/Components/Keyboard/KeyboardAvoidingView", () => { const { View: MockView } = require("react-native"); return { __esModule: true, default: (props: object) => <MockView {...props} /> }; });

import SignInScreen from "../app/sign-in";

beforeEach(() => { jest.clearAllMocks(); });

test("keeps populated sign-in inputs named and the submit action in keyboard-aware scroll content", async () => {
  mockSignIn.mockRejectedValueOnce(new Error("Credentials could not be verified. Please try again."));
  const screen = await render(<SignInScreen />);
  expect(mockDev).not.toHaveBeenCalled();
  expect(screen.getByTestId("screen-keyboard").props.enabled).toBe(true);
  await fireEvent.changeText(screen.getByLabelText("Email"), "learner@example.test");
  await fireEvent.changeText(screen.getByLabelText("Password"), "test-password");
  expect(screen.getByLabelText("Email").props.value).toBe("learner@example.test");
  expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  await fireEvent.press(within(screen.getByTestId("screen-scroll")).getByRole("button", { name: "Sign in" }));
  await waitFor(() => expect(screen.getByRole("alert").props.children).toBe("Credentials could not be verified. Please try again."));
  expect(mockSignIn).toHaveBeenCalledWith("learner@example.test", "test-password");
});
