import React, { useEffect, useMemo, useRef, useState } from "react"
import { Doughnut } from "react-chartjs-2"
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip } from "chart.js"
import { useAtomValue } from "jotai"
import { themeAtom } from "../../atoms/themeState"
import { useTranslation } from "react-i18next"
import PopupConfirm from "../../components/PopupConfirm"
import Tooltip from "../../components/Tooltip"

ChartJS.register(ArcElement, ChartTooltip)

interface DonutChartItem {
  value: number
  color: string
  label: string
}

interface DonutChartProps {
  total: number
  items: DonutChartItem[]
}

const DonutChart: React.FC<DonutChartProps> = ({ total, items }) => {
  const filteredItems = items.filter(item => item.value > 0)
  const chartRef = useRef<HTMLDivElement>(null)
  const theme = useAtomValue(themeAtom)
  const [colorKey, setColorKey] = useState(0)

  const resolveColor = (color: string) => {
    if (color.startsWith("var(")) {
      const varName = color.slice(4, -1)
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    }
    return color
  }

  useEffect(() => {
    // wait for css variable update
    requestAnimationFrame(() => {
      setColorKey(prev => prev + 1)
    })
  }, [theme])

  const data = useMemo(() => ({
    labels: filteredItems.map(item => item.label),
    datasets: [{
      data: filteredItems.map(item => item.value),
      backgroundColor: filteredItems.map(item => resolveColor(item.color)),
      borderWidth: 0,
      hoverOffset: 4
    }]
  }), [filteredItems, colorKey])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    cutout: "70%",
    rotation: -15,
    layout: {
      padding: 3
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: resolveColor("var(--bg-dark)"),
        titleFont: { size: 11 },
        bodyFont: { size: 11 },
        padding: 8,
        cornerRadius: 4,
        callbacks: {
          label: (context: any) => `${context.parsed} tokens`
        }
      }
    }
  }), [colorKey])

  return (
    <div className="composition-chart" ref={chartRef}>
      <Doughnut key={colorKey} data={data} options={options} />
      <div className="donut-chart-center">
        <span className="donut-chart-value">{total}</span>
        <span className="donut-chart-label">Token</span>
      </div>
    </div>
  )
}

export interface ResourceUsage {
  model: string
  total_input_tokens: number
  total_output_tokens: number
  user_token: number
  custom_prompt_token: number
  system_prompt_token: number
  time_to_first_token: number
  tokens_per_second: number
  total_run_time: number
}

export interface TokenUsagePopupProps {
  resourceUsage?: ResourceUsage
  onClose: () => void
}

