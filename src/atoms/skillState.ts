import { atom } from "jotai"
import { fetchSkills, type Skill } from "../ipc/skills"

export type { Skill } from "../ipc/skills"

export const skillsAtom = atom<Skill[]>([])

export const loadSkillsAtom = atom(null, async (_get, set) => {
  try {
    const skills = await fetchSkills()
    set(skillsAtom, skills)
  } catch (error) {
    console.error("Failed to load skills:", error)
    set(skillsAtom, [])
  }
})
