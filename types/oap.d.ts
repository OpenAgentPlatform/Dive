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
  tags?: string[] //for escaping pre-fetch
  text_tag?: boolean
  search_tag?: boolean
  document_tag?: boolean
  image_tag?: boolean
  audio_video_tag?: boolean
  page?: number
  /** 0 all, 1 base, 2 pro */
  filter?: 0 | 1 | 2
  /** 0 popular, 1 newest */
  "mcp-sort-order"?: 0 | 1
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