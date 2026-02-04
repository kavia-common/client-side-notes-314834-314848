import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders header and add note button", () => {
  render(<App />);
  expect(screen.getByText("Notes")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /\+ add note/i }).length).toBeGreaterThanOrEqual(1);
});
