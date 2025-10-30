export function getKeymap() {
  const mod = window.PLATFORM === "darwin" ? "m" : "c"
  return {
    "chat-input:submit": `<${mod}-enter>`,
    "chat-input:upload-file": `<${mod}-u>`,
    "chat-input:focus": `<${mod}-k>`,
    "chat-input:paste-last-message": `<${mod}-V>`,
    "chat-message:copy-last": `<${mod}-C>`,
    "chat:delete": `<${mod}-s-backspace>`,
    "global:new-chat": `<${mod}-O>`,
    "global:toggle-sidebar": `<${mod}-S>`,
    "global:close-layer": "<escape>",
    "global:toggle-keymap-modal": `<${mod}-/>`,
    "global:rename-chat": `<${mod}-t>`,
    "global:setting-page": `<${mod}-,>`,
    // "global:reload": `<${mod}-r>`,
  }
}
