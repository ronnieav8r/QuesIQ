import { act, cleanup, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";
import { beforeEach, expect, jest, test } from "@jest/globals";
import { materialFieldsSchema, materialSaveSchema } from "@quesiq/interview-contracts";
import StoryLab from "../app/(tabs)/story-lab";

const storyId = "11111111-1111-4111-8111-111111111111";
const introId = "33333333-3333-4333-8333-333333333333";
const generatedId = "22222222-2222-4222-8222-222222222222";
const mockFetch = jest.fn<any>(); const mockInvalidate = jest.fn(); const mockSetQuery = jest.fn(); const mockRefetch = jest.fn();
const mockUser: { id: string; name: string; email: string } = { id: "u", name: "Pat", email: "pat@example.com" };
const mockBootstrap: any = { data: { profile: { jobTargetId: "44444444-4444-4444-8444-444444444444" }, user: mockUser }, isLoading: false };
const baseFields = materialFieldsSchema.parse({ title: "Conflict", rawNotes: "Original notes", categories: ["conflict"], practicePrompt: "Tell me about conflict." });
const mockLab: any = { stories: [{ ...baseFields, id: storyId, kind: "story", revision: 1, reviewedAt: null, aiAssisted: false, updatedAt: "2026-09-09T00:00:00.000Z" }], introductions: [] };

jest.mock("expo-crypto", () => ({ randomUUID: () => generatedId }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() }, useNavigation: () => ({ addListener: () => jest.fn(), dispatch: jest.fn() }) }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: mockLab, isLoading: false, isError: false, refetch: mockRefetch }), useQueryClient: () => ({ invalidateQueries: mockInvalidate, setQueryData: mockSetQuery }) }));
jest.mock("@/lib/bootstrap", () => ({ useBootstrap: () => mockBootstrap }));
jest.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: mockUser, fetchWithAuth: mockFetch }) }));
jest.mock("@/components/ui/screen", () => { const { View } = require("react-native"); return { Screen: ({ children }: any) => <View>{children}</View> }; });
jest.mock("@/components/ui/card", () => { const { View, Text } = require("react-native"); return { Card: ({ children, title }: any) => <View><Text>{title}</Text>{children}</View> }; });
jest.mock("@/components/ui/button", () => { const { Pressable, Text } = require("react-native"); return { Button: ({ label, onPress, disabled }: any) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}><Text>{label}</Text></Pressable> }; });
jest.mock("@/components/ui/states", () => ({ LoadingState: () => null, ErrorState: () => null }));

function response(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }); }
function materialFromSave(body: any) { const parsed = materialSaveSchema.parse(body); return { ...parsed.fields, id: parsed.id, kind: parsed.kind, revision: parsed.revision + 1, reviewedAt: parsed.reviewed ? "2026-09-09T00:00:00.000Z" : null, aiAssisted: parsed.aiAssisted, updatedAt: "2026-09-09T00:00:00.000Z" }; }

beforeEach(() => {
  cleanup(); jest.clearAllMocks(); mockUser.id = "u"; mockUser.name = "Pat";
  mockLab.stories = [{ ...baseFields, id: storyId, kind: "story", revision: 1, reviewedAt: null, aiAssisted: false, updatedAt: "2026-09-09T00:00:00.000Z" }]; mockLab.introductions = [];
  mockBootstrap.data = { profile: { jobTargetId: "44444444-4444-4444-8444-444444444444" }, user: mockUser };
  mockFetch.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === "PUT" ? response(materialFromSave(JSON.parse(String(init.body)))) : response({}));
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => buttons?.find(button => button.style === "destructive")?.onPress?.());
});

test("manual save validates the full material payload and never calls AI", async () => {
  const screen = await render(<StoryLab />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Add story" })); }); await act(async () => { fireEvent.changeText(screen.getByLabelText("Title"), "My story"); }); await act(async () => { fireEvent.changeText(screen.getByLabelText("Original notes"), "Facts from my actual experience"); }); await act(async () => { fireEvent.changeText(screen.getByLabelText("Actions (one per line)"), "Checked the facts\nExplained the tradeoff"); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Leadership" })); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "I reviewed this material" })); });
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Save reviewed material" })); });
  expect(mockFetch).toHaveBeenCalledTimes(1); const [path, init] = mockFetch.mock.calls[0] as [string, RequestInit]; expect(path).toBe("/api/mobile/v1/interview/story-lab"); expect(init.method).toBe("PUT");
  const body = JSON.parse(String(init.body)); expect(materialSaveSchema.parse(body).fields).toEqual(expect.objectContaining({ title: "My story", rawNotes: "Facts from my actual experience", actions: ["Checked the facts", "Explained the tradeoff"], categories: ["leadership"] })); expect(screen.queryByLabelText("Title")).toBeNull();
});

