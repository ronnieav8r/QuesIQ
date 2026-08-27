import { fireEvent, render } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";

import { Button } from "./button";

describe("Button", () => {
  it("runs its primary action", async () => {
    const onPress = jest.fn();
    const view = await render(<Button label="Start live practice" onPress={onPress} />);
    await fireEvent.press(view.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("blocks actions while loading", async () => {
    const onPress = jest.fn();
    const view = await render(<Button label="Saving" loading onPress={onPress} />);
    await fireEvent.press(view.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
