export interface MCPServerResponse {
  status: "success" | "error"
  error: string | null
  data: OAPMCPServer[]
}

export interface OAPMCPServer {
  id: string
  name: string
  plan: string
  description: string
  tags: string[]
  transport: string
  url: string
  headers: Record<string, string> | null
}

export interface OAPModelDescription {
  id: string
  model_id: string
  name: string
  icon: string
  provider: string
  token_cost: number
  description: string
  extra: {
      feature: string
      special: string[]
  }
}

export type OAPModelDescriptionParam = {
  models: string[]
}

export type ApiSuccess<T> = {
  status: "success"
  error: null
  data: T
}

export type ApiError = {
  status: "error"
  error: string
  data: null
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

export type MCPServerSearchParam = {
  search_input: string
  tags?: string[]
  page?: number
  /** 0 base, 1 pro */
  /** if is_official is true, this will be 0 */
  subscription_level?: 0 | 1
  /** if subscription_level is 1 or 2, this will be false */
  is_official?: boolean
  /** 0 popular, 1 newest */
  sort_order?: 0 | 1
}

export type OAPUser = {
  id: string
  email: string
  username: string
  picture: string
  team: string
  subscription: OAPSubscription
}

export type OAPSubscription = {
  IsDefaultPlan: boolean
  NextBillingDate: string
  PlanName: string
  StartDate: string
  Start: string
  End: string
  PlanTokenPriceUnit: number
}

export type OAPUsage = {
  limit: number
  mcp: number
  model: number
  total: number //mcp + model
  coupon: OAPCoupon
}

//token package
export type OAPCoupon = {
  model: number
  mcp: number
  total: number
  limit: number
}

export type OAPLimiterCheckParam = {
  /** User id */
  u: number
  /** Subscription Level: 0 = BASE, 1 = PRO */
  s: 0 | 1
  /** Out of Token */
  o: boolean
  /** Resource Type: 0 = LLM, 1 = MCP */
  r: 0 | 1
  /** Billing Type: 0 = FREE, 1 = PAID */
  /** always set to 0 */
  b: 0
}

export type OAPLimiterCheck = {
  /** PERMITED */
  p: boolean
  /** Call timeout duration (in seconds). */
  t: number
}

export type OAPMCPTag = {
  tag: string,
  count: number
}

export type OAPMCPTagsResponse = {
  body: OAPMCPTag[]
  error: null
  status_code: number
  status_message: string
}