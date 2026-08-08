import { randomUUID } from 'crypto'
import { ipcMain } from 'electron'
import { WritingStyle, Skill,
  loadWritingStyles, saveWritingStyle, deleteWritingStyle, getNextWritingStyleSortOrder,
  loadSkills, saveSkill, deleteSkill, getNextSkillSortOrder
} from '../fileStorage'




import { now } from './helpers'
import { validateOrThrow, writingStyleSaveSchema, skillSaveSchema } from '../ipcValidation'



// ===== 写作风格 =====

export function registerWritingStyleHandlers(): void {
  ipcMain.handle('writingStyle:list', () => {
    return loadWritingStyles().sort((a, b) => a.sortOrder - b.sortOrder)
  })

  ipcMain.handle('writingStyle:save', (_event, data: Partial<WritingStyle>) => {
    validateOrThrow(writingStyleSaveSchema, data, 'writingStyle:save')
    const time = now()

    if (data.id) {
      const existing = loadWritingStyles().find(s => s.id === data.id)
      if (!existing) return undefined
      const style: WritingStyle = {
        ...existing,
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        instructions: data.instructions ?? existing.instructions,
        sortOrder: data.sortOrder ?? existing.sortOrder,
        updatedAt: time
      }
      saveWritingStyle(style)
      return style
    } else {
      const id = randomUUID()
      const sortOrder = getNextWritingStyleSortOrder()
      const style: WritingStyle = {
        id,
        projectId: '',
        name: data.name ?? '',
        description: data.description ?? '',
        instructions: data.instructions ?? '',
        sortOrder,
        createdAt: time,
        updatedAt: time
      }
      saveWritingStyle(style)
      return style
    }
  })

  ipcMain.handle('writingStyle:delete', (_event, id: string) => {
    deleteWritingStyle(id)
    return { success: true }
  })
}



// ===== 技能 =====

export function registerSkillHandlers(): void {
  ipcMain.handle('skill:list', () => {
    return loadSkills().sort((a, b) => a.sortOrder - b.sortOrder)
  })

  ipcMain.handle('skill:save', (_event, data: Partial<Skill>) => {
    validateOrThrow(skillSaveSchema, data, 'skill:save')
    const time = now()
    if (data.id) {
      const existing = loadSkills().find(s => s.id === data.id)
      if (!existing) return undefined
      const skill: Skill = {
        ...existing,
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        category: data.category ?? existing.category,
        content: data.content ?? existing.content,
        sortOrder: data.sortOrder ?? existing.sortOrder,
        updatedAt: time
      }
      saveSkill(skill)
      return skill
    } else {
      const id = randomUUID()
      const sortOrder = getNextSkillSortOrder()
      const skill: Skill = {
        id, name: data.name ?? '', description: data.description ?? '',
        category: data.category ?? '', content: data.content ?? '',
        sortOrder, createdAt: time, updatedAt: time
      }
      saveSkill(skill)
      return skill
    }
  })

  ipcMain.handle('skill:delete', (_event, id: string) => {
    deleteSkill(id)
    return { success: true }
  })
}
