import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { Alert } from "react-native";

import MeScreen from "../app/(tabs)/me";

const targetA = { id: "11111111-1111-4111-8111-111111111111", targetRole: "Pilot", targetCompany: "Northstar", jobDescription: "Fly safely", label: "Pilot at Northstar", createdAt: "2026-09-01", updatedAt: "2026-09-01" };
const targetB = { id: "22222222-2222-4222-8222-222222222222", targetRole: "Captain", targetCompany: "Skyway", jobDescription: "Lead crews", label: "Captain at Skyway", createdAt: "2026-09-01", updatedAt: "2026-09-01" };
const preparation: any = { profile: { preferredName: "Pat", targetRole: "", targetCompany: "", jobDescription: "", preparationRevision: 4 }, revision: 4, targets: [targetA, targetB] };
const mockFetch = jest.fn<any>(); const mockInvalidate = jest.fn(); const mockSetQuery = jest.fn();
const mockQueryState: any = { data: preparation, isError: false, isFetching: false, isLoading: false, refetch: jest.fn() }; const mockPicker = jest.fn<any>();
const mockUser: { id: string; name: string; email: string } = { id: "u", name: "Pat", email: "pat@example.com" };

jest.mock("expo-document-picker", () => ({ getDocumentAsync: (...args: unknown[]) => mockPicker(...args) }));
jest.mock("expo-file-system", () => ({ Paths: { cache: { uri: "file:///cache/" } }, File: class { delete = jest.fn(); constructor(_: string) {} } }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("expo-router", () => ({ router: { replace: jest.fn() }, useNavigation: () => ({ addListener: () => jest.fn(), dispatch: jest.fn() }) }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => mockQueryState, useQueryClient: () => ({ clear: jest.fn(), invalidateQueries: mockInvalidate, setQueryData: mockSetQuery }) }));
jest.mock("@/lib/bootstrap", () => ({ bootstrapQueryKey: ["bootstrap"], useBootstrap: () => ({ data: { profile: preparation.profile, user: { id: "u", name: "Pat", email: "pat@example.com" } }, isLoading: false }) }));
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ fetchWithAuth: mockFetch, signOut: jest.fn(), user: mockUser }) }));
jest.mock("@/components/ui/screen", () => { const { View } = require("react-native"); return { Screen: ({ children }: any) => <View>{children}</View> }; });
jest.mock("@/components/ui/card", () => { const { Text, View } = require("react-native"); return { Card: ({ children, title }: any) => <View><Text>{title}</Text>{children}</View> }; });
jest.mock("@/components/ui/states", () => { const { Text } = require("react-native"); return { ErrorState: ({ message }: any) => <Text>{message}</Text>, LoadingState: () => <Text>Loading</Text> }; });
jest.mock("@/components/ui/button", () => { const { Pressable, Text } = require("react-native"); return { Button: ({ disabled, label, loading, onPress }: any) => <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress}><Text>{label}</Text></Pressable> }; });

function response(value: unknown, ok = true, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }); }
beforeEach(() => { cleanup(); jest.clearAllMocks(); mockQueryState.data = preparation; mockQueryState.isError = false; mockQueryState.isLoading = false; mockQueryState.isFetching = false; mockUser.id = "u"; mockUser.name = "Pat"; mockUser.email = "pat@example.com"; preparation.profile = { preferredName: "Pat", targetRole: "", targetCompany: "", jobDescription: "", preparationRevision: 4 }; preparation.revision = 4; preparation.targets = [targetA, targetB]; mockFetch.mockResolvedValue(response(preparation)); jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => buttons?.find((button) => button.style === "destructive")?.onPress?.()); });

test("saves the independent preferred name with the preparation revision", async () => {
  const screen = await render(<MeScreen />); await act(async () => { fireEvent.changeText(screen.getByLabelText("Preferred name"), "Avery"); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Save name" })); });
  expect(mockFetch).toHaveBeenCalledWith("/api/mobile/v1/interview/preparation", expect.objectContaining({ method: "PUT" }));
  expect(JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body)).toEqual({ revision: 4, change: { action: "name", preferredName: "Avery" } });
});

test("does not silently fall back to the first target, and supports activation and deletion", async () => {
  const screen = await render(<MeScreen />); expect(screen.getAllByRole("button", { name: "Make active" })).toHaveLength(2);
  await act(async () => { fireEvent.press(screen.getAllByRole("button", { name: "Make active" })[1]); });
  expect(JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body).change).toEqual({ action: "target_active", id: targetB.id });
  await act(async () => { fireEvent.press(screen.getAllByRole("button", { name: "Delete" })[0]); });
  expect(JSON.parse((mockFetch.mock.calls[1][1] as { body: string }).body).change).toEqual({ action: "target_delete", id: targetA.id });
});

