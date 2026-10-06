// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EventsPage from "@/pages/public/EventsPage.jsx";
import EventDetail from "@/pages/public/EventDetail.jsx";
import { usePublicEvents, usePublicEvent, usePublicGallery } from "@/hooks/use-firestore";

vi.mock("@/hooks/use-firestore", () => ({
  usePublicEvents: vi.fn(),
  usePublicEvent: vi.fn(),
  usePublicGallery: vi.fn(),
  useContentBlock: vi.fn(() => ({ data: null })),
}));

const mocked = {
  usePublicEvents: vi.mocked(usePublicEvents),
  usePublicEvent: vi.mocked(usePublicEvent),
  usePublicGallery: vi.mocked(usePublicGallery),
};

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: IntersectionObserverStub,
    writable: true,
  });
});

const ev1 = {
  id: "ev-1",
  slug: "state-championships",
  title: "State Championships 2026",
  type: "informational",
  status: "upcoming",
  date: "2026-03-14T18:30:00Z",
  time: "6:30 PM",
  endTime: null,
  location: "Amateur Boxing Arena",
  description: "The state championships final night.\nTickets at the door.",
  coverImageUrl: null,
  registrationUrl: "https://example.com/register",
  registrationNote: "Registration closes a week before.",
};

const ev2 = {
  id: "ev-2",
  slug: "summer-camp",
  title: "Summer Boxing Camp",
  type: "informational",
  status: "upcoming",
  date: "2026-07-02T09:00:00Z",
  time: "9:00 AM",
  endTime: "4:00 PM",
  location: "USSCOS Training Hall",
  description: "Week-long camp for young boxers.",
  coverImageUrl: null,
  registrationUrl: null,
  registrationNote: null,
};

function renderEvents(initialEntry = "/events") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:eventId" element={<EventDetail />} />
        <Route path="*" element={<div>UNKNOWN PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocked.usePublicEvents.mockReset();
  mocked.usePublicEvent.mockReset();
  mocked.usePublicGallery.mockReset();
  mocked.usePublicGallery.mockReturnValue({ data: [], isLoading: false, isError: false });
});

describe("public events list (/events)", () => {
  it("renders real public events with View Details links", () => {
    mocked.usePublicEvents.mockReturnValue({
      data: [ev1, ev2],
      isLoading: false,
      isError: false,
    });

    renderEvents();

    expect(screen.getByText("State Championships 2026")).toBeInTheDocument();
    expect(screen.getByText("Summer Boxing Camp")).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: /View Details/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/events/ev-1");
    expect(links[1]).toHaveAttribute("href", "/events/ev-2");
  });

  it("shows a loading state while events are being fetched", () => {
    mocked.usePublicEvents.mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
    });

    renderEvents();

    expect(screen.getByRole("status", { name: "Loading events" })).toBeInTheDocument();
  });

  it("shows an empty state when no public events exist", () => {
    mocked.usePublicEvents.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    renderEvents();

    expect(screen.getByText("No events found")).toBeInTheDocument();
    expect(screen.getByText("No events are scheduled right now. Check back soon.")).toBeInTheDocument();
  });
});

describe("event card navigation", () => {
  it("View Details navigates to /events/:eventId and loads the event", async () => {
    mocked.usePublicEvents.mockReturnValue({
      data: [ev1],
      isLoading: false,
      isError: false,
    });
    mocked.usePublicEvent.mockReturnValue({
      data: ev1,
      isLoading: false,
    });

    renderEvents();

    fireEvent.click(screen.getByRole("link", { name: /View Details/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "State Championships 2026" })).toBeInTheDocument();
    });
    expect(screen.getByText("Amateur Boxing Arena")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Register \/ Details/i })).toHaveAttribute(
      "href",
      "https://example.com/register",
    );
  });
});

describe("event detail (/events/:eventId)", () => {
  it("loads and renders the selected event from Firestore", () => {
    mocked.usePublicEvent.mockReturnValue({
      data: ev1,
      isLoading: false,
    });

    renderEvents("/events/ev-1");

    expect(screen.getByRole("heading", { name: "State Championships 2026" })).toBeInTheDocument();
    expect(screen.getByText("Upcoming Event")).toBeInTheDocument();
    expect(screen.getByText("Amateur Boxing Arena")).toBeInTheDocument();
    expect(screen.getByText("The state championships final night.")).toBeInTheDocument();
    expect(screen.getByText("Tickets at the door.")).toBeInTheDocument();
    expect(screen.getByText("Registration closes a week before.")).toBeInTheDocument();
  });

  it("shows a loading state while the detail is fetching", () => {
    mocked.usePublicEvent.mockReturnValue({
      data: null,
      isLoading: true,
    });

    renderEvents("/events/ev-1");

    expect(screen.getByRole("status", { name: "Loading event" })).toBeInTheDocument();
  });

  it("shows a not-found state for an invalid or missing event ID", () => {
    mocked.usePublicEvent.mockReturnValue({
      data: null,
      isLoading: false,
    });

    renderEvents("/events/does-not-exist");

    expect(screen.getByText("Event not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to Events/i })).toBeInTheDocument();
  });

  it("BACK TO EVENTS returns to the public events list from the not-found state", () => {
    mocked.usePublicEvent.mockReturnValue({
      data: null,
      isLoading: false,
    });
    mocked.usePublicEvents.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    renderEvents("/events/does-not-exist");

    fireEvent.click(screen.getByRole("link", { name: /Back to Events/i }));

    expect(screen.getByText("No events found")).toBeInTheDocument();
  });
});