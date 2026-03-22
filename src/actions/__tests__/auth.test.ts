import { describe, test, expect, vi, beforeEach } from "vitest";
import { signUp, signIn, getUser } from "../index";

// --- Mocks ---

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { createSession, getSession } from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

// --- Tests ---

describe("Smoke: auth actions", () => {
  describe("signUp", () => {
    test("rejects empty email", async () => {
      const result = await signUp("", "password123");
      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining("required"),
      });
    });

    test("rejects empty password", async () => {
      const result = await signUp("user@example.com", "");
      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining("required"),
      });
    });

    test("rejects password shorter than 8 characters", async () => {
      const result = await signUp("user@example.com", "short");
      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining("8 characters"),
      });
    });

    test("rejects duplicate email", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "existing-id",
        email: "user@example.com",
      });

      const result = await signUp("user@example.com", "password123");
      expect(result).toMatchObject({
        success: false,
        error: "Email already registered",
      });
    });

    test("creates user and session for valid input", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.create as any).mockResolvedValue({
        id: "new-id",
        email: "user@example.com",
      });

      const result = await signUp("user@example.com", "password123");

      expect(result).toEqual({ success: true });
      expect(createSession).toHaveBeenCalledWith("new-id", "user@example.com");
    });
  });

  describe("signIn", () => {
    test("rejects empty email", async () => {
      const result = await signIn("", "password123");
      expect(result).toMatchObject({ success: false });
    });

    test("rejects empty password", async () => {
      const result = await signIn("user@example.com", "");
      expect(result).toMatchObject({ success: false });
    });

    test("rejects unknown email", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const result = await signIn("unknown@example.com", "password123");
      expect(result).toMatchObject({
        success: false,
        error: "Invalid credentials",
      });
    });

    test("rejects wrong password", async () => {
      const bcrypt = await import("bcrypt");
      const hash = await bcrypt.hash("correctpassword", 10);
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "1",
        email: "user@example.com",
        password: hash,
      });

      const result = await signIn("user@example.com", "wrongpassword");
      expect(result).toMatchObject({
        success: false,
        error: "Invalid credentials",
      });
    });

    test("creates session for valid credentials", async () => {
      const bcrypt = await import("bcrypt");
      const hash = await bcrypt.hash("password123", 10);
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "1",
        email: "user@example.com",
        password: hash,
      });

      const result = await signIn("user@example.com", "password123");

      expect(result).toEqual({ success: true });
      expect(createSession).toHaveBeenCalledWith("1", "user@example.com");
    });
  });

  describe("getUser", () => {
    test("returns null when not authenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const user = await getUser();
      expect(user).toBeNull();
    });

    test("returns user data when authenticated", async () => {
      (getSession as any).mockResolvedValue({ userId: "1" });
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "1",
        email: "user@example.com",
        createdAt: new Date("2024-01-01"),
      });

      const user = await getUser();
      expect(user).toMatchObject({ id: "1", email: "user@example.com" });
    });

    test("returns null when session exists but user is not found", async () => {
      (getSession as any).mockResolvedValue({ userId: "deleted-id" });
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const user = await getUser();
      expect(user).toBeNull();
    });
  });
});