test("keeps target drafts after a failed save", async () => {
  mockFetch.mockImplementationOnce(() => Promise.reject(new Error("offline")));
  const screen = await render(<MeScreen />); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Add job target" })); }); await act(async () => { fireEvent.changeText(screen.getByLabelText("Target role"), "First Officer"); });
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Create target" })); });
  expect(await screen.findByText("offline")).toBeTruthy(); expect(screen.getByLabelText("Target role").props.value).toBe("First Officer");
});

test("requires a separate review confirmation and retains a failed resume replacement", async () => {
  mockFetch.mockImplementationOnce(() => Promise.reject(new Error("replacement failed")));
  const screen = await render(<MeScreen />); await act(async () => { fireEvent.changeText(screen.getByLabelText("Or paste resume text"), "Real candidate experience"); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Review pasted text" })); });
  expect(screen.getByLabelText("Reviewed resume text")).toBeTruthy(); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Confirm resume" })); });
  expect(await screen.findByText("replacement failed")).toBeTruthy(); expect(screen.getByLabelText("Reviewed resume text").props.value).toBe("Real candidate experience");
});

test("never generates a summary automatically and explicitly accepts or discards a returned draft", async () => {
  preparation.profile = { ...preparation.profile, resumeConfirmedAt: "2026-09-09T00:00:00.000Z", resumeText: "Confirmed facts", resumeName: "resume.txt" };
  const screen = await render(<MeScreen />); expect(mockFetch).not.toHaveBeenCalled();
  mockFetch.mockResolvedValueOnce(response({ draftId: "33333333-3333-4333-8333-333333333333", summary: { keySkills: ["CRM", "Safety"], strongestExperience: "Captain" } }));
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Generate reviewed resume summary" })); });
  expect(await screen.findByText(/key Skills: CRM, Safety/)).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Discard summary" })); });
  expect(mockFetch).toHaveBeenCalledTimes(1);
  mockFetch.mockResolvedValueOnce(response({ draftId: "33333333-3333-4333-8333-333333333333", summary: { keySkills: ["CRM"] } }));
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Generate reviewed resume summary" })); });
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Accept summary" })); });
  expect(JSON.parse((mockFetch.mock.calls[2][1] as { body: string }).body).change).toEqual({ action: "resume_summary_accept", draftId: "33333333-3333-4333-8333-333333333333" });
});

test("resets the Me form when the authenticated account changes", async () => {
  const screen = await render(<MeScreen />); await act(async () => { fireEvent.changeText(screen.getByLabelText("Preferred name"), "Unsaved" ); });
  mockUser.id = "other"; mockUser.name = "Other"; await screen.rerender(<MeScreen />);
  expect(screen.getByLabelText("Preferred name").props.value).toBe("Pat");
});

test("shows a retryable preparation-load error instead of treating an error response as state", async () => {
  mockQueryState.data = undefined; mockQueryState.isError = true;
  const screen = await render(<MeScreen />); expect(screen.getByText("Your preparation could not be loaded.")).toBeTruthy();
});

test("picker failure unlocks the screen and keeps confirmed material", async () => {
  mockPicker.mockRejectedValueOnce(new Error("Picker unavailable"));
  const screen = await render(<MeScreen />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Choose resume file" })); });
  expect(screen.getByText("Picker unavailable")).toBeTruthy();
  expect(mockFetch).not.toHaveBeenCalled();
  await act(async () => { fireEvent.changeText(screen.getByLabelText("Or paste resume text"), "Recovery notes"); fireEvent.press(screen.getByRole("button", { name: "Review pasted text" })); });
  expect(screen.getByLabelText("Or paste resume text").props.editable).toBe(true);
});

test("late picker result after an account switch never uploads to the new account", async () => {
  let finish!: (value: unknown) => void;
  mockPicker.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const screen = await render(<MeScreen />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Choose resume file" })); });
  mockUser.id = "new-account"; await screen.rerender(<MeScreen />);
  await act(async () => { finish({ canceled: false, assets: [{ uri: "file:///cache/late.txt", name: "late.txt", size: 5 }] }); });
  expect(mockFetch).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Reviewed resume text")).toBeNull();
});
