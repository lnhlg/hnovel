import { app, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { initStorage } from './fileStorage'
import { registerProjectHandlers, registerChapterHandlers, registerCharacterHandlers, registerDialogHandlers, registerAIOutlineHandlers, registerAIWizardHandlers, registerWorldSettingsHandlers, registerTimelineHandlers, registerLocationHandlers, registerItemHandlers, registerDialogueHandlers, registerCharacterRelationHandlers, registerInspirationHandlers, registerWritingLogHandlers, registerReferenceHandlers, registerAIAssetHandlers, registerDocHandlers, registerWritingStyleHandlers, registerSkillHandlers, registerSearchHandlers } from './ipc'
import { registerAIHandlers, loadActiveProvider } from './ai'
import { migrateAllProjects, normalizeAllProjects } from './storageMigration'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.novelwriter')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 初始化文件存储
  await initStorage()
  // 一次性迁移：JSON 实体写入书稿目录（迁移前强制备份）
  await migrateAllProjects()
  // 一次性规范化：消除章节 MD 里重复嵌入的章纲/标题
  await normalizeAllProjects()
  // 去除默认菜单栏
  Menu.setApplicationMenu(null)
  // 加载活跃的 AI 供应商配置
  loadActiveProvider()
  // 注册 IPC 处理器
  registerProjectHandlers()
  registerChapterHandlers()
  registerCharacterHandlers()
  registerWorldSettingsHandlers()
  registerTimelineHandlers()
  registerLocationHandlers()
  registerItemHandlers()
  registerDialogueHandlers()
  registerCharacterRelationHandlers()
  registerInspirationHandlers()
  registerWritingLogHandlers()
  registerReferenceHandlers()
  registerWritingStyleHandlers()
  registerSkillHandlers()
  registerAIOutlineHandlers()
  registerDialogHandlers()
  registerAIHandlers()
  registerAIWizardHandlers()
  registerAIAssetHandlers()
  registerDocHandlers()
  registerSearchHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
