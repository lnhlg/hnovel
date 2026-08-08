import { z } from 'zod'

// 统一校验 IPC 入参：宽松 schema（未知字段透传），只拦截明显类型错误，
// 避免渲染进程或 AI 返回的脏数据写坏存储结构。

const optStr = z.string().optional()
const optNum = z.number().optional()

export const projectSaveSchema = z.object({
  id: z.string().min(1),
  name: optStr,
  description: optStr,
  synopsis: optStr,
  path: optStr,
  genre: optStr,
  status: optStr,
  worldBackground: optStr,
  storyProgress: optStr,
  writingStyleId: optStr,
  skillId: optStr,
  wordCountTarget: optNum
}).passthrough()

export const chapterSaveSchema = z.object({
  projectId: z.string().min(1),
  id: optStr,
  title: optStr,
  content: optStr,
  outline: optStr,
  status: optStr,
  sortOrder: optNum,
  wordCount: optNum,
  draftVersion: optNum,
  storyProgressSynced: optNum
}).passthrough()

export const characterSaveSchema = z.object({
  projectId: z.string().min(1),
  id: optStr,
  name: optStr,
  description: optStr,
  traits: optStr,
  age: optNum,
  appearance: optStr,
  background: optStr,
  personality: optStr,
  role: optStr,
  skills: optStr,
  relationships: optStr,
  motivation: optStr,
  flaws: optStr,
  growthArc: optStr,
  gender: optStr,
  dynasty: optStr,
  birthplace: optStr,
  heightBuild: optStr,
  face: optStr,
  hairstyle: optStr,
  clothing: optStr,
  talents: optStr,
  likes: optStr,
  importantEvents: optStr,
  relationshipsDetail: optStr,
  weaknesses: optStr,
  specialMarks: optStr
}).passthrough()

export const worldSettingSaveSchema = z.object({
  projectId: z.string().min(1),
  id: optStr,
  category: optStr,
  key: optStr,
  value: optStr,
  description: optStr,
  rules: optStr,
  relatedSettings: optStr,
  plotImpact: optStr,
  limitations: optStr,
  examples: optStr
}).passthrough()

export const timelineSaveSchema = z.object({
  projectId: z.string().min(1),
  id: optStr,
  title: optStr,
  description: optStr,
  date: optStr,
  chapterId: optStr,
  sortOrder: optNum
}).passthrough()

export const locationSaveSchema = z.object({
  projectId: z.string().min(1),
  id: optStr,
  name: optStr,
  type: optStr,
  description: optStr
}).passthrough()

export const itemSaveSchema = z.object({
  projectId: z.string().min(1),
  id: optStr,
  name: optStr,
  description: optStr,
  status: optStr,
  owner: optStr,
  chapterId: optStr,
  appearance: optStr,
  size: optStr,
  pattern: optStr
}).passthrough()

export const dialogueSaveSchema = z.object({
  projectId: z.string().min(1),
  id: optStr,
  speaker: optStr,
  with: optStr,
  content: optStr,
  context: optStr,
  chapterId: optStr,
  seq: optNum
}).passthrough()

export const relationSaveSchema = z.object({
  projectId: z.string().min(1),
  id: optStr,
  characterId1: optStr,
  characterId2: optStr,
  relation: optStr,
  description: optStr,
  strength: optNum
}).passthrough()

export const inspirationSaveSchema = z.object({
  projectId: z.string().min(1),
  id: optStr,
  title: optStr,
  type: optStr,
  content: optStr,
  source: optStr
}).passthrough()

export const referenceSaveSchema = z.object({
  projectId: z.string().min(1),
  id: optStr,
  title: optStr,
  type: optStr,
  url: optStr,
  notes: optStr
}).passthrough()

export const writingStyleSaveSchema = z.object({
  id: optStr,
  projectId: optStr,
  name: optStr,
  description: optStr,
  instructions: optStr,
  sortOrder: optNum
}).passthrough()

export const skillSaveSchema = z.object({
  id: optStr,
  name: optStr,
  description: optStr,
  category: optStr,
  content: optStr,
  sortOrder: optNum
}).passthrough()

export const aiChatOptionsSchema = z.object({
  stream: z.boolean().optional(),
  model: optStr,
  providerId: optStr,
  requestId: optStr,
  reasoningEffort: z.enum(['low', 'medium', 'high', 'max']).optional()
}).passthrough()

export const generateChapterOptsSchema = z.object({
  projectId: z.string().min(1),
  chapterId: z.string().min(1),
  synopsis: z.string().optional().default(''),
  chapterTitle: z.string().optional().default(''),
  chapterOutline: z.string().optional().default(''),
  providerId: optStr,
  model: optStr,
  requestId: optStr,
  previousChapters: z.array(z.object({ title: z.string(), content: z.string() })).optional().default([])
}).passthrough()

export const planChaptersOptsSchema = z.object({
  synopsis: z.string(),
  numChapters: z.number(),
  genre: optStr,
  providerId: optStr,
  model: optStr,
  requestId: optStr
}).passthrough()

export function validateOrThrow(schema: z.ZodType, data: unknown, label: string): void {
  const result = schema.safeParse(data)
  if (!result.success) {
    const detail = result.error.issues
      .slice(0, 5)
      .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    throw new Error(`IPC 参数校验失败（${label}）: ${detail}`)
  }
}
