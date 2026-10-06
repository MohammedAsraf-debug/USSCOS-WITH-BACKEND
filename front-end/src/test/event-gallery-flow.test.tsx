// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Gallery from "@/pages/public/Gallery.jsx";
import EventDetail from "@/pages/public/EventDetail.jsx";
import { usePublicEvent, usePublicGallery } from "@/hooks/use-firestore";

vi.mock("@/hooks/use-firestore", () => ({
  usePublicEvent: vi.fn(),
  usePublicGallery: vi.fn(),
  useContentBlock: vi.fn(() => ({ data: null })),
}));

const mocked = {
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
};

const media = [
  {
    id: "gi-1",
    title: "Opening bout",
    altText: "Opening bout photo",
    category: "Photos",
    eventId: "ev-1",
    publicUrl: "https://cdn.example.com/opening.jpg",
  },
  {
    id: "gi-2",
    title: "Find ring moments",
    altText: "Ring moments",
    category: "Photos",
    eventId: "ev-2",
    publicUrl: "https://cdn.example.com/ring.jpg",
  },
  {
    id: "gi-3",
    title: "Legacy general photo",
    altText: "Legacy photo",
    category: "Photos",
    eventId: null,
    publicUrl: "https://cdn.example.com/legacy.jpg",
  },
  {
    id: "gi-4",
    title: "Feature clip",
    altText: "Feature video",
    category: "Videos",
    eventId: "ev-1",
    publicUrl: "https://cdn.example.com/clip.mp4",
  },
];

function renderEventDetail() {
  return render(
    <MemoryRouter initialEntries={["/events/ev-1"]}>
      <Routes>
        <Route path="/events/:eventId" element={<EventDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderGallery(initialEntry = "/gallery") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/gallery" element={<Gallery />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocked.usePublicEvent.mockReset();
  mocked.usePublicGallery.mockReset();
});

describe("Event detail — Event Gallery section", () => {
  it("shows only media belonging to that event (eventId match)", () => {
    mocked.usePublicEvent.mockReturnValue({ data: ev1, isLoading: false });
    mocked.usePublicGallery.mockReturnValue({ data: media, isLoading: false, isError: false });

    renderEventDetail();

    expect(screen.getByRole("heading", { name: /Event Gallery/i })).toBeInTheDocument();
    expect(screen.getByText("Opening bout")).toBeInTheDocument();
    expect(screen.getByText("Feature clip")).toBeInTheDocument();

    expect(screen.queryByText("Find ring moments")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy general photo")).not.toBeInTheDocument();
  });

  it("shows a clean empty state when the event has no media yet", () => {
    mocked.usePublicEvent.mockReturnValue({ data: ev1, isLoading: false });
    mocked.usePublicGallery.mockReturnValue({ data: [], isLoading: false, isError: false });

    renderEventDetail();

    expect(screen.getByText("No media from this event yet")).toBeInTheDocument();
  });

  it("VIEW FULL GALLERY links to the filtered gallery /gallery?event=:eventId", () => {
    mocked.usePublicEvent.mockReturnValue({ data: ev1, isLoading: false });
    mocked.usePublicGallery.mockReturnValue({
      data: [media[0]],
      isLoading: false,
      isError: false,
    });

    renderEventDetail();

    expect(screen.getByRole("link", { name: /View Full Gallery/i })).toHaveAttribute(
      "href",
      "/gallery?event=ev-1",
    );
  });

  it("renders a play badge for video media", () => {
    mocked.usePublicEvent.mockReturnValue({ data: ev1, isLoading: false });
    mocked.usePublicGallery.mockReturnValue({
      data: [media[3]],
      isLoading: false,
      isError: false,
    });

    const { container } = renderEventDetail();

    expect(container.querySelector(".gallery-item__play")).not.toBeNull();
  });
});

describe("Gallery page — event filtering", () => {
  it("normal /gallery still shows all media (including items without eventId)", () => {
    mocked.usePublicGallery.mockReturnValue({ data: media, isLoading: false, isError: false });

    renderGallery();

    expect(screen.getByText("Opening bout")).toBeInTheDocument();
    expect(screen.getByText("Find ring moments")).toBeInTheDocument();
    expect(screen.getByText("Legacy general photo")).toBeInTheDocument();
    expect(screen.getByText("Feature clip")).toBeInTheDocument();
    expect(screen.queryByText("View all media")).not.toBeInTheDocument();
  });

  it("/gallery?event= shows only media belonging to that event", () => {
    mocked.usePublicGallery.mockReturnValue({ data: media, isLoading: false, isError: false });

    renderGallery("/gallery?event=ev-1");

    expect(screen.getByText("Opening bout")).toBeInTheDocument();
    expect(screen.getByText("Feature clip")).toBeInTheDocument();
    expect(screen.queryByText("Find ring moments")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy general photo")).not.toBeInTheDocument();

    const clear = screen.getByRole("link", { name: /View all media/i });
    expect(clear).toHaveAttribute("href", "/gallery");
  });

  it("/gallery?event= with no matching media shows an event-specific empty state", () => {
    mocked.usePublicGallery.mockReturnValue({ data: media, isLoading: false, isError: false });

    renderGallery("/gallery?event=ev-99");

    expect(screen.getByText("No media for this event yet")).toBeInTheDocument();
    expect(screen.queryByText("Opening bout")).not.toBeInTheDocument();
  });
});