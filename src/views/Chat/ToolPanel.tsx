import React, { useMemo } from "react"
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow, darcula } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useAtomValue } from "jotai"
import { themeAtom } from "../../atoms/themeState"
import { safeBase64Decode } from "../../util"
import { useTranslation } from "react-i18next"

interface ToolPanelProps {
  content: string
  name: string
}

const callStr = "##Tool Calls:"
const resultStr = "##Tool Result:"

function getToolResult(content: string) {
  let calls = ""
  let results: string[] = []

  try {
    const resultIndex = content.indexOf(resultStr)
    calls = resultIndex === -1 ? content.slice(callStr.length) : content.slice(callStr.length, resultIndex)

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
        backgroundColor: "var(--bg-modal)"
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

const ToolPanel: React.FC<ToolPanelProps> = ({ content, name }) => {
  const { t } = useTranslation()
  const { calls, results } = useMemo(() => getToolResult(content), [content])
  const formattedCalls = useMemo(() => formatJSON(safeBase64Decode(calls)), [calls])
  const formattedResults = useMemo(() => results.map(result => formatJSON(safeBase64Decode(result))), [results])

  if (!content || !content.startsWith(callStr)) {
    return <></>
  }

  return (
    <details className="tool-panel">
      <summary>
        {t("chat.toolCalls", { name })}
      </summary>
      <div className="tool-content">
        <span>Calls:</span>
        <Code content={formattedCalls} />

        {results.length > 0 && (
          <>
            {formattedResults.map((result, index) => (
              <>
                <span>Results{formattedResults.length > 1 ? ` ${index + 1}` : ""}:</span>
                <Code key={index} content={result} />
              </>
            ))}
          </>
        )}
      </div>
    </details>
  )
}

export default React.memo(ToolPanel)