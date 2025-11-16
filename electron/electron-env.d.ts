/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// V1.3: 定义方案的数据结构
interface Scheme {
  name: string;
  sourceFile: string;
  templateFile: string;
  sourceSheet: number;
  templateSheet: number;
  mappings: Array<{ source: string, template: string }>;
}

// V1.3: 定义 processFiles 的参数
interface ProcessFilesArgs {
  sourceFile: { path: string, sheet: string };
  templateFile: { path: string, sheet: string };
  mappings: Array<{ source: string, template: string }>;
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer;
  api: {
    openFile: () => Promise<{ path: string; name: string; sheets: string[] } | null>;
    getHeaders: (filePath: string, sheetIdentifier: number | string) => Promise<string[]>;
    detectMergedCells: (filePath: string, sheetIdentifier: number | string) => Promise<boolean>;
    processFiles: (args: ProcessFilesArgs) => Promise<{ savePath: string; processedCount: number } | null>;
    loadSchemes: () => Promise<Scheme[]>;
    saveSchemes: (schemes: Scheme[]) => Promise<void>;
  };
  __preload_version__?: string;
}
