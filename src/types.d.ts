// --- 这是 "src/types.d.ts" 的全部内容 (V1.3 Merged Cell Refactor) ---

// V1.3: 定义方案的数据结构
interface Scheme {
  name: string;
  sourceFile: string;
  templateFile: string;
  sourceSheet: number; // Changed from number | string
  templateSheet: number; // Changed from number | string
  mappings: Array<{ source: string, template: string }>;
}

// V1.3: 定义 processFiles 的参数
interface ProcessFilesArgs {
  sourceFile: { path: string, sheet: string };
  templateFile: { path: string, sheet: string };
  mappings: Array<{ source: string, template: string }>;
}

// V1.3: 扩展 window.api 类型, 并使用更精确的返回类型
declare global {
  interface Window {
    api: {
      // V1.3
      openFile: () => Promise<{ path: string; name: string; sheets: string[] } | null>; // Adjusted return type
      
      // V1.3 (修正返回类型)
      getHeaders: (filePath: string, sheetIdentifier: number | string) => Promise<string[]>; // Adjusted return type

      // 新增
      detectMergedCells: (filePath: string, sheetIdentifier: number | string) => Promise<boolean>; // Adjusted return type
      
      // V1.3 (修正返回类型)
      processFiles: (args: ProcessFilesArgs) => Promise<{ savePath: string; processedCount: number } | null>; // Adjusted return type
      
      // V1.3 (修正返回类型)
      loadSchemes: () => Promise<Scheme[]>; // Adjusted return type
      saveSchemes: (schemes: Scheme[]) => Promise<void>; // Adjusted return type
    };
    // 用于调试预加载脚本版本
    __preload_version__?: string;
  }
}

// 导出一个空对象，以确保此文件被 TypeScript 视为一个模块
export {};