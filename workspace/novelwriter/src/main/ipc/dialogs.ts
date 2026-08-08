import { ipcMain, dialog, BrowserWindow } from 'electron'







// 用户最近通过文件对话框选中的路径（上限 200 条），file:readText 只允许读这些文件
const recentSelectedPaths = new Set<string>()
function rememberSelectedPaths(result: { filePaths?: string[]; filePath?: string }): void {
  for (const p of result.filePaths ?? []) {
    if (p) recentSelectedPaths.add(p)
  }
  if (result.filePath) recentSelectedPaths.add(result.filePath)
  while (recentSelectedPaths.size > 200) {
    const first = recentSelectedPaths.values().next().value
    if (first === undefined) break
    recentSelectedPaths.delete(first)
  }
}


export function registerDialogHandlers(): void {
  ipcMain.handle('dialog:open', async (event, options: Electron.OpenDialogOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, filePaths: [] }
    const result = await dialog.showOpenDialog(window, options)
    rememberSelectedPaths(result)
    return result
  })

  ipcMain.handle('dialog:save', async (event, options: Electron.SaveDialogOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, filePath: '' }
    const result = await dialog.showSaveDialog(window, options)
    rememberSelectedPaths(result)
    return result
  })

  ipcMain.handle('dialog:select-folder', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, filePaths: [] }
    const result = await dialog.showOpenDialog(window, {
      title: '选择项目文件夹',
      properties: ['openDirectory', 'createDirectory']
    })
    rememberSelectedPaths(result)
    return result
  })

  // 读取文件内容（用于章节大纲/正文导入）
  ipcMain.handle('file:readText', async (event, filePath: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, content: '' }
    // 只允许读取用户最近通过文件对话框选中的文件，避免任意路径读取
    if (typeof filePath !== 'string' || !recentSelectedPaths.has(filePath)) {
      return { canceled: true, content: '', error: '未授权读取该文件，请通过文件对话框重新选择' }
    }
    try {
      const { readFileSync } = await import('fs')
      const content = readFileSync(filePath, 'utf-8')
      return { canceled: false, content }
    } catch (err) {
      console.error('读取文件失败:', err)
      return { canceled: true, content: '', error: err instanceof Error ? err.message : String(err) }
    }
  })
}