test("draft generation sends the bootstrap target and acceptance preserves original notes", async () => {
  mockFetch.mockImplementation(async (_path: string, init?: RequestInit) => init?.method === "POST" ? response({ fields: { title: "Proposed", rawNotes: "invented notes", practicePrompt: "Use the facts", categories: ["leadership"] } }) : response({}));
  const screen = await render(<StoryLab />); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Add story" })); }); await act(async () => { fireEvent.changeText(screen.getByLabelText("Title"), "Candidate story"); }); await act(async () => { fireEvent.changeText(screen.getByLabelText("Original notes"), "Candidate supplied facts"); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Help me draft" })); });
  const draftCall = mockFetch.mock.calls.find(([path]) => String(path).endsWith("/draft")); expect(draftCall).toBeTruthy(); expect(JSON.parse(String((draftCall?.[1] as RequestInit).body))).toEqual(expect.objectContaining({ targetId: mockBootstrap.data.profile.jobTargetId, id: generatedId }));
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Accept draft" })); }); expect(screen.getByLabelText("Original notes").props.value).toBe("Candidate supplied facts"); expect(screen.getByLabelText("Title").props.value).toBe("Proposed");
});

test("rejects an invalid proposed draft without changing the editor", async () => {
  mockFetch.mockResolvedValue(response({ fields: { title: "", rawNotes: "changed" } })); const screen = await render(<StoryLab />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Add story" })); }); await act(async () => { fireEvent.changeText(screen.getByLabelText("Title"), "Candidate story"); }); await act(async () => { fireEvent.changeText(screen.getByLabelText("Original notes"), "Keep these facts"); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Help me draft" })); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Accept draft" })); });
  expect(screen.getByRole("alert")).toBeTruthy(); expect(screen.getByLabelText("Original notes").props.value).toBe("Keep these facts"); expect(screen.getByLabelText("Title").props.value).toBe("Candidate story");
});

test("failed save keeps fields and retries with the same client material ID", async () => {
  let attempts = 0; mockFetch.mockImplementation(async (_path: string, init?: RequestInit) => { if (init?.method === "PUT") { attempts++; if (attempts === 1) throw new Error("offline"); return response(materialFromSave(JSON.parse(String(init.body)))); } return response({}); });
  const screen = await render(<StoryLab />); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Add story" })); }); await act(async () => { fireEvent.changeText(screen.getByLabelText("Title"), "Retry story"); }); await act(async () => { fireEvent.changeText(screen.getByLabelText("Original notes"), "Retry facts"); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "I reviewed this material" })); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Save reviewed material" })); });
  expect(screen.getByText("offline")).toBeTruthy(); expect(screen.getByLabelText("Original notes").props.value).toBe("Retry facts"); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Save reviewed material" })); });
  const ids = mockFetch.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PUT").map(([, init]) => JSON.parse(String((init as RequestInit).body)).id); expect(ids).toEqual([generatedId, generatedId]);
});

test("introduction practice does not require a practice question", async () => {
  mockLab.introductions = [{ ...materialFieldsSchema.parse({ title: "Opening", rawNotes: "Background", script: "I am a pilot." }), id: introId, kind: "introduction", revision: 1, reviewedAt: "2026-09-09T00:00:00.000Z", aiAssisted: false, updatedAt: "2026-09-09T00:00:00.000Z" }]; const screen = await render(<StoryLab />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Introductions" })); }); expect(screen.getByText("Opening")).toBeTruthy(); expect(screen.getByRole("button", { name: "Practice this introduction" })).toBeTruthy(); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Edit" })); }); expect(screen.queryByLabelText("Reviewed practice question")).toBeNull();
});

test("changing authenticated accounts remounts and clears the editor", async () => {
  const screen = await render(<StoryLab />); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Add story" })); }); await act(async () => { fireEvent.changeText(screen.getByLabelText("Title"), "Unsaved"); }); mockUser.id = "other"; await screen.rerender(<StoryLab />); expect(screen.queryByLabelText("Title")).toBeNull(); expect(screen.getByRole("button", { name: "Add story" })).toBeTruthy();
});

test("canceling discard preserves the unsaved editor", async () => {
  const alert = Alert.alert as jest.Mock; alert.mockImplementationOnce((...args: any[]) => (args[2] as any[])?.find((button: any) => button.text === "Keep editing")?.onPress?.()); const screen = await render(<StoryLab />);
  await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Add story" })); }); await act(async () => { fireEvent.changeText(screen.getByLabelText("Title"), "Keep me"); }); await act(async () => { fireEvent.press(screen.getByRole("button", { name: "Stories" })); }); expect(screen.getByLabelText("Title").props.value).toBe("Keep me");
});
