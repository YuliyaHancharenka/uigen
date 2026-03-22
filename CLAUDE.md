# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # Install dependencies, generate Prisma client, run migrations (first-time setup)
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run all tests with Vitest
npm run db:reset     # Reset database (destructive)
```

Run a single test file:
```bash
npx vitest run src/components/chat/__tests__/MessageList.test.tsx
```

## Environment Variables

- `ANTHROPIC_API_KEY` — optional; without it the app runs in demo mode using `MockLanguageModel`
- `JWT_SECRET` — optional in dev; defaults to a hardcoded dev key

## Architecture Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in a chat interface; Claude generates code using tool calls that mutate a virtual file system; the result renders instantly in a sandboxed iframe.

### Request Lifecycle

1. User sends a message → `ChatInterface` POSTs to `/api/chat` with `{ messages, files, projectId }`
2. `route.ts` calls Claude via Vercel AI SDK, supplying two tools: `str_replace_editor` and `file_manager`
3. Claude's tool calls are streamed back; the client's `onToolCall` handler updates `FileSystemContext`
4. On finish, if the user is authenticated, the serialized file system is saved to the DB (`Project.files`)

### Virtual File System (`src/lib/file-system.ts`)

All generated code lives in-memory in a `VirtualFileSystem` instance — nothing is written to disk. Key operations: `createFile`, `deleteFile`, `renameFile`, `replaceInFile`, `serialize` / `deserializeFromNodes`. The serialized form is stored in the SQLite `Project` table for authenticated users.

### Preview Generation (`src/lib/transform/jsx-transformer.ts`)

`PreviewFrame` builds a live preview entirely client-side:
1. Babel transforms every `.jsx`/`.tsx` file and wraps each in a `Blob` URL
2. An ES module import map is constructed from those Blob URLs
3. A full HTML document (`createPreviewHTML`) is injected into an `<iframe srcdoc>` — React and ReactDOM are loaded from CDN

### AI Tools (`src/lib/tools/`)

- `str-replace.ts` — `str_replace_editor`: view file, create file, str-replace, full-file write, insert line
- `file-manager.ts` — `file_manager`: rename and delete files

Both tools are defined with Zod schemas and consumed by `route.ts`. Tool execution on the client calls back into `FileSystemContext`.

### State Management

Two React contexts wrap `MainContent`:
- `FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) — owns the `VirtualFileSystem` instance and exposes file CRUD
- `ChatContext` (`src/lib/contexts/chat-context.tsx`) — owns chat messages and communicates with `/api/chat`

### Authentication (`src/lib/auth.ts`, `src/actions/index.ts`)

JWT sessions stored in `httpOnly` cookies (7-day expiry, `jose` library). Anonymous users get no persistence. Server actions in `src/actions/index.ts` handle sign-up/sign-in/sign-out.

### Database

SQLite via Prisma. Two models: `User` (email, hashed password) and `Project` (name, serialized messages, serialized files). Schema at `prisma/schema.prisma`.

### Provider / Mock Mode (`src/lib/provider.ts`)

`getLanguageModel()` returns the real Anthropic Claude model if `ANTHROPIC_API_KEY` is set, otherwise a `MockLanguageModel` that satisfies the Vercel AI SDK interface — useful for UI development without API costs.
