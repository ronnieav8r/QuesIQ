import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, within } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { Button } from "./button";
import { Screen } from "./screen";
import { SessionFrame } from "./session-frame";
import { colors, layout } from "@/theme/tokens";
import { interviewColors, interviewLayout, interviewPreviewCssVariables } from "@quesiq/interview-contracts";

jest.mock("react-native-safe-area-context", () => {
  const { View: MockView } = require("react-native");
  return { SafeAreaView: (props: object) => <MockView {...props} /> };
});
jest.mock("react-native/Libraries/Components/Keyboard/KeyboardAvoidingView", () => {
  const { View: MockView } = require("react-native");
  return { __esModule: true, default: (props: object) => <MockView {...props} /> };
});

describe("mobile layout contract", () => {
  it("shares portable design values with the framed test bed", () => {
    expect(colors).toBe(interviewColors);
    expect(layout).toBe(interviewLayout);
    expect(interviewPreviewCssVariables["--preview-cyan"]).toBe(colors.cyan);
    expect(interviewPreviewCssVariables["--preview-bg"]).toBe(colors.background);
  });

  it("lets the tab navigator own its bottom inset and gives forms keyboard handling", async () => {
    const view = await render(<Screen bottomInset={false} keyboardAvoiding title="Me"><Text>Profile</Text></Screen>);
    expect(view.getByTestId("screen-safe-area").props.edges).toEqual(["top", "right", "left"]);
    expect(view.getByTestId("screen-keyboard").props.enabled).toBe(true);
    expect(view.getByTestId("screen-scroll").props.keyboardShouldPersistTaps).toBe("handled");
    expect(view.getByTestId("screen-scroll").props.keyboardDismissMode).toBe("on-drag");
    expect(view.getByRole("header", { name: "Me" })).toBeTruthy();
    await view.rerender(<Screen title="Review"><Text>Saved</Text></Screen>);
    expect(view.getByTestId("screen-safe-area").props.edges).toContain("bottom");
  });

  it("keeps End outside scrolling captions without triggering an action during render", async () => {
    const end = jest.fn();
    const view = await render(<SessionFrame active status="Your turn" timer="02:10" footer={<Button label="End session" onPress={end} />}><Text>Long transcript</Text></SessionFrame>);
    expect(end).not.toHaveBeenCalled();
    expect(within(view.getByTestId("session-content")).queryByText("End session")).toBeNull();
    expect(within(view.getByTestId("session-footer")).getByText("End session")).toBeTruthy();
    expect(view.getByLabelText("Session time 02:10")).toBeTruthy();
    await fireEvent.press(view.getByRole("button", { name: "End session" }));
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("allows primary labels to wrap and exposes busy/disabled state", async () => {
    const view = await render(<Button label="Retry microphone and connection" loading onPress={jest.fn()} />);
    expect(view.getByRole("button").props.accessibilityState).toEqual({ disabled: true, busy: true });
    const label = view.getByText("Retry microphone and connection");
    expect(label.props.numberOfLines).toBeUndefined();
    expect(StyleSheet.flatten(label.props.style).flexShrink).toBe(1);
    expect(layout.primaryHeight).toBeGreaterThanOrEqual(layout.minTouchTarget);
  });
});
