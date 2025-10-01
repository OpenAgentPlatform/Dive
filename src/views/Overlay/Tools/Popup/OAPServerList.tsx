import { memo, useEffect, useRef, useState } from "react"
import CheckBox from "../../../../components/CheckBox"
import PopupConfirm from "../../../../components/PopupConfirm"
import WrappedInput from "../../../../components/WrappedInput"
import { useTranslation } from "react-i18next"
import InfiniteScroll from "../../../../components/InfiniteScroll"
import Select from "../../../../components/Select"
import React from "react"
import Tabs from "../../../../components/Tabs"
import ScrollFade from "../../../../components/ScrollFade"
import { MCPServerSearchParam, OAPMCPServer } from "../../../../../types/oap"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { isOAPProAtom } from "../../../../atoms/oapState"
import Tooltip from "../../../../components/Tooltip"
import { OAP_ROOT_URL } from "../../../../../shared/oap"
import { imgPrefix, oapApplyMCPServer, oapSearchMCPServer } from "../../../../ipc"
import InfoTooltip from "../../../../components/InfoTooltip"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import rehypeKatex from "rehype-katex"
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { themeAtom } from "../../../../atoms/themeState"
import remarkGfm from "remark-gfm"
import { showToastAtom } from "../../../../atoms/toastState"
import Button from "../../../../components/Button"
import { openUrl } from "../../../../ipc/util"

const SearchHightLight = memo(({ text, searchText }: { text: string, searchText: string }) => {
  if (searchText === "") {
    return <div className="oap-title-text">{text}</div>
  }
  const regex = new RegExp(searchText, "gi")
  return (
    <div className="oap-title-text">
      {text.split(regex).map((part, i, arr) => {
        if (i === arr.length - 1) {
          return part
        }
        const match = text.match(regex)?.[0] || ""
        return (
          <>
            {part}
            <span className="oap-title-text-hightlight">{match}</span>
          </>
        )
      })}
    </div>
  )
})
interface ToolItem {
  name: string
  description: string
  token: number
  plan: "BASE" | "PRO"
  tags: string[]
  checked: boolean
  id: string
  popular?: boolean
  new?: boolean
}

const TAGS = [ "Text", "Search", "Document", "Image", "Audio & Video" ]

