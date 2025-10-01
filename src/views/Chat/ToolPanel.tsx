import React, { useMemo } from "react"
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow, darcula } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useAtomValue } from "jotai"
import { themeAtom } from "../../atoms/themeState"
import { safeBase64Decode } from "../../util"
import { useTranslation } from "react-i18next"
import Tooltip from "../../components/Tooltip"

interface ToolPanelProps {
  content: string
  name: string
  isOpen: boolean
  onToggle: (open: boolean) => void
}

const callStr = "##Tool Calls:"
const resultStr = "##Tool Result:"

function getToolResult(content: string) {
  let calls: string[] = []
  let results: string[] = []

  try {
    const resultIndex = content.indexOf(resultStr)
    calls = (resultIndex === -1 ? content.slice(callStr.length) : content.slice(callStr.length, resultIndex)).split(callStr)

    if (resultIndex !== -1) {
      results = content
        .slice(resultIndex + resultStr.length)
        .split(resultStr)
        .filter(result => result.trim() !== "")
    }
  } catch (e) {
    console.error("Error parsing tool results:", e)
  }

  return {
    calls,
    results
  }
}

function formatJSON(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString.trim())
    return JSON.stringify(parsed, null, 2)
  } catch (e) {
    return jsonString
  }
}

const Code = ({ content }: { content: string }) => {
  const [theme] = useAtomValue(themeAtom)

  return (
    <SyntaxHighlighter
      language={"json"}
      style={theme === "dark" ? tomorrow : darcula}
      showLineNumbers={true}
      customStyle={{
        margin: 0,
        height: "100%",
        background: "transparent",
        backgroundColor: "var(--bg-dark)"
      }}
      codeTagProps={{
        style: {
          fontSize: "14px",
          lineHeight: "1.5"
        }
      }}
    >
      {content}
    </SyntaxHighlighter>
  )
}

const ToolPanel: React.FC<ToolPanelProps> = ({ content, name, isOpen, onToggle }) => {
  const { t } = useTranslation()
  const { calls, results } = useMemo(() => getToolResult(content), [content])
  const formattedCalls = useMemo(() => calls.map(call => formatJSON(safeBase64Decode(call))), [calls])
  const formattedResults = useMemo(() => results.map(result => formatJSON(safeBase64Decode(result))), [results])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  if (!content || !content.startsWith(callStr)) {
    return <></>
  }

  return (
    <div className="tool-panel">
      <div className={`tool-summary ${isOpen ? "open" : ""}`} onClick={() => onToggle(!isOpen)} >
        <div className="tool-summary-icon">▼</div> {t("chat.toolCalls", { name })}
      </div>
      {isOpen && <div className="tool-panel-content">
        {formattedCalls.map((call, index) => (
          <div className="tool-call">
            <div className="tool-call-header">
              <span>Call{formattedCalls.length > 1 ? ` ${index + 1}` : ""}:</span>
              <Tooltip
                content={t("chat.copyCode")}
              >
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(call)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                    <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                    <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                    <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </Tooltip>
            </div>
            <Code key={index} content={call} />
          </div>
        ))}

        {results.length > 0 && (
          <div className="tool-call">
            {formattedResults.map((result, index) => (
              <>
                <div className="tool-call-header">
                  <span>Results{formattedResults.length > 1 ? ` ${index + 1}` : ""}:</span>
                  <Tooltip
                    content={t("chat.copyCode")}
                  >
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(result)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                        <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                        <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                        <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </Tooltip>
                </div>
                <Code key={index} content={result} />
              </>
            ))}
          </div>
        )}
      </div>}
    </div>
  )
}

export default React.memo(ToolPanel)