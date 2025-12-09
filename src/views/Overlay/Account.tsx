import { useAtomValue, useSetAtom } from "jotai"
import { Trans, useTranslation } from "react-i18next"

import { isLoggedInOAPAtom, isOAPUsageLimitAtom, OAPLevelAtom, oapUsageAtom, oapUserAtom, oapLimiterCheckAtom, llmRateLimitReachedAtom, mcpRateLimitReachedAtom } from "../../atoms/oapState"
import { OAP_ROOT_URL } from "../../../shared/oap"

import Tooltip from "../../components/Tooltip"
import { openUrl } from "../../ipc/util"
import { oapLogout, openOapLoginPage } from "../../ipc/oap"
import Button from "../../components/Button"
import React, { useEffect } from "react"
import "../../styles/overlay/_Account.scss"
import { activeConfigAtom, writeEmptyConfigAtom } from "../../atoms/configState"

const USER_EDIT_URL = `${OAP_ROOT_URL}/u/account`
const USAGE_ANALYTICS_URL = `${OAP_ROOT_URL}/u/dashboard`
const PLAN_PAGE_URL = `${OAP_ROOT_URL}/u/plan`

const Account = () => {
  const { t } = useTranslation()
  const oapUsage = useAtomValue(oapUsageAtom)
  const isOAPUsageLimit = useAtomValue(isOAPUsageLimitAtom)
  const oapUser = useAtomValue(oapUserAtom)
  const oapLevel = useAtomValue(OAPLevelAtom)
  const oapLimiterCheck = useSetAtom(oapLimiterCheckAtom)
  const llmRateLimitReached = useAtomValue(llmRateLimitReachedAtom)
  const mcpRateLimitReached = useAtomValue(mcpRateLimitReachedAtom)
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const activeConfig = useAtomValue(activeConfigAtom)
  const writeEmptyConfig = useSetAtom(writeEmptyConfigAtom)

  const handleLogout = () => {
    if (activeConfig?.modelProvider === "oap") {
      writeEmptyConfig()
    }
    oapLogout()
  }

  const countFormat = (value: number) => {
    return "$" + parseFloat((value * (oapUser?.subscription?.PlanTokenPriceUnit ?? 0.000001)).toFixed(2))
  }

  useEffect(() => {
    const checkLimiter = async () => {
      if (isLoggedInOAP) {
        await oapLimiterCheck()
      }
    }
    checkLimiter()
  }, [])

  return (
    <div className="account-page">
      {!isLoggedInOAP ?
        <div className="profile-container">
          <div className="profile-header">
            <div>{t("system.loginTitle")}</div>
          </div>
          <p className="login-section-description">
            {t("system.loginDescription")}
          </p>
          <div className="login-section-button-group">
            <Button
              theme="Color"
              color="neutralGray"
              size="large"
              onClick={() => openOapLoginPage(false)}
            >
              {t("common.login")}
            </Button>
            <Button
              theme="Color"
              color="primary"
              size="large"
              onClick={() => openOapLoginPage(false)}
            >
              {t("common.signup")}
            </Button>
          </div>
        </div>
        :
        <div className="profile-container">
          <div className="profile-section">
            <div className="profile-header">
              <div>{t("system.personalInformationTitle")}</div>
            </div>
            <div className="user-info">
              <div className="avatar">
                {oapUser?.picture ?
                  <img src={oapUser?.picture} onError={() => {
                    return (
                      <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#e0f2fe"></stop>
                            <stop offset="100%" stopColor="#bfdbfe"></stop>
                          </linearGradient>
                        </defs>
                        <rect width="80" height="80" fill="url(#gradient)"></rect>
                        <circle cx="40" cy="30" r="16" fill="#94a3b8"></circle>
                        <circle cx="40" cy="90" r="40" fill="#94a3b8"></circle>
                      </svg>
                    )
                  }} />
                  :
                  <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#e0f2fe"></stop>
                        <stop offset="100%" stopColor="#bfdbfe"></stop>
                      </linearGradient>
                    </defs>
                    <rect width="80" height="80" fill="url(#gradient)"></rect>
                    <circle cx="40" cy="30" r="16" fill="#94a3b8"></circle>
                    <circle cx="40" cy="90" r="40" fill="#94a3b8"></circle>
                  </svg>
                }
              </div>
              <div className="user-details">
                <div className="user-name">
                  {oapUser?.username}
                  <Tooltip content={t("system.userEdit")}>
                    <button className="user-edit-btn" onClick={() => openUrl(USER_EDIT_URL)}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="23" viewBox="0 0 22 23" fill="none">
                        <path d="M3 14.1686V19.5001H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3.00088 14.0986L12.5245 4.62082C14.0006 3.15181 16.3939 3.15181 17.87 4.62082V4.62082C19.3461 6.08983 19.3461 8.47157 17.87 9.94058L8.34639 19.4183" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </Tooltip>
                </div>
                <div className="user-email">{oapUser?.email}</div>
              </div>
            </div>
          </div>

          <div className="plan-section">
            <div className="section-header">
              <div className="section-title">{t("system.planSectionTitle")}</div>
              <Tooltip content={t("system.usageAnalytics")}>
                <button className="analytics-btn" onClick={() => openUrl(USAGE_ANALYTICS_URL)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M3 5V17.5C3 18.3284 3.67157 19 4.5 19H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M3 11L7.5 7.5L10.5 11.5L16.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 13L7 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M11.5 15L11.5 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M16 12L16 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <span>{t("system.usageAnalyticsTitle")}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 17 16" fill="none">
                    <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
                  </svg>
                </button>
              </Tooltip>
            </div>

            <div className="plan-details">
              <div className="plan-badge">{oapLevel}</div>

              {oapLevel === "BASE" &&
                <div className="warning">
                  <svg className="warning-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10.0007 14.5833C10.2604 14.5833 10.4781 14.4954 10.6538 14.3197C10.8295 14.144 10.9173 13.9263 10.9173 13.6666V9.99992C10.9173 9.7402 10.8295 9.52249 10.6538 9.34679C10.4781 9.1711 10.2604 9.08325 10.0007 9.08325C9.74093 9.08325 9.52322 9.1711 9.34753 9.34679C9.17183 9.52249 9.08398 9.7402 9.08398 9.99992V13.6666C9.08398 13.9263 9.17183 14.144 9.34753 14.3197C9.52322 14.4954 9.74093 14.5833 10.0007 14.5833ZM10.0007 7.24992C10.2604 7.24992 10.4781 7.16207 10.6538 6.98638C10.8295 6.81068 10.9173 6.59297 10.9173 6.33325C10.9173 6.07353 10.8295 5.85582 10.6538 5.68013C10.4781 5.50443 10.2604 5.41659 10.0007 5.41659C9.74093 5.41659 9.52322 5.50443 9.34753 5.68013C9.17183 5.85582 9.08398 6.07353 9.08398 6.33325C9.08398 6.59297 9.17183 6.81068 9.34753 6.98638C9.52322 7.16207 9.74093 7.24992 10.0007 7.24992ZM10.0007 19.1666C8.7326 19.1666 7.54093 18.926 6.42565 18.4447C5.31037 17.9635 4.34023 17.3103 3.51523 16.4853C2.69023 15.6603 2.03711 14.6902 1.55586 13.5749C1.07461 12.4596 0.833984 11.268 0.833984 9.99992C0.833984 8.73186 1.07461 7.5402 1.55586 6.42492C2.03711 5.30964 2.69023 4.3395 3.51523 3.5145C4.34023 2.6895 5.31037 2.03638 6.42565 1.55513C7.54093 1.07388 8.7326 0.833252 10.0007 0.833252C11.2687 0.833252 12.4604 1.07388 13.5757 1.55513C14.6909 2.03638 15.6611 2.6895 16.4861 3.5145C17.3111 4.3395 17.9642 5.30964 18.4454 6.42492C18.9267 7.5402 19.1673 8.73186 19.1673 9.99992C19.1673 11.268 18.9267 12.4596 18.4454 13.5749C17.9642 14.6902 17.3111 15.6603 16.4861 16.4853C15.6611 17.3103 14.6909 17.9635 13.5757 18.4447C12.4604 18.926 11.2687 19.1666 10.0007 19.1666ZM10.0007 17.3333C12.0479 17.3333 13.7819 16.6228 15.2027 15.202C16.6236 13.7812 17.334 12.0471 17.334 9.99992C17.334 7.9527 16.6236 6.21867 15.2027 4.79784C13.7819 3.377 12.0479 2.66659 10.0007 2.66659C7.95343 2.66659 6.2194 3.377 4.79857 4.79784C3.37773 6.21867 2.66732 7.9527 2.66732 9.99992C2.66732 12.0471 3.37773 13.7812 4.79857 15.202C6.2194 16.6228 7.95343 17.3333 10.0007 17.3333Z"/>
                  </svg>
                  <div className="warning-text">
                    <Trans
                      i18nKey="system.BaseUsageWarning"
                      values={{
                        callLimit: 300,
                        callUnit: 6,
                        mcpLimit: 600
                      }}
                      components={{
                        planLink: <a className="plan-link" href={PLAN_PAGE_URL} target="_blank" rel="noopener noreferrer" />
                      }}
                    />
                  </div>
                </div>
              }

              {oapLevel === "PRO" && (
                <>
                  <div className="subscription-info">
                    <span className="info-label">{t("system.subscriptionDate")}：</span>
                    <span className="info-value">
                      {new Date(oapUser?.subscription.StartDate || "").toLocaleDateString() + `${oapUser?.subscription?.NextBillingDate ? " - "+ new Date(oapUser.subscription.NextBillingDate).toLocaleDateString() : ""}`}
                    </span>
                  </div>
                  <div className="subscription-info">
                    <span className="info-label">{t("system.remainingUsage")}：</span>
                    <span className="info-value">
                      {
                        (oapUsage?.total ?? 0) >= (oapUsage?.limit ?? 0)
                          ? t("system.usageExhausted")
                          : countFormat((oapUsage?.limit ?? 0) - (oapUsage?.total ?? 0))
                      }
                    </span>
                  </div>
                  {/* token usage */}
                  <div className="progress-wrapper">
                    <div className="progress-row">
                      <div className="progress-container">
                        <div className="progress-bar" style={
                          {
                            width: `${(oapUsage?.total ?? 0) / (oapUsage?.limit ?? 0) * 100}%`,
                            background: `linear-gradient(
                              to right,
                              var(--bg-pri-strong) 0%,
                              var(--bg-pri-strong) ${(oapUsage?.model ?? 0) / (oapUsage?.total ?? 0)  * 100}%,
                              var(--bg-pri-weak) ${(oapUsage?.model ?? 0) / (oapUsage?.total ?? 0)  * 100}%,
                              var(--bg-pri-weak) 100%
                            )`
                          }
                        }></div>
                      </div>
                      <div className="usage-details">
                        <div className="usage-color-circle model"></div>
                        Model <span className="usage-details-value">{countFormat(oapUsage?.model ?? 0)}</span>
                        <div className="usage-color-circle mcp"></div>
                        MCP <span className="usage-details-value">{countFormat(oapUsage?.mcp ?? 0)}</span>
                        / All token <span className="usage-details-value">{countFormat(oapUsage?.limit ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                  {isOAPUsageLimit &&
                    <div className="warning on-limit">
                      <svg className="warning-icon" width="20" height="18" viewBox="0 0 20 18" fill="none">
                        <path d="M1.49789 17.25C1.32983 17.25 1.17705 17.208 1.03955 17.124C0.902053 17.0399 0.795109 16.9292 0.71872 16.7917C0.642331 16.6542 0.600317 16.5052 0.592678 16.3448C0.585039 16.1844 0.627053 16.0278 0.71872 15.875L9.19789 1.20833C9.28955 1.05556 9.40796 0.940972 9.55309 0.864583C9.69823 0.788194 9.84719 0.75 9.99997 0.75C10.1527 0.75 10.3017 0.788194 10.4468 0.864583C10.592 0.940972 10.7104 1.05556 10.8021 1.20833L19.2812 15.875C19.3729 16.0278 19.4149 16.1844 19.4073 16.3448C19.3996 16.5052 19.3576 16.6542 19.2812 16.7917C19.2048 16.9292 19.0979 17.0399 18.9604 17.124C18.8229 17.208 18.6701 17.25 18.5021 17.25H1.49789ZM3.07914 15.4167H16.9208L9.99997 3.5L3.07914 15.4167ZM9.99997 14.5C10.2597 14.5 10.4774 14.4122 10.6531 14.2365C10.8288 14.0608 10.9166 13.8431 10.9166 13.5833C10.9166 13.3236 10.8288 13.1059 10.6531 12.9302C10.4774 12.7545 10.2597 12.6667 9.99997 12.6667C9.74025 12.6667 9.52254 12.7545 9.34684 12.9302C9.17115 13.1059 9.0833 13.3236 9.0833 13.5833C9.0833 13.8431 9.17115 14.0608 9.34684 14.2365C9.52254 14.4122 9.74025 14.5 9.99997 14.5ZM9.99997 11.75C10.2597 11.75 10.4774 11.6622 10.6531 11.4865C10.8288 11.3108 10.9166 11.0931 10.9166 10.8333V8.08333C10.9166 7.82361 10.8288 7.6059 10.6531 7.43021C10.4774 7.25451 10.2597 7.16667 9.99997 7.16667C9.74025 7.16667 9.52254 7.25451 9.34684 7.43021C9.17115 7.6059 9.0833 7.82361 9.0833 8.08333V10.8333C9.0833 11.0931 9.17115 11.3108 9.34684 11.4865C9.52254 11.6622 9.74025 11.75 9.99997 11.75Z"/>
                      </svg>
                      <div className="warning-text">
                        <div>
                          <div className="warning-text-title">
                            {t("system.usageWarningTitle")}
                          </div>
                          <div className="warning-text-description">
                            {t("system.usageWarning")}
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                </>
              )}

              {(llmRateLimitReached || mcpRateLimitReached) &&
                <div className="warning on-limit">
                  <svg className="warning-icon" width="20" height="18" viewBox="0 0 20 18" fill="none">
                    <path d="M1.49789 17.25C1.32983 17.25 1.17705 17.208 1.03955 17.124C0.902053 17.0399 0.795109 16.9292 0.71872 16.7917C0.642331 16.6542 0.600317 16.5052 0.592678 16.3448C0.585039 16.1844 0.627053 16.0278 0.71872 15.875L9.19789 1.20833C9.28955 1.05556 9.40796 0.940972 9.55309 0.864583C9.69823 0.788194 9.84719 0.75 9.99997 0.75C10.1527 0.75 10.3017 0.788194 10.4468 0.864583C10.592 0.940972 10.7104 1.05556 10.8021 1.20833L19.2812 15.875C19.3729 16.0278 19.4149 16.1844 19.4073 16.3448C19.3996 16.5052 19.3576 16.6542 19.2812 16.7917C19.2048 16.9292 19.0979 17.0399 18.9604 17.124C18.8229 17.208 18.6701 17.25 18.5021 17.25H1.49789ZM3.07914 15.4167H16.9208L9.99997 3.5L3.07914 15.4167ZM9.99997 14.5C10.2597 14.5 10.4774 14.4122 10.6531 14.2365C10.8288 14.0608 10.9166 13.8431 10.9166 13.5833C10.9166 13.3236 10.8288 13.1059 10.6531 12.9302C10.4774 12.7545 10.2597 12.6667 9.99997 12.6667C9.74025 12.6667 9.52254 12.7545 9.34684 12.9302C9.17115 13.1059 9.0833 13.3236 9.0833 13.5833C9.0833 13.8431 9.17115 14.0608 9.34684 14.2365C9.52254 14.4122 9.74025 14.5 9.99997 14.5ZM9.99997 11.75C10.2597 11.75 10.4774 11.6622 10.6531 11.4865C10.8288 11.3108 10.9166 11.0931 10.9166 10.8333V8.08333C10.9166 7.82361 10.8288 7.6059 10.6531 7.43021C10.4774 7.25451 10.2597 7.16667 9.99997 7.16667C9.74025 7.16667 9.52254 7.25451 9.34684 7.43021C9.17115 7.6059 9.0833 7.82361 9.0833 8.08333V10.8333C9.0833 11.0931 9.17115 11.3108 9.34684 11.4865C9.52254 11.6622 9.74025 11.75 9.99997 11.75Z"/>
                  </svg>
                  <div className="warning-text">
                    <div>
                      <div className="warning-text-title">
                        {(llmRateLimitReached && mcpRateLimitReached)
                          ? t("system.allRateLimitReachedTitle")
                          : llmRateLimitReached
                            ? t("system.llmRateLimitReachedTitle")
                            : t("system.mcpRateLimitReachedTitle")
                        }
                      </div>
                      <div className="warning-text-description">
                        {t("system.rateLimitReachedDescription")}
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>

          {oapLevel !== "BASE" && oapUsage && oapUsage.coupon && oapUsage.coupon.limit > 0 &&
            <div className="plan-section">
              <div className="section-header">
                <div className="section-title">
                  {t("system.tokenPackageTitle")}
                  <Tooltip content={t("system.tokenPackageHint")}>
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
                  </Tooltip>
                </div>
              </div>

              <div className="plan-details">

                <div className="subscription-info">
                  <span className="info-label">{t("system.tokenPackageRemainingUsage")}：</span>
                  <span className="info-value">
                    {
                      (oapUsage.coupon.total ?? 0) >= (oapUsage.coupon.limit ?? 0)
                        ? t("system.usageExhausted")
                        : countFormat((oapUsage.coupon.limit ?? 0) - (oapUsage.coupon.total ?? 0))
                    }
                  </span>
                </div>

                <div className="progress-wrapper">
                  <div className="progress-row">
                    <div className="progress-container">
                      <div className="progress-bar" style={
                        {
                          width: `${(oapUsage.coupon.total ?? 0) / (oapUsage.coupon.limit ?? 0) * 100}%`,
                          background: `linear-gradient(
                            to right,
                            var(--bg-pri-strong) 0%,
                            var(--bg-pri-strong) ${(oapUsage.coupon.model ?? 0) / (oapUsage.coupon.total ?? 0)  * 100}%,
                            var(--bg-pri-weak) ${(oapUsage.coupon.model ?? 0) / (oapUsage.coupon.total ?? 0)  * 100}%,
                            var(--bg-pri-weak) 100%
                          )`
                        }
                      }></div>
                    </div>
                    <div className="usage-details">
                      <div className="usage-color-circle model"></div>
                      Model <span className="usage-details-value">{countFormat(oapUsage.coupon.model ?? 0)}</span>
                      <div className="usage-color-circle mcp"></div>
                      MCP <span className="usage-details-value">{countFormat(oapUsage.coupon.mcp ?? 0)}</span>
                      / All token <span className="usage-details-value">{countFormat(oapUsage.coupon.limit ?? 0)}</span>
                    </div>
                  </div>
                </div>

                {oapUsage.coupon.limit > 0 && oapUsage.coupon.total >= oapUsage.coupon.limit &&
                  <div className="warning">
                    <svg className="warning-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M10.0007 14.5833C10.2604 14.5833 10.4781 14.4954 10.6538 14.3197C10.8295 14.144 10.9173 13.9263 10.9173 13.6666V9.99992C10.9173 9.7402 10.8295 9.52249 10.6538 9.34679C10.4781 9.1711 10.2604 9.08325 10.0007 9.08325C9.74093 9.08325 9.52322 9.1711 9.34753 9.34679C9.17183 9.52249 9.08398 9.7402 9.08398 9.99992V13.6666C9.08398 13.9263 9.17183 14.144 9.34753 14.3197C9.52322 14.4954 9.74093 14.5833 10.0007 14.5833ZM10.0007 7.24992C10.2604 7.24992 10.4781 7.16207 10.6538 6.98638C10.8295 6.81068 10.9173 6.59297 10.9173 6.33325C10.9173 6.07353 10.8295 5.85582 10.6538 5.68013C10.4781 5.50443 10.2604 5.41659 10.0007 5.41659C9.74093 5.41659 9.52322 5.50443 9.34753 5.68013C9.17183 5.85582 9.08398 6.07353 9.08398 6.33325C9.08398 6.59297 9.17183 6.81068 9.34753 6.98638C9.52322 7.16207 9.74093 7.24992 10.0007 7.24992ZM10.0007 19.1666C8.7326 19.1666 7.54093 18.926 6.42565 18.4447C5.31037 17.9635 4.34023 17.3103 3.51523 16.4853C2.69023 15.6603 2.03711 14.6902 1.55586 13.5749C1.07461 12.4596 0.833984 11.268 0.833984 9.99992C0.833984 8.73186 1.07461 7.5402 1.55586 6.42492C2.03711 5.30964 2.69023 4.3395 3.51523 3.5145C4.34023 2.6895 5.31037 2.03638 6.42565 1.55513C7.54093 1.07388 8.7326 0.833252 10.0007 0.833252C11.2687 0.833252 12.4604 1.07388 13.5757 1.55513C14.6909 2.03638 15.6611 2.6895 16.4861 3.5145C17.3111 4.3395 17.9642 5.30964 18.4454 6.42492C18.9267 7.5402 19.1673 8.73186 19.1673 9.99992C19.1673 11.268 18.9267 12.4596 18.4454 13.5749C17.9642 14.6902 17.3111 15.6603 16.4861 16.4853C15.6611 17.3103 14.6909 17.9635 13.5757 18.4447C12.4604 18.926 11.2687 19.1666 10.0007 19.1666ZM10.0007 17.3333C12.0479 17.3333 13.7819 16.6228 15.2027 15.202C16.6236 13.7812 17.334 12.0471 17.334 9.99992C17.334 7.9527 16.6236 6.21867 15.2027 4.79784C13.7819 3.377 12.0479 2.66659 10.0007 2.66659C7.95343 2.66659 6.2194 3.377 4.79857 4.79784C3.37773 6.21867 2.66732 7.9527 2.66732 9.99992C2.66732 12.0471 3.37773 13.7812 4.79857 15.202C6.2194 16.6228 7.95343 17.3333 10.0007 17.3333Z"/>
                    </svg>
                    <div className="warning-text">
                      <div>
                        <div className="warning-text-title">
                          {t("system.tokenPackageWarningTitle")}
                        </div>
                        <div className="warning-text-description">
                          <Trans i18nKey="system.tokenPackageWarning" components={{
                            planLink: <a className="plan-link" href={USAGE_ANALYTICS_URL} target="_blank" rel="noopener noreferrer" />
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
          {isLoggedInOAP &&
            <Button
              className="oap-logout-btn"
              theme="Color"
              color="neutralGray"
              size="medium"
              onClick={handleLogout}
            >
              {t("common.signout")}
            </Button>
          }
        </div>
      }
    </div>
  )
}

export default React.memo(Account)
