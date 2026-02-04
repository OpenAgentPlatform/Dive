export interface Skill {
  name: string
  description: string
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  allowed_tools?: string
}

interface SkillsResponse {
  success: boolean
  message?: string
  data: Skill[]
}

export async function fetchSkills(): Promise<Skill[]> {
  const response = await fetch("/api/skills/")
  if (!response.ok) {
    throw new Error(`Failed to fetch skills: ${response.statusText}`)
  }
  const result: SkillsResponse = await response.json()
  if (!result.success) {
    throw new Error(result.message || "Failed to fetch skills")
  }
  return result.data
}
