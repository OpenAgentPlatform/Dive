import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import {
  checkChatExists,
  createChat,
  createMessage,
  deleteChat,
  getAllChats,
  getChatWithMessages,
  initDatabase,
  setDatabase,
} from "../../database";
import * as schema from "../../database/schema";

type MockDB = {
  query: {
    chats: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    messages: {
      findMany: jest.Mock;
    };
  };
  insert: jest.Mock;
  delete: jest.Mock;
  transaction: jest.Mock;
};

type MockTransaction = {
  query: {
    chats: {
      findFirst: jest.Mock;
    };
  };
  insert: jest.Mock;
};

// Mock better-sqlite3
jest.mock("better-sqlite3", () => {
  return jest.fn().mockImplementation(() => ({
    exec: jest.fn(),
  }));
});

// Mock drizzle-orm
jest.mock("drizzle-orm/better-sqlite3", () => ({
  drizzle: jest.fn().mockReturnValue({
    query: {
      chats: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      messages: {
        findMany: jest.fn(),
      },
    },
    insert: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn(),
  }),
}));

describe("Database Operations", () => {
  let mockDb: MockDB;

  beforeEach(() => {
    // 清除所有 mock
    jest.clearAllMocks();

    // 初始化 mock 資料庫
    mockDb = {
      query: {
        chats: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
        },
        messages: {
          findMany: jest.fn(),
        },
      },
      insert: jest.fn(),
      delete: jest.fn(),
      transaction: jest.fn(),
    };

    setDatabase(mockDb as unknown as BetterSQLite3Database<typeof schema>);
  });

  describe("initDatabase", () => {
    test("應該成功初始化資料庫", () => {
      const result = initDatabase(":memory:");
      expect(result).toBeDefined();
    });

    test("初始化失敗時應拋出錯誤", () => {
      const mockError = new Error("Database initialization failed");
      jest.spyOn(console, "error").mockImplementation(() => {});
      (require("better-sqlite3") as jest.Mock).mockImplementation(() => {
        throw mockError;
      });

      expect(() => initDatabase(":memory:")).toThrow(mockError);
    });
  });

  describe("getAllChats", () => {
    test("應該返回反序的聊天列表", async () => {
      const mockChats = [
        { id: "1", title: "Chat 1", createdAt: "2024-01-01T00:00:00.000Z" },
        { id: "2", title: "Chat 2", createdAt: "2024-01-02T00:00:00.000Z" },
      ];

      const mockChatsReverse = [...mockChats].reverse();

      mockDb.query.chats.findMany.mockResolvedValue(mockChats as never);

      const result = await getAllChats();
      expect(result).toEqual(mockChatsReverse);
      expect(mockDb.query.chats.findMany).toHaveBeenCalled();
    });
  });

  describe("getChatWithMessages", () => {
    test("應該返回聊天及其訊息", async () => {
      const mockChat = {
        id: "1",
        title: "Test Chat",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      const mockMessages = [
        {
          id: 1,
          content: "Message 1",
          chatId: "1",
          createdAt: "2024-01-01T00:00:00.000Z",
          role: "user",
          messageId: "msg1",
          files: null,
        },
        {
          id: 2,
          content: "Message 2",
          chatId: "1",
          createdAt: "2024-01-01T00:00:00.000Z",
          role: "assistant",
          messageId: "msg2",
          files: null,
        },
      ];

      mockDb.query.chats.findFirst.mockResolvedValue(mockChat as never);
      mockDb.query.messages.findMany.mockResolvedValue(mockMessages as never);

      const result = await getChatWithMessages("1");
      expect(result).toEqual({ chat: mockChat, messages: mockMessages });
    });

    test("當聊天不存在時應返回 null", async () => {
      mockDb.query.chats.findFirst.mockResolvedValue(undefined as never);

      const result = await getChatWithMessages("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("createChat", () => {
    test("應該成功創建新聊天", async () => {
      const mockChat = {
        id: "1",
        title: "New Chat",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockChat] as never),
        }),
      });

      const result = await createChat("1", "New Chat");
      expect(result).toEqual({
        ...mockChat,
        createdAt: expect.any(String),
      });
    });
  });

  describe("createMessage", () => {
    test("應該成功創建新訊息", async () => {
      const mockMessage = {
        id: 1,
        chatId: "1",
        content: "Test message",
        role: "user",
        createdAt: "2024-01-01T00:00:00.000Z",
        messageId: "msg1",
        files: null,
      };

      const mockTx: MockTransaction = {
        query: {
          chats: {
            findFirst: jest.fn().mockResolvedValue({
              id: "1",
              title: "Test Chat",
              createdAt: "2024-01-01T00:00:00.000Z",
            } as never),
          },
        },
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockMessage] as never),
          }),
        }),
      };

      // @ts-ignore
      mockDb.transaction.mockImplementation((fn: (tx: MockTransaction) => any) => fn(mockTx));

      const result = await createMessage({
        chatId: "1",
        content: "Test message",
        role: "user",
        createdAt: "2024-01-01T00:00:00.000Z",
        messageId: "msg1",
        files: null,
      });
      expect(result).toEqual(mockMessage);
    });

    test("當聊天不存在時應拋出錯誤", async () => {
      const mockTx: MockTransaction = {
        query: {
          chats: {
            findFirst: jest.fn().mockResolvedValue(undefined as never),
          },
        },
        insert: jest.fn(),
      };

      // @ts-ignore
      mockDb.transaction.mockImplementation((fn: (tx: MockTransaction) => any) => fn(mockTx));

      await expect(
        createMessage({
          chatId: "nonexistent",
          content: "Test",
          role: "user",
          createdAt: "2024-01-01T00:00:00.000Z",
          messageId: "msg1",
          files: null,
        })
      ).rejects.toThrow("Chat nonexistent does not exist");
    });
  });

  describe("checkChatExists", () => {
    test("當聊天存在時應返回 true", async () => {
      const mockChat = {
        id: "1",
        title: "Test Chat",
        createdAt: "2024-01-01T00:00:00.000Z",
      };

      mockDb.query.chats.findFirst.mockResolvedValue(mockChat as never);

      const result = await checkChatExists("1");
      expect(result).toBe(true);
    });

    test("當聊天不存在時應返回 false", async () => {
      mockDb.query.chats.findFirst.mockResolvedValue(undefined as never);

      const result = await checkChatExists("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("deleteChat", () => {
    test("應該成功刪除聊天及其訊息", async () => {
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockReturnValue(Promise.resolve()),
      });

      await deleteChat("1");
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });
  });
});