const OAPServerList = ({
  oapTools,
  onConfirm,
  onCancel,
}: {
  oapTools: { id: string, name: string }[]
  onConfirm: () => void
  onCancel: () => void
}) => {
  const oriOapToolsRef = useRef(JSON.parse(JSON.stringify(oapTools)))
  const [highCostList, setHighCostList] = useState<{ [key: string]: ToolItem[] }>({})
  const { t } = useTranslation()
  const [theme] = useAtom(themeAtom)
  const showToast = useSetAtom(showToastAtom)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isFetchingRef = useRef(true)
  const isFetchingNextPageRef = useRef(false)
  const [searchText, setSearchText] = useState<string>("")
  const [toolList, setToolList] = useState<ToolItem[]>([])
  const [sort, setSort] = useState("popular")
  const [subscription, setSubscription] = useState<"ALL" | "BASE" | "PRO">("ALL")
  const [tag, setTag] = useState<string[]>([])
  const [hasNextPage, setHasNextPage] = useState(true)
  const hasNextPageRef = useRef(true)
  const pageRef = useRef(0)
  const isOAPPro = useAtomValue(isOAPProAtom)
  const PAGE_SIZE = 25
  const HIGH_TOKEN_COST = 0.2
  const getState = (setter: React.Dispatch<React.SetStateAction<any>>): Promise<any> => {
    return new Promise(resolve => {
      setter((prev: any) => {
        resolve(prev)
        return prev
      })
    })
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast({
        message: t("common.copySuccess"),
        type: "success",
      })
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  useEffect(() => {
    handleLoadNextPage()
  }, [])

  useEffect(() => {
    resetState()
    handleLoadNextPage()
  }, [searchText, sort, subscription, tag.join(",")])

  const resetState = () => {
    pageRef.current = 0
    setToolList([])
    setHasNextPage(true)
    hasNextPageRef.current = true
    isFetchingRef.current = false
  }

  const handleLoadNextPage = async () => {
    if (isFetchingRef.current || !hasNextPageRef.current) {
      return
    }
    isFetchingRef.current = true
    isFetchingNextPageRef.current = true
    const params = {
      page: pageRef.current,
      search_input: searchText,
      tags: tag,
      text_tag: tag.includes("Text"),
      search_tag: tag.includes("Search"),
      document_tag: tag.includes("Document"),
      image_tag: tag.includes("Image"),
      audio_video_tag: tag.includes("Audio & Video"),
      "mcp-sort-order": sort === "popular" ? 0 : 1,
      filter: subscription === "ALL" ? 0 : subscription === "BASE" ? 1 : 2,
    } as MCPServerSearchParam

    oapSearchMCPServer(params).then(async (res: any) => {
      const newSearchText = await getState(setSearchText)
      const newTag = await getState(setTag)
      const newSubscription = await getState(setSubscription)
      const newFilter = newSubscription === "ALL" ? 0 : newSubscription === "BASE" ? 1 : 2
      const newSort = await getState(setSort)
      const newSortOrder = newSort === "popular" ? 0 : 1
      if(params.search_input !== newSearchText || params.tags?.join(",") !== newTag?.join(",") || params.filter !== newFilter || params["mcp-sort-order"] !== newSortOrder) {
        return
      }
      if(res.data && res.data.length > 0) {
        const data = res.data.map((tool: OAPMCPServer) => {
          return {
            ...tool,
            checked: oapTools?.find(t => t.id === tool.id) ? true : false,
          } as any
        })
        setToolList(prev => [
          ...prev,
          ...data,
        ])
      }
      if(res.data && res.data.length > PAGE_SIZE) {
        hasNextPageRef.current = true
        setHasNextPage(true)
      } else {
        hasNextPageRef.current = false
        setHasNextPage(false)
      }
      isFetchingRef.current = false
      isFetchingNextPageRef.current = false
      pageRef.current += 1
    }).catch((err: any) => {
      console.log(err)
      hasNextPageRef.current = false
      setHasNextPage(false)
      isFetchingRef.current = false
      isFetchingNextPageRef.current = false
    })
  }

  const handleToggleChecked = (index: number) => {
    setToolList(prev => {
      const newList = [...prev]
      newList[index].checked = !newList[index].checked
      if(newList[index].checked) {
        oapTools.push(newList[index])
      } else if(oapTools?.find(t => t.id === newList[index].id)) {
        const oapToolIndex = oapTools.findIndex(t => t.id === newList[index].id)
        oapTools.splice(oapToolIndex, 1)
      }
      return newList
    })
  }

  const handleConfirm = () => {
    const newOapTools = oapTools.filter(tool => !oriOapToolsRef.current.find((t: any) => t.id === tool.id))
    const highCostList = newOapTools.filter((tool: any) => tool.token_cost > HIGH_TOKEN_COST)
    const highCostListMap = highCostList.reduce((acc: { [key: string]: ToolItem[] }, tool: any) => {
      acc[tool.tags[0]] = [...(acc[tool.tags[0]] || []), tool]
      return acc
    }, {})
    if(highCostList.length > 0) {
      setHighCostList(highCostListMap)
    } else {
      setHighCostList({})
      handleApply()
    }
  }

  const handleApply = async () => {
    if (isSubmitting) {
      return
    }
    setIsSubmitting(true)
    const selectedServers = Array.from(
      new Set(oapTools.map(tool => tool.id))
    )
    await oapApplyMCPServer(selectedServers)
    setIsSubmitting(false)
    onConfirm()
    onCancel()
  }

  const handleBannerUrl = (url: string) => {
    if (url.startsWith("http")) {
      return url
    }
    return `${OAP_ROOT_URL}/${url}`
  }

  return (
    <>
      <PopupConfirm
        overlay
        className="oap-popup"
        onConfirm={handleConfirm}
        confirmText={
          isSubmitting ? (
            <div className="loading-spinner"></div>
          ) : (
            t("tools.save")
          )
        }
        disabled={isSubmitting}
        onCancel={onCancel}
        zIndex={1000}
        footerHint={
          !isOAPPro &&
          <div className="oap-footer-hint">
            <svg width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
              <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
              <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
            </svg>
            {t("tools.oap.hint")}
          </div>
        }
      >
        <div className="oap-container">
          <div className="oap-header">
            <div className="oap-title">
              <Button
                theme="TextOnly"
                color="success"
                size="small"
                shape="pill"
                svgFill="none"
                onClick={onCancel}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"></path>
                </svg>
              </Button>
              <img className="oap-logo" src={`${imgPrefix}logo_oap.png`} alt="info" />
              OAP MCP Servers
            </div>
            <div className="oap-search-wrapper">
              <div className="oap-search-container">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
                  <path stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2" d="m15 15 5 5"></path>
                  <path stroke="currentColor" strokeMiterlimit="10" strokeWidth="2" d="M9.5 17a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z">
                  </path>
                </svg>
                <WrappedInput
                  value={searchText || ""}
                  onChange={(e) => setSearchText(e.target.value || "")}
                  placeholder={t("models.searchPlaceholder")}
                  className="oap-search-input"
                />
                {searchText.length > 0 &&
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 18 18"
                    width="22"
                    height="22"
                    className="oap-search-clear"
                    onClick={() => setSearchText("")}
                  >
                    <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                  </svg>
                }
                <Select
                  className="oap-subscription"
                  options={[
                    {
                      label: t("tools.oap.type.all"),
                      value: "ALL",
                    },
                    {
                      label: t("tools.oap.type.base"),
                      value: "BASE",
                    },
                    {
                      label: t("tools.oap.type.pro"),
                      value: "PRO",
                    },
                  ]}
                  value={subscription}
                  onSelect={(value: string) => setSubscription(value as "ALL" | "BASE" | "PRO")}
                />
              </div>
            </div>
          </div>

          <div className="oap-filter">
            <div className="oap-sorts">
              <div className="oap-filter-label">{t("tools.oap.sort.title")}</div>
              <Tabs
                tabs={[
                  { label: t("tools.oap.sort.popular"), value: "popular" },
                  { label: t("tools.oap.sort.new"), value: "newest" },
                ]}
                value={sort}
                onChange={setSort}
              />
            </div>
            <div className="oap-filter-tags">
              <div className="oap-filter-label">{t("tools.oap.tag")}</div>
              <ScrollFade className="oap-filter-tags-container">
                {TAGS.map((_tag, index) => (
                  <div
                    className={`oap-filter-tag ${tag.includes(_tag) ? "active" : ""}`}
                    key={index}
                    onClick={() => setTag(tag.includes(_tag) ? tag.filter((t) => t !== _tag) : [...tag, _tag])}
                  >
                    {_tag}
                  </div>
                ))}
              </ScrollFade>
            </div>
          </div>

          <div className="oap-item-wrapper">
            {isFetchingRef.current ?
              <div className="default-loader">
                <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 22 22" preserveAspectRatio="xMidYMid">
                  <circle cx="11" cy="11" r="9" stroke="#ECEFF4" strokeWidth="2" strokeLinecap="round" fill="none"></circle>
                  <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                    <animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1.5s" values="0 11 11;180 11 11;720 11 11" keyTimes="0;0.5;1"></animateTransform>
                    <animate attributeName="stroke-dasharray" repeatCount="indefinite" dur="1.5s" values="1 100; 50 50; 1 100" keyTimes="0;0.5;1"></animate>
                  </circle>
                </svg>
                <span>{t("loading")}</span>
              </div>
            :
            toolList.length === 0 ?
              <div className="no-oap-result-container">
                <div className="cloud-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="41" height="41" viewBox="0 0 41 41" fill="none">
                    <path d="M24.4 40.3C23.9 40.5667 23.3917 40.6083 22.875 40.425C22.3583 40.2417 21.9667 39.9 21.7 39.4L18.7 33.4C18.4333 32.9 18.3917 32.3917 18.575 31.875C18.7583 31.3583 19.1 30.9667 19.6 30.7C20.1 30.4333 20.6083 30.3917 21.125 30.575C21.6417 30.7583 22.0333 31.1 22.3 31.6L25.3 37.6C25.5667 38.1 25.6083 38.6083 25.425 39.125C25.2417 39.6417 24.9 40.0333 24.4 40.3ZM36.4 40.3C35.9 40.5667 35.3917 40.6083 34.875 40.425C34.3583 40.2417 33.9667 39.9 33.7 39.4L30.7 33.4C30.4333 32.9 30.3917 32.3917 30.575 31.875C30.7583 31.3583 31.1 30.9667 31.6 30.7C32.1 30.4333 32.6083 30.3917 33.125 30.575C33.6417 30.7583 34.0333 31.1 34.3 31.6L37.3 37.6C37.5667 38.1 37.6083 38.6083 37.425 39.125C37.2417 39.6417 36.9 40.0333 36.4 40.3ZM12.4 40.3C11.9 40.5667 11.3917 40.6083 10.875 40.425C10.3583 40.2417 9.96667 39.9 9.7 39.4L6.7 33.4C6.43333 32.9 6.39167 32.3917 6.575 31.875C6.75833 31.3583 7.1 30.9667 7.6 30.7C8.1 30.4333 8.60833 30.3917 9.125 30.575C9.64167 30.7583 10.0333 31.1 10.3 31.6L13.3 37.6C13.5667 38.1 13.6083 38.6083 13.425 39.125C13.2417 39.6417 12.9 40.0333 12.4 40.3ZM11.5 28.5C8.46667 28.5 5.875 27.425 3.725 25.275C1.575 23.125 0.5 20.5333 0.5 17.5C0.5 14.7333 1.41667 12.3167 3.25 10.25C5.08333 8.18333 7.35 6.96667 10.05 6.6C11.1167 4.7 12.575 3.20833 14.425 2.125C16.275 1.04167 18.3 0.5 20.5 0.5C23.5 0.5 26.1083 1.45833 28.325 3.375C30.5417 5.29167 31.8833 7.68333 32.35 10.55C34.65 10.75 36.5833 11.7 38.15 13.4C39.7167 15.1 40.5 17.1333 40.5 19.5C40.5 22 39.625 24.125 37.875 25.875C36.125 27.625 34 28.5 31.5 28.5H11.5ZM11.5 24.5H31.5C32.9 24.5 34.0833 24.0167 35.05 23.05C36.0167 22.0833 36.5 20.9 36.5 19.5C36.5 18.1 36.0167 16.9167 35.05 15.95C34.0833 14.9833 32.9 14.5 31.5 14.5H28.5V12.5C28.5 10.3 27.7167 8.41667 26.15 6.85C24.5833 5.28333 22.7 4.5 20.5 4.5C18.9 4.5 17.4417 4.93333 16.125 5.8C14.8083 6.66667 13.8167 7.83333 13.15 9.3L12.65 10.5H11.4C9.5 10.5667 7.875 11.275 6.525 12.625C5.175 13.975 4.5 15.6 4.5 17.5C4.5 19.4333 5.18333 21.0833 6.55 22.45C7.91667 23.8167 9.56667 24.5 11.5 24.5Z" fill="currentColor"/>
                  </svg>
                </div>
                <div>
                  <div className="no-oap-result-title">
                    {t("tools.oap.no_search_data_title")}
                  </div>
                  <div className="no-oap-result-message">
                    {t("tools.oap.no_search_data")}
                  </div>
                </div>
                <Button
                  theme="Color"
                  color="primary"
                  size="medium"
                  onClick={() => {
                    setTag([])
                    setSubscription("ALL")
                    setSearchText("")
                  }}
                >
                  {t("tools.oap.clear_filter")}
                </Button>
              </div>
            :
              <div className="oap-grid" id="itemGrid">
                <InfiniteScroll
                  onNext={handleLoadNextPage}
                  hasMore={hasNextPage}
                  loaderText={t("loading")}
                >
                  {toolList.map((item: any, index: number) => {
                    return (
                      <label
                        key={index}
                        className={`oap-item ${(item.available === false && !item.checked) ? "disabled" : ""}`}
                        onClick={(e) => {
                          if (item.available === false && !item.checked) {
                            e.preventDefault()
                          }
                        }}
                      >
                        <div className="oap-item-container">
                          <div className="oap-item-img">
                            <img src={handleBannerUrl(item.banner)} alt={item.name} />
                            <span className="oap-tags">
                              {item?.popular && <span className="oap-tag popular">Popular</span>}
                              {item?.new && <span className="oap-tag new">New</span>}
                            </span>
                            <div className="oap-checkbox">
                              <CheckBox
                                checked={item.checked}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleToggleChecked(index)
                                }}
                              />
                            </div>
                          </div>
                          <div className="oap-item-content">
                            <div className="oap-item-content-top">
                              <div className="oap-content">
                                <div className="oap-content-title">
                                  <SearchHightLight text={item.name} searchText={searchText} />
                                  <InfoTooltip
                                    side="bottom"
                                    className="oap-content-title-tooltip"
                                    content={<ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      rehypePlugins={[rehypeKatex, rehypeRaw]}
                                      components={{
                                        code({node, className, children, ...props}) {
                                          const match = /language-(\w+)/.exec(className || "")
                                          const language = match ? match[1] : ""
                                          const code = String(children).replace(/\n$/, "")

                                          const inline = node?.position?.start.line === node?.position?.end.line
                                          if (inline) {
                                            return <code className={`${className} inline-code`} {...props}>{children}</code>
                                          }

                                          return (
                                            <div className="code-block">
                                              <SyntaxHighlighter
                                                language={language.toLowerCase()}
                                                style={theme === "dark" ? tomorrow : oneLight}
                                                customStyle={{
                                                  margin: 0,
                                                  padding: "12px",
                                                  background: "transparent"
                                                }}
                                              >
                                                {code}
                                              </SyntaxHighlighter>
                                              <button
                                                className="copy-btn"
                                                onClick={() => copyToClipboard(code)}
                                              >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                                                  <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                                                  <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                  <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round"/>
                                                  <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                              </button>
                                            </div>
                                          )
                                        },
                                        a({node, children, ...props}) {
                                          if (!node?.properties?.href && !node?.properties?.url) {
                                            return <span {...props}>{children}</span>
                                          }

                                          const url = node?.properties?.href || node?.properties?.url as string
                                          return <span {...props} className="oap-content-title-link" onClick={() => {
                                            openUrl(url as string)
                                          }}>{children}</span>
                                        }
                                      }}
                                    >{item.document}</ReactMarkdown>}
                                  >
                                    <div className="oap-content-title-hint">
                                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 23 22" width="18" height="18">
                                        <g clipPath="url(#ic_information_svg__a)">
                                          <circle cx="11.5" cy="11" r="10.25" stroke="currentColor" strokeWidth="1.5"></circle>
                                          <path fill="currentColor" d="M9.928 13.596h3.181c-.126-2.062 2.516-2.63 2.516-5.173 0-2.01-1.6-3.677-4.223-3.608-2.229.051-4.08 1.288-4.026 3.9h2.714c0-.824.593-1.168 1.222-1.185.593 0 1.258.326 1.222.962-.144 1.942-2.911 2.389-2.606 5.104Zm1.582 3.591c.988 0 1.779-.618 1.779-1.563 0-.963-.791-1.581-1.78-1.581-.97 0-1.76.618-1.76 1.58 0 .946.79 1.565 1.76 1.565Z"></path>
                                        </g>
                                        <defs>
                                          <clipPath id="ic_information_svg__a">
                                            <path fill="currentColor" d="M.5 0h22v22H.5z"></path>
                                          </clipPath>
                                        </defs>
                                      </svg>
                                    </div>
                                  </InfoTooltip>
                                </div>
                                <Tooltip
                                  content={`≈ ${item.token_required} OAPhub Tokens / ${item.token_price_unit}`}
                                >
                                  <div className="oap-cost">
                                    <span>$ {item.token_cost} / {item.token_price_unit}</span>
                                  </div>
                                </Tooltip>
                                <div className="oap-description">{item.description}</div>
                              </div>
                            </div>
                            <div className="oap-item-content-bottom">
                              <div className="oap-metadata-wrapper">
                                <div className="oap-metadata">
                                  <span className="oap-tags">
                                    <span className={`oap-tag ${item.plan}`}>{item.plan.toLowerCase()}</span>
                                    {item.tags.map((tag: string) => (
                                      <span key={tag} className="oap-tag">{tag}</span>
                                    ))}
                                  </span>
                                </div>
                                <button className="oap-store-link" onClick={() => window.open(`${OAP_ROOT_URL}/mcp/${item.id}`, "_blank")}>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 17 16" fill="none">
                                    <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </label>
                    )
                  })}
                </InfiniteScroll>
              </div>
            }
          </div>
        </div>
        <div className="oap-popup-footer"></div>
      </PopupConfirm>
      {Object.keys(highCostList).length > 0 &&
        <PopupConfirm
          className="oap-high-cost-popup"
          onConfirm={handleApply}
          onCancel={() => {
            setHighCostList({})
          }}
          zIndex={1001}
          footerType="center"
        >
          <div className="oap-high-cost-content">
            <div className="oap-high-cost-title">
              {t("tools.oap.high_cost_title")}
            </div>
            <div className="oap-high-cost-desc">
              {t("tools.oap.high_cost_desc")}
            </div>
            <div className="oap-high-cost-list">
              {Object.keys(highCostList).map((key: string, index: number) => {
                return (
                  <div key={index} className="oap-high-cost-item">
                    <div className="oap-high-cost-item-title">{key}</div>
                    <ul className="oap-high-cost-item-list">
                      {highCostList[key].map((item: any) => (
                        <Tooltip
                          key={item.id}
                          side="right"
                          content={`≈ ${item.token_required} OAPhub Tokens / ${item.token_price_unit}`}
                        >
                          <li>
                            <div className="oap-high-cost-item-name">
                              {item.name} <span className="oap-high-cost-item-cost">($ {item.token_cost} / {item.token_price_unit})</span>
                            </div>
                          </li>
                        </Tooltip>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        </PopupConfirm>
      }
    </>
  )
}

export default React.memo(OAPServerList)
