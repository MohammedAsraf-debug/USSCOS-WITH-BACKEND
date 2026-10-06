// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Navbar from "@/components/public/Navbar.jsx";

function renderNav() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Navbar />
              <div>HOME PAGE</div>
            </>
          }
        />
        <Route path="/events" element={<div>EVENTS PAGE</div>} />
        <Route path="/news" element={<div>NEWS PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Navbar navigation", () => {
  it("shows an Events link pointing to the public events page", () => {
    renderNav();

    expect(screen.getByRole("link", { name: "Events" })).toHaveAttribute("href", "/events");
  });

  it("navigates to /events when the Events link is clicked", () => {
    renderNav();

    fireEvent.click(screen.getByRole("link", { name: "Events" }));

    expect(screen.getByText("EVENTS PAGE")).toBeInTheDocument();
  });
});