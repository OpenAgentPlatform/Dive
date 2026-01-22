import { atom } from "jotai"
import { oapGetUsage, oapLimiterCheck, oapLogout } from "../ipc"
import type { OAPMCPServer, OAPUsage, OAPUser } from "../../types/oap"
import { mcpConfigAtom } from "./toolState"

export const oapUserAtom = atom<OAPUser | null>(null)
export const oapUsageAtom = atom<OAPUsage | null>(null)
export const isLoggedInOAPAtom = atom((get) => get(oapUserAtom))
export const mcpRateLimitReachedAtom = atom<boolean>(false)

export const oapToolsAtom = atom<OAPMCPServer[]>([])

export const logoutOAPAtom = atom(null, (get, set) => {
  oapLogout()
  set(oapUserAtom, null)
  set(oapUsageAtom, null)
})

export const updateOAPUsageAtom = atom(null, async (get, set) => {
  if (!get(isLoggedInOAPAtom)) {
    return
  }

  const { data } = await oapGetUsage()
  set(oapUsageAtom, data)
})

export const isOAPUsageLimitAtom = atom((get) => {
  const OAPLevel = get(OAPLevelAtom)
  const oapUsage = get(oapUsageAtom)
  return oapUsage
        && OAPLevel !== "BASE"
        && oapUsage?.total >= oapUsage?.limit
        && ((oapUsage?.coupon?.limit ?? 0) === 0
          || (oapUsage?.coupon?.limit > 0 && oapUsage?.coupon?.total >= oapUsage?.coupon?.limit)
        )
})

export const OAPLevelAtom = atom((get) => {
  const oapUser = get(oapUserAtom)
  return oapUser?.subscription.PlanName
})

export const isOAPProAtom = atom((get) => {
  const OAPLevel = get(OAPLevelAtom)
  return OAPLevel === "PRO"
})

//OAP Tool is from local MCP config if extraData.oap.id exists
export const loadOapToolsAtom = atom(null, async (get, set) => {
  const mcpConfig = get(mcpConfigAtom)
  const oapData = Object.entries(mcpConfig.mcpServers)
    .filter(([_key, mcpServer]) => (mcpServer.extraData?.oap as Record<string, unknown> | undefined)?.id)
    .map(([key, val]) => {
      const oap = val.extraData?.oap as Record<string, unknown> | undefined
      return {
        id: (oap?.id as string) ?? "",
        name: key,
        plan: (oap?.plan as string) ?? val.plan ?? "",
        description: val.description ?? "",
        tags: (oap?.tags as string[]) ?? [],
        transport: (oap?.transport as string) ?? "",
        url: (oap?.url as string) ?? "",
        headers: (oap?.headers as Record<string, string>) ?? null,
      }
    })
  set(oapToolsAtom, oapData)
  return oapData
})

export const oapLimiterCheckAtom = atom(null, async (get, set) => {
  const oapUser = get(oapUserAtom)
  const oapUsage = get(oapUsageAtom)
  const OAP_LEVEL = get(OAPLevelAtom)
  if (!oapUsage || !oapUser || !OAP_LEVEL) {
    set(mcpRateLimitReachedAtom, false)
    return
  }

  const OAP_USER_ID = Number(oapUser?.id ?? 0)
  const IS_OUT_OF_TOKEN = ((oapUsage.total ?? 0) + (oapUsage?.coupon?.total ?? 0)) >= ((oapUsage?.limit ?? 0) + (oapUsage?.coupon?.limit ?? 0))

  // Only the MCP rate limit needs to be checked for now.
  const mcpData = await oapLimiterCheck({
    u: OAP_USER_ID, // User id
    s: OAP_LEVEL === "PRO" ? 1 : 0, // 0 = BASE, 1 = PRO
    o: IS_OUT_OF_TOKEN, // Out of Token
    r: 1, // 0 = LLM, 1 = MCP
    b: 0, // always set to 0
  })
  set(mcpRateLimitReachedAtom, mcpData.data?.p ?? false)

  return {
    mcp: mcpData.data?.p ?? false,
  }
})
