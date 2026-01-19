export interface SearchResult {
  activeMatchOrdinal: number
  matches: number
  finalUpdate?: boolean
}

export interface SearchOptions {
  matchCase?: boolean
}

// JavaScript-based text search using TreeWalker + Range API + mark elements
// Works for both Electron and Tauri for consistent behavior
class TextSearch {
  private currentIndex = 0
  private matches: Range[] = []
  private highlightClass = "dive-search-highlight"
  private activeClass = "dive-search-highlight-active"
  private currentSearchText = ""
  private currentMatchCase = false
  private resultCallback: ((result: SearchResult) => void) | null = null

  constructor() {
    // Create styles for highlights
    this.injectStyles()
  }

  private injectStyles() {
    if (document.getElementById("dive-search-styles")) {
      return
    }

    const style = document.createElement("style")
    style.id = "dive-search-styles"
    style.textContent = `
      .${this.highlightClass} {
        background-color: rgba(255, 235, 59, 0.5);
        border-radius: 2px;
      }
      .${this.activeClass} {
        background-color: rgba(255, 152, 0, 0.7);
        border-radius: 2px;
      }
    `
    document.head.appendChild(style)
  }

  private clearHighlights() {
    const highlights = document.querySelectorAll(`.${this.highlightClass}`)
    highlights.forEach((el) => {
      const parent = el.parentNode
      if (parent) {
        const text = document.createTextNode(el.textContent || "")
        parent.replaceChild(text, el)
        parent.normalize()
      }
    })
    this.matches = []
    this.currentIndex = 0
  }

  private findTextNodes(root: Node): Text[] {
    const textNodes: Text[] = []
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip empty text nodes and hidden elements
          if (!node.textContent?.trim()) {
            return NodeFilter.FILTER_REJECT
          }
          const parent = node.parentElement
          if (!parent) {
            return NodeFilter.FILTER_REJECT
          }
          // Skip script/style/hidden elements
          const tagName = parent.tagName.toLowerCase()
          if (tagName === "script" || tagName === "style" || tagName === "noscript") {
            return NodeFilter.FILTER_REJECT
          }
          // Skip the search bar itself
          if (parent.closest(".search-bar")) {
            return NodeFilter.FILTER_REJECT
          }
          // Skip already highlighted text (to avoid double-highlighting)
          if (parent.classList.contains(this.highlightClass)) {
            return NodeFilter.FILTER_REJECT
          }
          const style = window.getComputedStyle(parent)
          if (style.display === "none" || style.visibility === "hidden") {
            return NodeFilter.FILTER_REJECT
          }
          return NodeFilter.FILTER_ACCEPT
        },
      }
    )

    let node
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text)
    }
    return textNodes
  }

  private highlightMatches(text: string, matchCase: boolean) {
    this.clearHighlights()
    if (!text) {
      return
    }

    const textNodes = this.findTextNodes(document.body)
    const searchText = matchCase ? text : text.toLowerCase()

    textNodes.forEach((textNode) => {
      const content = textNode.textContent || ""
      const compareContent = matchCase ? content : content.toLowerCase()
      let startIndex = 0
      let index: number

      while ((index = compareContent.indexOf(searchText, startIndex)) !== -1) {
        const range = document.createRange()
        range.setStart(textNode, index)
        range.setEnd(textNode, index + searchText.length)

        const mark = document.createElement("mark")
        mark.className = this.highlightClass

        try {
          range.surroundContents(mark)
          this.matches.push(range)
          // After surrounding, the textNode has been split, so we need to continue from the new position
          startIndex = 0
          break // Break to re-find in new text nodes
        } catch (_e) {
          // Range spans multiple elements, skip
          startIndex = index + 1
        }
      }
    })

    // If we have matches, highlight the first one as active
    if (this.matches.length > 0) {
      this.currentIndex = 0
      this.updateActiveHighlight()
    }

    this.notifyResult()
  }

  private updateActiveHighlight() {
    // Remove active class from all highlights
    document.querySelectorAll(`.${this.activeClass}`).forEach((el) => {
      el.classList.remove(this.activeClass)
    })

    // Add active class to current match
    const highlights = document.querySelectorAll(`.${this.highlightClass}`)
    if (highlights[this.currentIndex]) {
      highlights[this.currentIndex].classList.add(this.activeClass)
      highlights[this.currentIndex].scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }
  }

  private notifyResult() {
    const highlights = document.querySelectorAll(`.${this.highlightClass}`)
    if (this.resultCallback) {
      this.resultCallback({
        activeMatchOrdinal: highlights.length > 0 ? this.currentIndex + 1 : 0,
        matches: highlights.length,
        finalUpdate: true,
      })
    }
  }

  find(text: string, options?: SearchOptions): void {
    this.currentSearchText = text
    this.currentMatchCase = options?.matchCase ?? false
    this.highlightMatches(text, this.currentMatchCase)
  }

  findNext(): void {
    const highlights = document.querySelectorAll(`.${this.highlightClass}`)
    if (highlights.length === 0) {
      return
    }

    this.currentIndex = (this.currentIndex + 1) % highlights.length
    this.updateActiveHighlight()
    this.notifyResult()
  }

  findPrev(): void {
    const highlights = document.querySelectorAll(`.${this.highlightClass}`)
    if (highlights.length === 0) {
      return
    }

    this.currentIndex = (this.currentIndex - 1 + highlights.length) % highlights.length
    this.updateActiveHighlight()
    this.notifyResult()
  }

  stop(): void {
    this.clearHighlights()
    this.currentSearchText = ""
    this.currentMatchCase = false
    if (this.resultCallback) {
      this.resultCallback({
        activeMatchOrdinal: 0,
        matches: 0,
        finalUpdate: true,
      })
    }
  }

  onResult(callback: (result: SearchResult) => void): void {
    this.resultCallback = callback
  }
}

// Singleton instance for search (works for both Electron and Tauri)
let searchInstance: TextSearch | null = null

function getSearch(): TextSearch {
  if (!searchInstance) {
    searchInstance = new TextSearch()
  }
  return searchInstance
}

// Unified search API - use JS-based search for both Electron and Tauri
// This ensures consistent behavior and proper scrolling in nested containers
export async function findInPage(text: string, options?: SearchOptions): Promise<void> {
  getSearch().find(text, options)
}

export async function findNext(_text: string, _options?: SearchOptions): Promise<void> {
  getSearch().findNext()
}

export async function findPrev(_text: string, _options?: SearchOptions): Promise<void> {
  getSearch().findPrev()
}

export async function stopFind(): Promise<void> {
  getSearch().stop()
}

export function listenSearchResult(callback: (result: SearchResult) => void): () => void {
  getSearch().onResult(callback)
  return () => {
    // No cleanup needed
  }
}
