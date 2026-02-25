export interface SearchResult {
  activeMatchOrdinal: number
  matches: number
  finalUpdate?: boolean
}

export interface SearchOptions {
  matchCase?: boolean
}

// JavaScript-based text search using CSS Custom Highlight API
// No DOM mutation — only creates Range objects and lets the browser render highlights
class TextSearch {
  private currentIndex = 0
  private matchRanges: Range[] = []
  private highlightName = "dive-search-results"
  private activeHighlightName = "dive-search-active"
  private markerOverlayClass = "dive-search-marker-overlay"
  private markerClass = "dive-search-marker"
  private markerActiveClass = "dive-search-marker-active"
  private currentSearchText = ""
  private currentMatchCase = false
  private resultCallback: ((result: SearchResult) => void) | null = null
  private markerOverlay: HTMLDivElement | null = null

  constructor() {
    this.injectStyles()
  }

  private injectStyles() {
    if (document.getElementById("dive-search-styles")) {
      return
    }

    const style = document.createElement("style")
    style.id = "dive-search-styles"
    style.textContent = `
      ::highlight(${this.highlightName}) {
        background-color: var(--bg-pri-medium);
        color: var(--text-invert);
      }
      ::highlight(${this.activeHighlightName}) {
        background-color: var(--bg-warning-medium);
        color: var(--text-invert);
      }
      .${this.markerOverlayClass} {
        position: absolute;
        top: 0;
        right: 0;
        width: 8px;
        height: 100%;
        pointer-events: none;
      }
      .${this.markerClass} {
        position: absolute;
        left: 0;
        transform: translateX(-50%);
        width: 20px;
        height: 3px;
        border-radius: 10px;
        background-color: var(--bg-gray-medium);
        pointer-events: auto;
        cursor: pointer;
      }
      .${this.markerActiveClass} {
        background-color: var(--bg-pri-medium);
        z-index: 1;
      }
      .${this.markerOverlayClass} + .chat-messages::-webkit-scrollbar {
        width: 16px;
      }
      .${this.markerOverlayClass} + .chat-messages::-webkit-scrollbar-thumb {
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        background-clip: padding-box;
        border-radius: 6px;
      }
    `
    document.head.appendChild(style)
  }

  private clearHighlights() {
    this.removeMarkerOverlay()
    CSS.highlights.delete(this.highlightName)
    CSS.highlights.delete(this.activeHighlightName)
    this.matchRanges = []
    this.currentIndex = 0
  }

  private findTextNodes(root: Node): Text[] {
    const textNodes: Text[] = []
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!node.textContent?.trim()) {
            return NodeFilter.FILTER_REJECT
          }
          const parent = node.parentElement
          if (!parent) {
            return NodeFilter.FILTER_REJECT
          }
          const tagName = parent.tagName.toLowerCase()
          if (tagName === "script" || tagName === "style" || tagName === "noscript") {
            return NodeFilter.FILTER_REJECT
          }
          if (!parent.closest(".chat-page")) {
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

  private removeMarkerOverlay() {
    if (this.markerOverlay) {
      this.markerOverlay.remove()
      this.markerOverlay = null
    }
  }

  private updateMarkers() {
    this.removeMarkerOverlay()

    const scrollContainer = document.querySelector(".chat-messages") as HTMLElement | null
    if (!scrollContainer) {
      return
    }

    const wrapper = scrollContainer.parentElement
    if (!wrapper) {
      return
    }

    if (this.matchRanges.length === 0) {
      return
    }

    const overlay = document.createElement("div")
    overlay.className = this.markerOverlayClass
    this.markerOverlay = overlay

    const scrollHeight = scrollContainer.scrollHeight
    const containerRect = scrollContainer.getBoundingClientRect()
    const scrollTop = scrollContainer.scrollTop
    const fragment = document.createDocumentFragment()

    this.matchRanges.forEach((range, index) => {
      const rect = range.getBoundingClientRect()
      const top = rect.top - containerRect.top + scrollTop
      const percent = (top / scrollHeight) * 100
      const marker = document.createElement("div")
      marker.className = this.markerClass
      if (index === this.currentIndex) {
        marker.classList.add(this.markerActiveClass)
      }
      marker.style.top = `${percent}%`
      marker.dataset.index = String(index)
      fragment.appendChild(marker)
    })

    // Event delegation — single listener instead of one per marker
    overlay.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest(`.${this.markerClass}`) as HTMLElement | null
      if (!target?.dataset.index) {
        return
      }
      this.currentIndex = Number(target.dataset.index)
      this.updateActiveHighlight()
      this.updateMarkerActiveState()
      this.notifyResult()
    })

    overlay.appendChild(fragment)
    wrapper.insertBefore(overlay, scrollContainer)
  }

  private updateMarkerActiveState() {
    if (!this.markerOverlay) {
      return
    }
    const markers = this.markerOverlay.querySelectorAll(`.${this.markerClass}`)
    markers.forEach((marker, index) => {
      if (index === this.currentIndex) {
        marker.classList.add(this.markerActiveClass)
      } else {
        marker.classList.remove(this.markerActiveClass)
      }
    })
  }

  private highlightMatches(text: string, matchCase: boolean) {
    this.clearHighlights()
    if (!text) {
      return
    }

    const textNodes = this.findTextNodes(document.body)
    const searchText = matchCase ? text : text.toLowerCase()

    for (const textNode of textNodes) {
      const content = textNode.textContent || ""
      const compareContent = matchCase ? content : content.toLowerCase()
      let startIndex = 0

      while (true) {
        const index = compareContent.indexOf(searchText, startIndex)
        if (index === -1) {
          break
        }

        const range = new Range()
        range.setStart(textNode, index)
        range.setEnd(textNode, index + searchText.length)
        this.matchRanges.push(range)
        startIndex = index + searchText.length
      }
    }

    if (this.matchRanges.length > 0) {
      const highlight = new Highlight()
      for (const r of this.matchRanges) {
        highlight.add(r)
      }
      CSS.highlights.set(this.highlightName, highlight)

      this.currentIndex = 0
      this.updateActiveHighlight()
    }

    this.updateMarkers()
    this.notifyResult()
  }

  private updateActiveHighlight() {
    CSS.highlights.delete(this.activeHighlightName)

    const range = this.matchRanges[this.currentIndex]
    if (range) {
      CSS.highlights.set(this.activeHighlightName, new Highlight(range))

      // Scroll to active match
      const scrollContainer = document.querySelector(".chat-messages") as HTMLElement | null
      if (scrollContainer) {
        const rect = range.getBoundingClientRect()
        const containerRect = scrollContainer.getBoundingClientRect()
        const targetTop = rect.top - containerRect.top + scrollContainer.scrollTop - scrollContainer.clientHeight / 2
        scrollContainer.scrollTo({ top: targetTop, behavior: "smooth" })
      }
    }

    this.updateMarkerActiveState()
  }

  private notifyResult() {
    if (this.resultCallback) {
      this.resultCallback({
        activeMatchOrdinal: this.matchRanges.length > 0 ? this.currentIndex + 1 : 0,
        matches: this.matchRanges.length,
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
    if (this.matchRanges.length === 0) {
      return
    }

    this.currentIndex = (this.currentIndex + 1) % this.matchRanges.length
    this.updateActiveHighlight()
    this.notifyResult()
  }

  findPrev(): void {
    if (this.matchRanges.length === 0) {
      return
    }

    this.currentIndex = (this.currentIndex - 1 + this.matchRanges.length) % this.matchRanges.length
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
