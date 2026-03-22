import { describe, test, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { getLanguageModel } from "@/lib/provider";

// --- Mocks ---

vi.mock("@/lib/auth", () => ({ getSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { project: { update: vi.fn() } },
}));
vi.mock("@/lib/provider", () => ({ getLanguageModel: vi.fn() }));
vi.mock("@/lib/prompts/generation", () => ({
  generationPrompt: "You are a React component generator.",
}));

// --- Fast inline model ---
// Returns a tool call on the first invocation, then stops on the second.
function makeFastModel() {
  let calls = 0;
  return {
    specificationVersion: "v1" as const,
    provider: "test",
    modelId: "test",
    defaultObjectGenerationMode: "tool" as const,
    doGenerate: async () => {
      throw new Error("doGenerate not used in streaming mode");
    },
    doStream: async () => {
      calls += 1;
      if (calls === 1) {
        // First call: create a file via tool
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({
                type: "tool-call",
                toolCallType: "function",
                toolCallId: "call_1",
                toolName: "str_replace_editor",
                args: JSON.stringify({
                  command: "create",
                  path: "/App.jsx",
                  file_text:
                    'export default function App() { return <div>Hello</div>; }',
                }),
              });
              controller.enqueue({
                type: "finish",
                finishReason: "tool-calls",
                usage: { promptTokens: 10, completionTokens: 10 },
              });
              controller.close();
            },
          }),
          warnings: [],
          rawCall: { rawPrompt: [], rawSettings: {} },
          rawResponse: { headers: {} },
        };
      }
      // Subsequent calls: just stop
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "text-delta", textDelta: "Done." });
            controller.enqueue({
              type: "finish",
              finishReason: "stop",
              usage: { promptTokens: 20, completionTokens: 5 },
            });
            controller.close();
          },
        }),
        warnings: [],
        rawCall: { rawPrompt: [], rawSettings: {} },
        rawResponse: { headers: {} },
      };
    },
  };
}

function makeRequest(body: object) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (getLanguageModel as any).mockReturnValue(makeFastModel());
});

// --- Tests ---

describe("Smoke: /api/chat route", () => {
  test("returns 200 for a valid chat request", async () => {
    const response = await POST(
      makeRequest({
        messages: [{ id: "1", role: "user", content: "create a button" }],
        files: {},
      })
    );
    expect(response.status).toBe(200);
  });

  test("streams file system state back to client after generation", async () => {
    const response = await POST(
      makeRequest({
        messages: [{ id: "1", role: "user", content: "create a button" }],
        files: {},
      })
    );

    const text = await response.text();

    // The Vercel AI SDK data stream prefixes custom data parts with "2:"
    const dataLine = text
      .split("\n")
      .find((line) => line.startsWith("2:"));

    expect(dataLine).toBeDefined();
    const parsed = JSON.parse(dataLine!.slice(2));
    expect(Array.isArray(parsed)).toBe(true);

    const filesEntry = parsed.find((item: any) => item.type === "files");
    expect(filesEntry).toBeDefined();
    expect(filesEntry.files["/App.jsx"]).toBeDefined();
    expect(filesEntry.files["/App.jsx"].type).toBe("file");
  });
}, 30_000);
