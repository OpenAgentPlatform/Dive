import { atom } from "jotai"

export interface FilePreview {
  type: "image" | "file"
  url?: string
  name: string
  size: string
}

export interface DraftData {
  message: string
  files: File[]
  previews: FilePreview[]
}

export const lastMessageAtom = atom<string>("")
export const currentChatIdAtom = atom<string>("")
export const isChatStreamingAtom = atom<boolean>(false)

// Store drafts for different chats, key format: chatId or "__welcome__" for welcome page or "__new_chat__" for new chat
export const draftMessagesAtom = atom<Record<string, DraftData>>({})