// --- 这是 "electron/preload.ts" 的全部内容 (V6.3 Merged Cell Refactor) ---

import { contextBridge, ipcRenderer } from 'electron';

// 定义我们希望暴露给“渲染进程”(App.tsx) 的 API
const api = {
  // V3.0 API
  openFile: (): Promise<{ path: string; name: string; sheets: string[] } | null> => ipcRenderer.invoke('dialog:openFile'),
  
  // V4.0 API
  getHeaders: (filePath: string, sheetIndex: number | string): Promise<string[]> => 
    ipcRenderer.invoke('excel:getHeaders', filePath, sheetIndex),

  // 新增 API: 检测合并单元格
  detectMergedCells: (filePath: string, sheetIndex: number | string): Promise<boolean> =>
    ipcRenderer.invoke('excel:detectMergedCells', filePath, sheetIndex),

  // V5.0 API
  processFiles: (args: any): Promise<{ savePath: string; processedCount: number } | null> =>
    ipcRenderer.invoke('excel:processFiles', args),
  
  // V6.0 API
  loadSchemes: (): Promise<Scheme[]> =>
    ipcRenderer.invoke('schemes:load'),
  saveSchemes: (schemes: Scheme[]): Promise<void> =>
    ipcRenderer.invoke('schemes:save', schemes)
};

// --- 安全地暴露 API ---
try {
  contextBridge.exposeInMainWorld('api', api);
  // 在 window 对象上附加一个标记，以便在渲染器中检查
  contextBridge.exposeInMainWorld('__preload_version__', 'v6.3');
} catch (error) {
  console.error('预加载脚本暴露 API 失败:', error);
}