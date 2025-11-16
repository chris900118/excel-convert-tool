// --- 这是 "electron/main.ts" 的全部内容 (V1.3 Merged Cell Refactor) ---

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import * as xlsx from 'xlsx';

// 声明窗口变量
let mainWindow: BrowserWindow | null = null;
let SCHEMES_FILE_PATH = ''; 


const createWindow = () => {
  mainWindow = new BrowserWindow({
    // --- 新增 (V1.3) ---
    title: 'Excel 数据转换工具 V1.3', 
    // --- 修改结束 ---
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // --- 新增 (V1.3) ---
  // 隐藏菜单栏 (File, Edit, etc.)
  mainWindow.setMenu(null);
  // --- 修改结束 ---

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// --- 应用程序生命周期 ---

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  SCHEMES_FILE_PATH = path.join(userDataPath, 'schemes.json');
  console.log(`方案文件路径设置为: ${SCHEMES_FILE_PATH}`);

  // 注册 IPC 监听器
  ipcMain.handle('dialog:openFile', handleFileOpen);
  ipcMain.handle('excel:getHeaders', handleGetHeaders);
  ipcMain.handle('excel:processFiles', handleProcessFiles);
  ipcMain.handle('schemes:load', handleLoadSchemes);
  ipcMain.handle('schemes:save', handleSaveSchemes);
  
  // 新增：注册合并单元格检测的 IPC handle
  ipcMain.handle('excel:detectMergedCells', handleDetectMergedCells);
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- 工具函数 ---
function getSheetFromWorkbook(workbook: xlsx.WorkBook, sheetIdentifier: number | string): { sheet: xlsx.WorkSheet | null, name: string | null } {
  let sheetName: string | undefined;

  if (typeof sheetIdentifier === 'number') {
    sheetName = workbook.SheetNames[sheetIdentifier];
  } else if (typeof sheetIdentifier === 'string') {
    if (workbook.SheetNames.includes(sheetIdentifier)) {
      sheetName = sheetIdentifier;
    } else {
      const index = parseInt(sheetIdentifier, 10);
      if (!isNaN(index) && index >= 0 && index < workbook.SheetNames.length) {
        sheetName = workbook.SheetNames[index];
      }
    }
  }

  if (sheetName && workbook.Sheets[sheetName]) {
    return { sheet: workbook.Sheets[sheetName], name: sheetName };
  }
  return { sheet: null, name: null };
}


// --- IPC 实现 ---

async function handleFileOpen() {
  if (!mainWindow) return { success: false, error: "主窗口未找到" };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: '选择 Excel 文件',
    filters: [{ name: 'Excel 文件', extensions: ['xlsx', 'xls', 'xlsb'] }],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return null; 
      const filePath = filePaths[0];
      const fileName = path.basename(filePath);
      try {
        const fileBuffer = fs.readFileSync(filePath);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        return { path: filePath, name: fileName, sheets: workbook.SheetNames }; // Return data directly
      } catch (err) {
        const error = err as Error;
        console.error("读取 Excel 文件失败:", error);
        // App.tsx will catch this as a null result and show an error message
        return null; 
      }}

// 新增：专门用于检测合并单元格的函数
async function handleDetectMergedCells(event, filePath: string, sheetIdentifier: number | string) {
  if (!filePath || sheetIdentifier === undefined) {
    return { success: true, data: false }; // 没有文件或 sheet，认为没有合并单元格
  }
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer', sheetRows: 5 }); // 只读少量行用于检测
    
    const { sheet, name } = getSheetFromWorkbook(workbook, sheetIdentifier);

    if (!sheet) {
      throw new Error(`Sheet with identifier "${sheetIdentifier}" 未找到.`);
    }

    // 核心检测逻辑
    const hasMergedCells = sheet['!merges'] && sheet['!merges'].length > 0;
    return hasMergedCells; // Return data directly

  } catch (err) {
    const error = err as Error;
    console.error(`检测合并单元格失败:`, error);
    return false; // Return false on error
  }
}


  // V1.3 API 实现 (读取表头 - 已重构)
async function handleGetHeaders(event, filePath: string, sheetIdentifier: number | string) {
  if (!filePath || sheetIdentifier === undefined) return []; // Return empty array
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer', sheetRows: 5, cellNF: false });
    
    const { sheet, name } = getSheetFromWorkbook(workbook, sheetIdentifier);

    if (!sheet) {
      const errorMsg = `Sheet with identifier "${sheetIdentifier}" 未找到.`;
      console.error(errorMsg);
      return []; // Return empty array
    }

    // 重要：此处的合并单元格检测逻辑已被移除
    
    const headers: any[][] = xlsx.utils.sheet_to_json(sheet, {
      header: 1, defval: '', raw: false
    });

    if (headers.length > 0) {
      const headerRow = headers[0].map(String).filter(h => h != null && h !== 'undefined' && h.trim() !== '');
      return headerRow; // Return data directly
    }
    return []; // Return empty array
  } catch (err) {
    const error = err as Error;
    console.error(`读取表头失败:`, error);
    return []; // Return empty array
  }
}

// --- V1.3 API 实现 (核心处理逻辑) ---
async function handleProcessFiles(event, args: any) {
  if (!mainWindow) return { success: false, error: "主窗口未找到" };
  const { canceled, filePath: savePath } = await dialog.showSaveDialog(mainWindow, {
    title: '保存处理结果',
    defaultPath: `Converted_${path.basename(args.sourceFile.path)}`,
    filters: [{ name: 'Excel 文件', extensions: ['xlsx'] }]
  });
  if (canceled || !savePath) return null;
  try {
    const sourceBuffer = fs.readFileSync(args.sourceFile.path);
    const sourceWorkbook = xlsx.read(sourceBuffer, { type: 'buffer' });
    if (!sourceWorkbook.Sheets[args.sourceFile.sheet]) {
      return { success: false, error: `源 Sheet "${args.sourceFile.sheet}" 未找到.` };
    }
    const sourceSheet = sourceWorkbook.Sheets[args.sourceFile.sheet];
    const sourceData = xlsx.utils.sheet_to_json(sourceSheet, { defval: null });
    
    const templateBuffer = fs.readFileSync(args.templateFile.path);
    const templateWorkbook = xlsx.read(templateBuffer, { type: 'buffer', sheetRows: 1 });
    if (!templateWorkbook.Sheets[args.templateFile.sheet]) {
      return { success: false, error: `模板 Sheet "${args.templateFile.sheet}" 未找到.` };
    }
    const templateSheet = templateWorkbook.Sheets[args.templateFile.sheet];
    const templateHeadersJson: any[][] = xlsx.utils.sheet_to_json(templateSheet, {
      header: 1, defval: '', raw: false
    });
    if (templateHeadersJson.length === 0) {
      return { success: false, error: "模板文件表头为空。" };
    }
    const templateHeaders = templateHeadersJson[0].map(String).filter(h => h != null && h !== 'undefined');
    const mappingMap = new Map(args.mappings.map((m: any) => [m.template, m.source]));
    const resultData = [];
    for (const sourceRow of sourceData) {
      const newRow: Record<string, any> = {};
      for (const templateCol of templateHeaders) {
        const sourceCol = mappingMap.get(templateCol);
        const sourceRowData = sourceRow as Record<string, any>;
        if (sourceCol && sourceRowData[sourceCol as string] !== undefined) {
          newRow[templateCol] = sourceRowData[sourceCol as string];
        } else {
          newRow[templateCol] = null;
        }
      }
      resultData.push(newRow);
    }
    const newWorksheet = xlsx.utils.json_to_sheet(resultData, { header: templateHeaders });
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "ConvertedData");
    const outputBuffer = xlsx.write(newWorkbook, { bookType: 'xlsx', type: 'buffer' });
    fs.writeFileSync(savePath, outputBuffer);
    return { savePath, processedCount: resultData.length }; // Return data directly
  } catch (err) {
    const error = err as Error;
    console.error("处理文件失败:", error);
    // App.tsx will catch this as a null result and show an error message
    return null;
  }
}

// --- V1.3 API 实现 (加载方案) ---
async function handleLoadSchemes() {
  if (!fs.existsSync(SCHEMES_FILE_PATH)) {
    console.log("方案文件不存在，返回空数组。");
    return []; // Return empty array directly
  }
  try {
    const data = fs.readFileSync(SCHEMES_FILE_PATH, 'utf-8');
    if (data.trim() === "") {
      return []; // Return empty array directly
    }
    return JSON.parse(data); // Return data directly
  } catch (err) {
    const error = err as Error;
    console.error("读取方案文件失败:", error);
    return []; // Return empty array on error
  }
}

// --- V1.3 API 实现 (保存方案) ---
async function handleSaveSchemes(event, schemes: any[]) {
  try {
    const data = JSON.stringify(schemes, null, 2);
    fs.writeFileSync(SCHEMES_FILE_PATH, data, 'utf-8');
    return; // Return undefined (void) on success
  } catch (err) {
    const error = err as Error;
    console.error("保存方案文件失败:", error);
    throw new Error(`保存方案失败: ${error.message}`); // Throw error for App.tsx to catch
  }
}