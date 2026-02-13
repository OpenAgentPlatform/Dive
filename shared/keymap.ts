export function getKeymap() {
  const mod = window.PLATFORM === "darwin" ? "m" : "c"
  return {
    "chat-input:submit": `<${mod}-enter>`,
    "chat-input:upload-file": `<${mod}-u>`,
    "chat-input:focus": `<${mod}-k>`,
    "chat-input:paste-last-message": `<${mod}-V>`,
    "chat-input:history-up": "<arrowup>",
    "chat-message:copy-last": `<${mod}-C>`,
    "chat:delete": `<${mod}-s-backspace>`,
    "global:new-chat": `<${mod}-O>`,
    "global:toggle-sidebar": `<${mod}-S>`,
    "global:close-layer": "<escape>",
    "global:toggle-keymap-modal": `<${mod}-/>`,
    "global:rename-chat": `<${mod}-t>`,
    "global:setting-page": `<${mod}-,>`,
    "global:close-window": `<${mod}-w>`,
    "global:toggle-search": `<${mod}-f>`,
    // "global:reload": `<${mod}-r>`,
  }
}
