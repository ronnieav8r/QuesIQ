import { act, fireEvent, render } from "@testing-library/react-native";
import { beforeEach, expect, jest, test } from "@jest/globals";

import HomeScreen from "../app/(tabs)/home";
import MeScreen from "../app/(tabs)/me";
import { router } from "expo-router";

const mockBootstrapState: { data: any; error?: Error; isLoading: boolean; isError?: boolean } = { data: undefined, isLoading: false };
const mockRefetch = jest.fn();
const mockRequest = jest.fn<any>();
const mockInvalidate = jest.fn();
const mockSignOut = jest.fn();

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: jest.fn(), invalidateQueries: mockInvalidate }) }));
jest.mock("@/lib/bootstrap", () => ({ bootstrapQueryKey: ["bootstrap"], useBootstrap: () => ({ ...mockBootstrapState, refetch: mockRefetch }) }));
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ request: mockRequest, signOut: mockSignOut, user: { id: "u", name: "Pat", email: "pat@example.com" } }) }));
jest.mock("@/components/ui/screen", () => { const { View: MockView } = require("react-native"); return { Screen: ({ children }: any) => <MockView>{children}</MockView> }; });
jest.mock("@/components/ui/card", () => { const { Pressable: MockPressable, Text: MockText } = require("react-native"); return { Card: ({ children, onPress, title }: any) => <MockPressable accessibilityLabel={title} accessibilityRole={onPress ? "button" : undefined} onPress={onPress}><MockText>{title}</MockText>{children}</MockPressable> }; });
jest.mock("@/components/ui/states", () => { const { Text: MockText } = require("react-native"); return { ErrorState: ({ message }: any) => <MockText>{message}</MockText>, LoadingState: () => <MockText>Loading</MockText> }; });
jest.mock("@/components/ui/button", () => { const { Pressable: MockPressable, Text: MockText } = require("react-native"); return { Button: ({ disabled, label, loading, onPress }: any) => <MockPressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled || loading} onPress={onPress}><MockText>{label}</MockText></MockPressable> }; });

const target = { id: "target-1", targetRole: "Pilot", targetCompany: "QuesIQ", jobDescription: "Lead", label: "Pilot", createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const base = (sessions: any[] = [], modes: any[] = [{ key: "coaching", name: "Coaching", description: "", questionTypeRequired: false, use: "practice" }, { key: "first_impression", name: "First Impression", description: "", questionTypeRequired: false, use: "practice" }]) => ({ catalog: { practiceModes: modes, interviewStyles: [], questionTypes: [] }, jobTargets: [target], profile: { preferredName: "Pat", targetCompany: "QuesIQ", targetRole: "Pilot", jobDescription: "Lead", jobTargetId: target.id }, sessions, user: { id: "u", name: "Pat" } });

beforeEach(() => { jest.clearAllMocks(); mockBootstrapState.data = base(); mockBootstrapState.error = undefined; mockBootstrapState.isError = false; mockBootstrapState.isLoading = false; mockRequest.mockResolvedValue({ target: { id: target.id } }); });

test("Home shows honest empty state and navigates active target to Me", async () => {
  const screen = await render(<HomeScreen />);
  expect(screen.getByText("Recent sessions")).toBeTruthy();
  expect(screen.getByText("—")).toBeTruthy();
  expect(screen.getByText("Start First Impression")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Active target" }));
  expect(router.push).toHaveBeenCalledWith("/(tabs)/me");
});

test("Home does not render unavailable First Impression action", async () => {
  mockBootstrapState.data = base([], [{ key: "first_impression", name: "First Impression", description: "", questionTypeRequired: false, use: "practice", enabled: false }]);
  const screen = await render(<HomeScreen />);
  expect(screen.queryByText("Start First Impression")).toBeNull();
});

test("Me exposes named fields and does not save during render", async () => {
  const screen = await render(<MeScreen />);
  expect(screen.getByLabelText("Preferred name")).toBeTruthy();
  expect(screen.getByLabelText("Target role")).toBeTruthy();
  expect(screen.getByLabelText("Company")).toBeTruthy();
  expect(screen.getByLabelText("Job description")).toBeTruthy();
  expect(mockRequest).not.toHaveBeenCalled();
});

test("Me reports save success and locks fields while saving", async () => {
  let resolveFirst!: (value: unknown) => void;
  mockRequest.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; })).mockResolvedValueOnce({});
  const screen = await render(<MeScreen />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Save profile" })); });
  expect(screen.getByLabelText("Preferred name").props.editable).toBe(false);
  await act(async () => { resolveFirst({ target: { id: target.id } }); });
  expect(await screen.findByText("Profile saved locally.")).toBeTruthy();
  expect(screen.getByText("Profile saved locally.").props.accessibilityRole).toBe("alert");
});

test("Me reports save errors distinctly and does not claim success", async () => {
  mockRequest.mockRejectedValueOnce(new Error("offline"));
  const screen = await render(<MeScreen />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Save profile" })); });
  expect(await screen.findByText("offline")).toBeTruthy();
  expect(screen.queryByText("Profile saved locally.")).toBeNull();
});

test("Home uses actual recent evaluation and resume status does not invent parsing", async () => {
  mockBootstrapState.data = base([{ id: "review-1", hasEvaluation: true, evaluation: { scores: [{ score: 3 }], nextAction: "Name your personal contribution." } }]);
  const home = await render(<HomeScreen />);
  expect(home.getByText("60%")).toBeTruthy();
  expect(home.getByText("1")).toBeTruthy();
  await fireEvent.press(home.getByRole("button", { name: "Continue your progress" }));
  expect(router.push).toHaveBeenCalledWith("/review/review-1");
  await home.unmount();
  mockBootstrapState.data.profile.resumeName = "sample.pdf";
  const me = await render(<MeScreen />);
  expect(me.getByText("Attached, parsing status unavailable: sample.pdf")).toBeTruthy();
});
