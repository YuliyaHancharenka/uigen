import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import React from "react";
import { FileSystemProvider, useFileSystem } from "@/lib/contexts/file-system-context";
import { ChatProvider } from "@/lib/contexts/chat-context";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { useChat as useAIChat } from "@ai-sdk/react";

// --- Mocks ---

vi.mock("@ai-sdk/react", () => ({ useChat: vi.fn() }));

vi.mock("@/lib/anon-work-tracker", () => ({ setHasAnonWork: vi.fn() }));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/chat/MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: any) => <span>{content}</span>,
}));

// --- Test utilities ---

/** Reads file system state so tests can observe it without touching the real preview. */
function FileSystemProbe() {
  const { fileSystem, refreshTrigger } = useFileSystem();
  const hasFiles = fileSystem.getAllFiles().size > 0;
  return (
    <div data-testid="fs-probe">{hasFiles ? "has-files" : "empty"}</div>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <FileSystemProvider>
      <ChatProvider>{children}</ChatProvider>
    </FileSystemProvider>
  );
}

const baseChat = {
  messages: [],
  input: "",
  handleInputChange: vi.fn(),
  handleSubmit: vi.fn(),
  status: "idle" as const,
  data: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  (useAIChat as any).mockReturnValue(baseChat);
});

afterEach(() => cleanup());

// --- Tests ---

describe("Smoke: component generation flow", () => {
  test("shows empty file system on initial load", () => {
    render(
      <Wrapper>
        <FileSystemProbe />
        <ChatInterface />
      </Wrapper>
    );

    expect(screen.getByTestId("fs-probe").textContent).toBe("empty");
    expect(
      screen.getByPlaceholderText(
        "Describe the React component you want to create..."
      )
    ).toBeDefined();
  });

  test("chat input is disabled while AI is streaming", () => {
    (useAIChat as any).mockReturnValue({
      ...baseChat,
      status: "streaming",
      messages: [{ id: "1", role: "user", content: "create a button" }],
    });

    render(
      <Wrapper>
        <ChatInterface />
      </Wrapper>
    );

    const textarea = screen.getByPlaceholderText(
      "Describe the React component you want to create..."
    ) as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  test("file system is populated when data stream contains files", async () => {
    const mockFiles = {
      "/": { type: "directory", name: "/", path: "/" },
      "/App.jsx": {
        type: "file",
        name: "App.jsx",
        path: "/App.jsx",
        content:
          "export default function App() { return <button>Click</button>; }",
      },
    };

    (useAIChat as any).mockReturnValue({
      ...baseChat,
      data: [{ type: "files", files: mockFiles }],
    });

    render(
      <Wrapper>
        <FileSystemProbe />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId("fs-probe").textContent).toBe("has-files");
    });
  });

  test("assistant reply appears in chat after generation", () => {
    (useAIChat as any).mockReturnValue({
      ...baseChat,
      messages: [
        { id: "1", role: "user", content: "create a button" },
        {
          id: "2",
          role: "assistant",
          content: "Done! Here is your button.",
          parts: [{ type: "text", text: "Done! Here is your button." }],
        },
      ],
    });

    render(
      <Wrapper>
        <ChatInterface />
      </Wrapper>
    );

    expect(screen.getByText("Done! Here is your button.")).toBeDefined();
  });
});
