import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // 项目管理
  createProject: (name: string) => ipcRenderer.invoke('project:create', name),
  openProject: (path: string) => ipcRenderer.invoke('project:open', path),
  listProjects: () => ipcRenderer.invoke('project:list'),
  saveProject: (data: unknown) => ipcRenderer.invoke('project:save', data),
  deleteProject: (id: string) => ipcRenderer.invoke('project:delete', id),

  // 章节操作
  getChapters: (projectId: string) => ipcRenderer.invoke('chapter:list', projectId),
  saveChapter: (data: unknown) => ipcRenderer.invoke('chapter:save', data),
  deleteChapter: (id: string) => ipcRenderer.invoke('chapter:delete', id),
  createChapter: (projectId: string) => ipcRenderer.invoke('chapter:create', projectId),

  // 角色操作
  getCharacters: (projectId: string) => ipcRenderer.invoke('character:list', projectId),
  saveCharacter: (data: unknown) => ipcRenderer.invoke('character:save', data),
  deleteCharacter: (id: string) => ipcRenderer.invoke('character:delete', id),

  // 文件对话框
  showOpenDialog: (options: unknown) => ipcRenderer.invoke('dialog:open', options),
  showSaveDialog: (options: unknown) => ipcRenderer.invoke('dialog:save', options),
  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  readTextFile: (filePath: string) => ipcRenderer.invoke('file:readText', filePath),

  // 项目管理 — 含文件夹
  createProjectWithPath: (name: string, path: string) =>
    ipcRenderer.invoke('project:createWithPath', name, path),

  // AI
  aiChat: (messages: unknown[], options?: unknown) =>
    ipcRenderer.invoke('ai:chat', messages, options),

  onAiChunk: (callback: (chunk: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: string): void => callback(chunk)
    ipcRenderer.on('ai:chunk', handler)
    return () => ipcRenderer.removeListener('ai:chunk', handler)
  },

  // AI 供应商管理
  getCurrentConfig: () => ipcRenderer.invoke('ai:getCurrentConfig'),
  setModel: (model: string) => ipcRenderer.invoke('ai:setModel', model),
  listProviders: () => ipcRenderer.invoke('ai:listProviders'),
  saveProvider: (data: unknown) => ipcRenderer.invoke('ai:saveProvider', data),
  setActiveProvider: (providerId: string) => ipcRenderer.invoke('ai:setActiveProvider', providerId),
  deleteProvider: (providerId: string) => ipcRenderer.invoke('ai:deleteProvider', providerId),
  listModels: (providerId?: string) => ipcRenderer.invoke('ai:listModels', providerId),
  testConnection: (arg?: string | { type: string; baseUrl: string; apiKey?: string }) => ipcRenderer.invoke('ai:testConnection', arg),

  // 大纲
  saveProjectSynopsis: (projectId: string, synopsis: string) =>
    ipcRenderer.invoke('project:saveSynopsis', projectId, synopsis),
  saveChapterOutline: (chapterId: string, outline: string) =>
    ipcRenderer.invoke('chapter:saveOutline', chapterId, outline),

  // AI 生成
  generateChapter: (opts: unknown) => ipcRenderer.invoke('ai:generateChapter', opts),
  planChapters: (opts: unknown) => ipcRenderer.invoke('ai:planChapters', opts),

  // AI 向导（引导式项目创建）
  wizardInit: (sessionId: string) => ipcRenderer.invoke('wizard:init', sessionId),
  wizardSend: (sessionId: string, message: string, model?: string) => ipcRenderer.invoke('wizard:send', sessionId, message, model),
  wizardRegenerate: (sessionId: string, model?: string) => ipcRenderer.invoke('wizard:regenerate', sessionId, model),
  wizardCreateProject: (sessionId: string, folderPath: string) =>
    ipcRenderer.invoke('wizard:createProject', sessionId, folderPath),
  wizardEnd: (sessionId: string) => ipcRenderer.invoke('wizard:end', sessionId),
  onWizardChunk: (callback: (sessionId: string, chunk: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, sessionId: string, chunk: string): void =>
      callback(sessionId, chunk)
    ipcRenderer.on('wizard:chunk', handler)
    return () => ipcRenderer.removeListener('wizard:chunk', handler)
  },

  // AI 资产生成（角色/世界观/时间线/地点/关系/灵感/参考资料）
  generateAsset: (req: unknown) => ipcRenderer.invoke('ai:generateAsset', req),

  // 故事进展摘要
  getStoryProgress: (projectId: string) => ipcRenderer.invoke('storyProgress:get', projectId),
  saveStoryProgress: (projectId: string, storyProgress: string) =>
    ipcRenderer.invoke('storyProgress:save', projectId, storyProgress),
  autoUpdateStoryProgress: (projectId: string) => ipcRenderer.invoke('storyProgress:autoUpdate', projectId),

  // 世界观设定
  getWorldSettings: (projectId: string) => ipcRenderer.invoke('worldSettings:list', projectId),
  saveWorldSetting: (data: unknown) => ipcRenderer.invoke('worldSettings:save', data),
  deleteWorldSetting: (id: string) => ipcRenderer.invoke('worldSettings:delete', id),

  // 时间线
  getTimelines: (projectId: string) => ipcRenderer.invoke('timeline:list', projectId),
  saveTimeline: (data: unknown) => ipcRenderer.invoke('timeline:save', data),
  deleteTimeline: (id: string) => ipcRenderer.invoke('timeline:delete', id),

  // 地点场景
  getLocations: (projectId: string) => ipcRenderer.invoke('location:list', projectId),
  saveLocation: (data: unknown) => ipcRenderer.invoke('location:save', data),
  deleteLocation: (id: string) => ipcRenderer.invoke('location:delete', id),

  // 角色关系
  getCharacterRelations: (projectId: string) => ipcRenderer.invoke('characterRelation:list', projectId),
  saveCharacterRelation: (data: unknown) => ipcRenderer.invoke('characterRelation:save', data),
  deleteCharacterRelation: (id: string) => ipcRenderer.invoke('characterRelation:delete', id),

  // 灵感记录
  getInspirations: (projectId: string) => ipcRenderer.invoke('inspiration:list', projectId),
  saveInspiration: (data: unknown) => ipcRenderer.invoke('inspiration:save', data),
  deleteInspiration: (id: string) => ipcRenderer.invoke('inspiration:delete', id),

  // 写作日志
  getWritingLogs: (projectId: string) => ipcRenderer.invoke('writingLog:list', projectId),
  addWritingLog: (projectId: string, content: string) => ipcRenderer.invoke('writingLog:add', projectId, content),
  deleteWritingLog: (id: string) => ipcRenderer.invoke('writingLog:delete', id),

  // 参考资料
  getReferences: (projectId: string) => ipcRenderer.invoke('reference:list', projectId),
  saveReference: (data: unknown) => ipcRenderer.invoke('reference:save', data),
  deleteReference: (id: string) => ipcRenderer.invoke('reference:delete', id),

  // 写作风格（全局）
  getWritingStyles: () => ipcRenderer.invoke('writingStyle:list'),
  saveWritingStyle: (data: unknown) => ipcRenderer.invoke('writingStyle:save', data),
  deleteWritingStyle: (id: string) => ipcRenderer.invoke('writingStyle:delete', id),

  // 技能（全局）
  getSkills: () => ipcRenderer.invoke('skill:list'),
  saveSkill: (data: unknown) => ipcRenderer.invoke('skill:save', data),
  deleteSkill: (id: string) => ipcRenderer.invoke('skill:delete', id),

  // 文档读写（Markdown 原文）
  readDoc: (projectId: string, docType: string, entityId: string) =>
    ipcRenderer.invoke('doc:read', projectId, docType, entityId),
  saveDoc: (projectId: string, docType: string, entityId: string, content: string) =>
    ipcRenderer.invoke('doc:save', projectId, docType, entityId, content)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