const TokenUsagePopup: React.FC<TokenUsagePopupProps> = ({
  resourceUsage,
  onClose
}) => {
  const { t } = useTranslation()

  const inputTokens = resourceUsage?.total_input_tokens ?? 0
  const outputTokens = resourceUsage?.total_output_tokens ?? 0
  const modelName = resourceUsage?.model
  const timeToFirstToken = resourceUsage?.time_to_first_token ?? 0
  const tokensPerSecond = resourceUsage?.tokens_per_second ?? 0
  const userToken = Math.max((resourceUsage?.user_token ?? 0) - 4, 0)
  const customPromptToken = resourceUsage?.custom_prompt_token ?? 0
  const systemPromptToken = resourceUsage?.system_prompt_token ?? 0
  const langchainToken = 4

  // mcp tool prompt token = total input - user - custom - system
  const mcpToolPromptToken = Math.max(
    inputTokens - userToken - customPromptToken - systemPromptToken,
    0
  )

  return (
    <PopupConfirm
      className="message-tokens-popup"
      onClickOutside={onClose}
      onCancel={onClose}
      cancelText={t("common.close")}
      footerType="flex-end"
      listenHotkey={false}
    >
      <div className="message-tokens-popup-content">
        {modelName && (
          <div className="message-tokens-popup-model">
            <div className="message-tokens-popup-model-title">
              <span>{t("chat.tokens.model")}</span>
            </div>
            <div className="message-tokens-popup-model-name">
              <span>{modelName}</span>
            </div>
          </div>
        )}
        <div className="message-tokens-popup-count">
          <div className="message-tokens-popup-top">
            <div className="message-tokens-popup-block">
              <div className="message-tokens-popup-block-title">
                <span>{t("chat.tokens.input")}</span>
              </div>
              <div className="message-tokens-popup-block-content">
                <span className="message-tokens-popup-block-content-number">{inputTokens}</span>
                <span>{t("chat.tokens.count")}</span>
              </div>
            </div>
            <div className="message-tokens-popup-block">
              <div className="message-tokens-popup-block-title">
                <span>{t("chat.tokens.output")}</span>
              </div>
              <div className="message-tokens-popup-block-content">
                <span className="message-tokens-popup-block-content-number">{outputTokens}</span>
                <span>{t("chat.tokens.count")}</span>
              </div>
            </div>
          </div>
        </div>
        {resourceUsage && inputTokens > 0 && (
          <div className="message-tokens-popup-composition">
            <div className="message-tokens-popup-composition-title">
              <span>{t("chat.tokens.composition")}</span>
              <Tooltip content={t("chat.tokens.compositionAlt")} side="bottom" align="start" maxWidth={402}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7.5" stroke="currentColor"/>
                  <path d="M8.73 6.64V12H7.85V6.64H8.73ZM8.3 4.63C8.43333 4.63 8.55 4.67667 8.65 4.77C8.75667 4.85667 8.81 4.99667 8.81 5.19C8.81 5.37667 8.75667 5.51667 8.65 5.61C8.55 5.70333 8.43333 5.75 8.3 5.75C8.15333 5.75 8.03 5.70333 7.93 5.61C7.83 5.51667 7.78 5.37667 7.78 5.19C7.78 4.99667 7.83 4.85667 7.93 4.77C8.03 4.67667 8.15333 4.63 8.3 4.63Z" fill="currentColor"/>
                </svg>
              </Tooltip>
            </div>
            <div className="message-tokens-popup-composition-grid">
              <DonutChart
                total={inputTokens}
                items={[
                  { value: userToken, color: "var(--text-strong)", label: t("chat.tokens.userToken") },
                  { value: langchainToken, color: "var(--text-medium)", label: t("chat.tokens.langchainToken") },
                  { value: customPromptToken, color: "var(--bg-gray-strong)", label: t("chat.tokens.customPrompt") },
                  { value: systemPromptToken, color: "var(--bg-pri-medium)", label: t("chat.tokens.systemPrompt") },
                  { value: mcpToolPromptToken, color: "var(--bg-pri-weak)", label: t("chat.tokens.mcpToolPrompt") },
                ]}
              />
              <div className="legend-header">
                <span>(Token)</span>
              </div>
              <div className="legend-item user-token">
                <span className="legend-dot" style={{ backgroundColor: "var(--text-strong)" }}></span>
                <span className="legend-label">{t("chat.tokens.userToken")}</span>
                <span className="legend-value">{userToken}</span>
                <span className="legend-percent">{inputTokens ? Math.round((userToken / inputTokens) * 100) : 0}%</span>
              </div>
              <div className="legend-item langchain-token">
                <span className="legend-dot" style={{ backgroundColor: "var(--text-medium)" }}></span>
                <span className="legend-label">{t("chat.tokens.langchainToken")}</span>
                <span className="legend-value">{langchainToken}</span>
                <span className="legend-percent">{inputTokens ? Math.round((langchainToken / inputTokens) * 100) : 0}%</span>
              </div>
              <div className="legend-item custom-prompt-token">
                <span className="legend-dot" style={{ backgroundColor: "var(--bg-gray-strong)" }}></span>
                <span className="legend-label">{t("chat.tokens.customPrompt")}</span>
                <span className="legend-value">{customPromptToken}</span>
                <span className="legend-percent">{inputTokens ? Math.round((customPromptToken / inputTokens) * 100) : 0}%</span>
              </div>
              <div className="legend-item system-prompt-token">
                <span className="legend-dot" style={{ backgroundColor: "var(--bg-pri-medium)" }}></span>
                <span className="legend-label">{t("chat.tokens.systemPrompt")}</span>
                <span className="legend-value">{systemPromptToken}</span>
                <span className="legend-percent">{inputTokens ? Math.round((systemPromptToken / inputTokens) * 100) : 0}%</span>
              </div>
              <div className="legend-item mcp-tool-prompt-token">
                <span className="legend-dot" style={{ backgroundColor: "var(--bg-pri-weak)" }}></span>
                <span className="legend-label">{t("chat.tokens.mcpToolPrompt")}</span>
                <span className="legend-value">{mcpToolPromptToken}</span>
                <span className="legend-percent">{inputTokens ? Math.round((mcpToolPromptToken / inputTokens) * 100) : 0}%</span>
              </div>
            </div>
          </div>
        )}
        <div className="message-tokens-popup-desc">
          <div className="message-tokens-popup-desc-title">
            <Tooltip content={t("chat.tokens.firstDelayDesc")}>
              <span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 4V8L10 9.5" stroke="currentColor" strokeLinejoin="round"/>
                  <circle cx="7" cy="7" r="6.5" stroke="currentColor"/>
                </svg>
                {t("chat.tokens.firstDelay", { time: (timeToFirstToken * 1000).toFixed(0) })}
              </span>
            </Tooltip>
            <span>|</span>
            <Tooltip content={t("chat.tokens.generationRateDesc")}>
              <span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="15" viewBox="0 0 12 15" fill="none">
                  <path d="M0.5 8L6.5 0.5V5.5H11.5L5.5 14V8H0.5Z" stroke="currentColor" strokeLinejoin="round"/>
                </svg>
                {t("chat.tokens.generationRate", { time: tokensPerSecond.toFixed(0) })}
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
    </PopupConfirm>
  )
}

export default TokenUsagePopup
