/**
 * Excel 转换工具 (V1.3 - 日志重构)
 * * 核心变更：
 * 1. (需求 2) 日志自动滚动：`useEffect` 钩子现在会正确滚动新的日志 `div`。
 * 2. (需求 3) 日志显示图片：
 * - `log` 状态从 string 变为 `LogEntry[]` 数组。
 * - `logMsg` 现在添加文本条目。
 * - `handleProcess` 在成功后添加图片条目。
 * - JSX 中的 `<textarea>` 被替换为可渲染图片和文本的 `<div>`。
 */

import React, { useState, useRef, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import CodeViewer from './CodeViewer'; // 假设 CodeViewer.tsx 存在

// --- 类型定义 ---
interface FileState { name: string; path: string; }
interface SheetOption { label: string; value: number; }
interface Mapping { source: string; template: string; }
interface Scheme {
  name: string;
  sourceFile: string;
  templateFile: string;
  sourceSheet: number | string;
  templateSheet: number | string;
  mappings: Mapping[];
}
// (需求 3) 新增日志条目类型
interface LogEntry {
  type: 'text' | 'image';
  content: string;
}
const ItemTypes = { FIELD: 'field' };

// --- 主应用组件 (V1.3) ---
function App() {
  const logRef = useRef<HTMLDivElement>(null); // (需求 2) Ref 类型变为 HTMLDivElement
  
  // (需求 3) log 状态从 string 变为 LogEntry[]
  const [log, setLog] = useState<LogEntry[]>([
    { type: 'text', content: "欢迎使用 Excel 转换工具 (V1.3 稳定版)\n" }
  ]);

  // --- 状态管理 (无变化) ---
  const [fileA, setFileA] = useState<FileState | null>(null);
  const [fileB, setFileB] = useState<FileState | null>(null);
  const [sheetsA, setSheetsA] = useState<SheetOption[]>([]);
  const [sheetsB, setSheetsB] = useState<SheetOption[]>([]);
  const [selectedSheetA, setSelectedSheetA] = useState<number | undefined>(undefined);
  const [selectedSheetB, setSelectedSheetB] = useState<number | undefined>(undefined);
  const [headersA, setHeadersA] = useState<string[]>([]);
  const [headersB, setHeadersB] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMappingsJson, setShowMappingsJson] = useState(false);
  const [schemes, setSchemes] = useState<Scheme[]>([]); 
  const [selectedSchemeName, setSelectedSchemeName] = useState<string>(""); 
  const [schemeNameInput, setSchemeNameInput] = useState<string>(""); 
  const [activeTab, setActiveTab] = useState('mapping');
  
  // --- 模态框状态 (无变化) ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');

  // --- Hooks ---
  useEffect(() => {
    logMsg("应用启动，正在加载历史方案...");
    
    window.api.loadSchemes()
      .then(loadedSchemes => {
        setSchemes(loadedSchemes || []);
        logMsg(`成功加载 ${loadedSchemes?.length || 0} 个方案。`);
      })
      .catch(err => {
        const errorMsg = `加载历史方案失败: ${err.message}`;
        logMsg(`[错误] ${errorMsg}`);
        showErrorModal("加载失败", errorMsg);
      });
  }, []); 

  // (需求 3) logMsg 更新为添加对象
  const logMsg = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    // (需求 3) 修复日志条目格式，确保时间戳和换行符在 content 内部
    setLog((prev) => [...prev, { type: 'text', content: `[${timestamp}] ${msg}\n` }]);
  };

  // (需求 2) 自动滚动逻辑
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]); // 依赖 log 状态

  const clearSchemeSelection = () => {
    setSelectedSchemeName("");
    setSchemeNameInput("");
  };

  // --- 统一的错误模态框 ---
  const showErrorModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setIsModalVisible(true);
    // (需求 3) 错误也使用新的 logMsg
    logMsg(`[错误] ${title}: ${message}`);
  };

  // --- 统一的 Sheet 加载与检测逻辑 (无变化) ---
  const loadSheet = async (fileType: 'A' | 'B', sheetIndex: number, file: FileState | null, sheets: SheetOption[]) => {
    const setHeaders = fileType === 'A' ? setHeadersA : setHeadersB;
    const sheetName = sheets.find(s => s.value === sheetIndex)?.label;

    if (!file || sheetName === undefined) {
      return; 
    }

    setHeaders([]);
    setMappings([]); 
    logMsg(`正在加载 Sheet: "${sheetName}"...`);

    try {
      const hasMergedCells = await window.api.detectMergedCells(file.path, sheetIndex);

      if (hasMergedCells) {
        const errorMessage = `Sheet "${sheetName}" 中检测到不规范的合并单元格。请先在 Excel 中取消所有表头的合并，确保每一列在第一行都有一个唯一的名称，保存后再重新上传。`;
        showErrorModal("检测到合并单元格", errorMessage);
        return; 
      }

      logMsg(`正在读取 "${sheetName}" 的表头...`);
      const headers = await window.api.getHeaders(file.path, sheetIndex);
      
      if (headers && headers.length > 0) {
        setHeaders(headers);
        logMsg(`成功加载 ${headers.length} 个字段。`);
      } else {
        logMsg(`[警告] Sheet "${sheetName}" 中没有找到表头数据。`);
        setHeaders([]); 
      }
    } catch (error: any) {
      const errorMsg = `加载 Sheet "${sheetName}" 失败: ${error.message || error}`;
      showErrorModal("加载失败", errorMsg);
    }
  };

  // --- 文件与 Sheet 处理 (无变化) ---
  const handleUpload = async (fileType: 'A' | 'B') => {
    const setFile = fileType === 'A' ? setFileA : setFileB;
    const setSheets = fileType === 'A' ? setSheetsA : setSheetsB;
    const setHeaders = fileType === 'A' ? setHeadersA : setHeadersB;
    const setSelectedSheet = fileType === 'A' ? setSelectedSheetA : setSelectedSheetB;
    const logPrefix = fileType === 'A' ? "源文件" : "模板文件";

    const result = await window.api.openFile();
    
    if (result && result.path) { 
      const { path, name, sheets } = result;
      logMsg(`${logPrefix}已选择: ${path}`);
      
      const newFile = { name, path };
      const sheetOptions = sheets.map((s, i) => ({ label: s, value: i }));
      
      setFile(newFile);
      setSheets(sheetOptions);
      setHeaders([]);
      setMappings([]);
      clearSchemeSelection();

      if (sheetOptions.length > 0) {
        const firstSheetIndex = sheetOptions[0].value;
        setSelectedSheet(firstSheetIndex);
        await loadSheet(fileType, firstSheetIndex, newFile, sheetOptions);
      } else {
        setSelectedSheet(undefined);
        logMsg(`[警告] ${logPrefix}中没有找到任何 Sheet。`);
      }
    } else {
      logMsg(`${logPrefix}选择已取消或加载失败。`);
    }
  };

  const handleSelectSheetA = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSheetIndex = parseInt(e.target.value, 10);
    setSelectedSheetA(newSheetIndex);
    if (fileA) {
      await loadSheet('A', newSheetIndex, fileA, sheetsA);
    }
  };

  const handleSelectSheetB = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSheetIndex = parseInt(e.target.value, 10);
    setSelectedSheetB(newSheetIndex);
    if (fileB) {
      await loadSheet('B', newSheetIndex, fileB, sheetsB);
    }
  };

  // --- 核心功能 ---
  const handleFieldDrop = (sourceField: string, templateField: string) => {
    setMappings(prev => {
      if (prev.some(m => m.source === sourceField || m.template === templateField)) {
        showErrorModal("映射失败", "该字段已被映射"); 
        return prev;
      }
      logMsg(`[映射] ${sourceField} -> ${templateField}`);
      return [...prev, { source: sourceField, template: templateField }];
    });
  };

  const deleteMapping = (sourceField: string) => {
    setMappings(prev => prev.filter(m => m.source !== sourceField));
    logMsg(`[映射] 已删除 ${sourceField}`);
  };

  const handleProcess = async () => {
    if (!fileA || !fileB || selectedSheetA === undefined || selectedSheetB === undefined) {
      showErrorModal("无法转换", "请确保两个文件及其Sheet都已选择！");
      return;
    }
    if (mappings.length === 0) { 
      showErrorModal("无法转换", "请至少建立一个字段映射！");
      return;
    }
    
    setIsProcessing(true);
    setActiveTab('result');
    logMsg("--------------------");
    logMsg("开始处理...");
    
    const sourceSheetName = sheetsA.find(s => s.value === selectedSheetA)?.label;
    const templateSheetName = sheetsB.find(s => s.value === selectedSheetB)?.label;

    if (!sourceSheetName || !templateSheetName) {
      showErrorModal("处理失败", "无法找到选择的Sheet名称，请重新选择文件。");
      setIsProcessing(false);
      return;
    }

    const args = {
      sourceFile: { path: fileA.path, sheet: sourceSheetName },
      templateFile: { path: fileB.path, sheet: templateSheetName },
      mappings: mappings
    };
    
    try {
      const result = await window.api.processFiles(args);
      
      if (result && result.savePath) {
        const successMsg = `--- 处理成功！共处理 ${result.processedCount || '未知'} 条数据。文件已保存到: ${result.savePath}`;
        logMsg(successMsg);
        
        // (需求 3) 处理成功后，添加图片条目
        // 确保图片已按指示命名并放入 public 文件夹
        setLog((prev) => [...prev, { type: 'image', content: './log_image.png' }]); 

      } else if (result === null) {
        logMsg("用户取消了保存。");
      } else {
        throw new Error("处理文件失败，请检查文件内容。");
      }
    } catch (error: any) {
      showErrorModal("处理失败", error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- 方案管理 (无变化) ---
  const handleSaveScheme = async () => {
    const name = schemeNameInput.trim();
    if (!name) { 
      showErrorModal("保存失败", "请输入方案名称！");
      return;
    }
    if (!fileA || !fileB || selectedSheetA === undefined || selectedSheetB === undefined || mappings.length === 0) {
      showErrorModal("保存失败", "请确保文件、Sheet 和映射关系均已配置！");
      return;
    }
    
    logMsg(`正在保存方案: ${name}...`);
    const newScheme: Scheme = {
      name,
      sourceFile: fileA.name,
      templateFile: fileB.name,
      sourceSheet: selectedSheetA, 
      templateSheet: selectedSheetB, 
      mappings
    };
    
    const updatedSchemes = [...schemes];
    const existingIndex = updatedSchemes.findIndex(s => s.name === name);
    if (existingIndex !== -1) {
      updatedSchemes[existingIndex] = newScheme;
    } else {
      updatedSchemes.push(newScheme);
    }
    
    try {
      await window.api.saveSchemes(updatedSchemes);
      setSchemes(updatedSchemes); 
      setSelectedSchemeName(name); 
      logMsg(`方案 "${name}" 保存成功！`);
    } catch (error: any) {
      showErrorModal("保存方案失败", error.message);
    }
  };

  const handleLoadScheme = async () => {
    if (!selectedSchemeName) {
      showErrorModal("加载失败", "请先从下拉框选择一个方案！");
      return;
    }
    const schemeToLoad = schemes.find(s => s.name === selectedSchemeName);
    if (!schemeToLoad) {
      showErrorModal("加载失败", "未找到所选方案，请刷新！");
      return;
    }

    logMsg(`正在加载方案: ${schemeToLoad.name}...`);
    if (!fileA || !fileB || selectedSheetA === undefined || selectedSheetB === undefined) {
      showErrorModal("加载失败", "请先上传并选择源文件和模板文件的Sheet。");
      return;
    }
    
    logMsg("正在校验当前选择的Sheet内容是否满足方案要求...");

    const currentHeadersASet = new Set(headersA);
    const requiredHeadersA = [...new Set(schemeToLoad.mappings.map(m => m.source))];
    const missingInA = requiredHeadersA.filter(h => !currentHeadersASet.has(h));

    if (missingInA.length > 0) {
      const errorMsg = `加载失败: 当前选择的源文件Sheet缺少方案所需的字段: ${missingInA.join(', ')}`;
      showErrorModal("加载方案失败", errorMsg);
      return;
    }

    const currentHeadersBSet = new Set(headersB);
    const requiredHeadersB = [...new Set(schemeToLoad.mappings.map(m => m.template))];
    const missingInB = requiredHeadersB.filter(h => !currentHeadersBSet.has(h));

    if (missingInB.length > 0) {
        const errorMsg = `加载失败: 当前选择的模板文件Sheet缺少方案所需的字段: ${missingInB.join(', ')}`;
        showErrorModal("加载方案失败", errorMsg);
        return;
    }
    
    logMsg("文件内容校验通过，正在应用方案...");
    setMappings(schemeToLoad.mappings);
    setSchemeNameInput(schemeToLoad.name);
    setActiveTab('mapping');
    logMsg(`方案 "${schemeToLoad.name}" 加载成功！`);
  };

  const handleDeleteScheme = async () => {
    if (!selectedSchemeName) { 
      showErrorModal("删除失败", "请选择要删除的方案");
      return;
    }
    
    logMsg(`正在删除方案: ${selectedSchemeName}...`);
    const updatedSchemes = schemes.filter(s => s.name !== selectedSchemeName);

    try {
      await window.api.saveSchemes(updatedSchemes);
      setSchemes(updatedSchemes); 
      clearSchemeSelection(); 
      logMsg(`方案 "${selectedSchemeName}" 已删除。`);
    } catch (error: any) {
      showErrorModal("删除方案失败", error.message);
    }
  };

  // --- 辅助计算 (无变化) ---
  const mappedSources = new Set(mappings.map(m => m.source));
  const mappedTemplates = new Map(mappings.map(m => [m.template, m.source]));

  // --- 拖拽组件 (无变化) ---
  const DraggableField = ({ name, isMapped }: { name: string, isMapped: boolean }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
      type: ItemTypes.FIELD, item: { name }, canDrag: !isMapped,
      collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
    }), [name, isMapped]);
    return (
      <li ref={drag} className={`flex items-center justify-between p-3 bg-white rounded-md border shadow-sm ${isMapped ? 'opacity-50' : 'cursor-grab'} ${isDragging ? 'opacity-75' : ''}`}>
        <span className="text-sm text-gray-700">{name}</span>
        <svg className="w-5 h-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
      </li>
    );
  };

  const DroppableTarget = ({ name, onDrop, isMapped, mappedSource }: { name: string, onDrop: (source: string) => void, isMapped: boolean, mappedSource?: string }) => {
    const [{ isOver, canDrop }, drop] = useDrop(() => ({
      accept: ItemTypes.FIELD, canDrop: () => !isMapped,
      drop: (item: { name: string }) => onDrop(item.name),
      collect: (monitor) => ({ isOver: !!monitor.isOver(), canDrop: !!monitor.canDrop() }),
    }), [isMapped, onDrop]);

    if (isMapped) {
      return (
        <li className="flex items-center p-3 bg-green-50 rounded-md border border-green-300 shadow-sm">
          <span className="text-sm text-green-800 font-medium">{name}</span>
          <span className="text-xs text-green-600 ml-auto mr-2">(已映射: {mappedSource})</span>
          <svg onClick={() => deleteMapping(mappedSource!)} className="w-5 h-5 text-green-600 cursor-pointer" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </li>
      );
    }
    return (
      <li ref={drop} className={`flex items-center p-3 bg-white rounded-md border shadow-sm ${isOver && canDrop ? 'bg-blue-100 border-blue-400' : 'border-gray-300'}`}>
        <span className="text-sm text-gray-700">{name}</span>
      </li>
    );
  };

  // --- 最终的 JSX 渲染 ---
  return (
    <DndProvider backend={HTML5Backend}>
      {/* --- 错误模态框 --- */}
      {isModalVisible && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-xl transform transition-all duration-200 scale-100 opacity-100">
            {/* 模态框头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <div className="flex items-center">
                    <svg className="w-6 h-6 text-red-600 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.01" /></svg>
                    <h2 className="text-lg font-semibold text-gray-800">{modalTitle}</h2>
                </div>
                <button onClick={() => setIsModalVisible(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            {/* 模态框内容 */}
            <div className="p-6">
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{modalMessage}</p>
            </div>
            {/* 模态框尾部 */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-right rounded-b-lg">
                <button onClick={() => setIsModalVisible(false)} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                    好的，知道了
                </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 主布局 --- */}
      <div className="flex flex-col h-screen font-sans">
        {/* --- 头部 --- */}
        <header className="relative w-full h-[60px] flex text-white overflow-hidden z-10">
            <div className="absolute inset-0 z-0">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="#1F2937" />
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>
            <div className="relative z-10 flex items-center w-full">
                <div className="w-80 flex-shrink-0 px-6">
                    <div className="flex flex-col">
                      <span className="text-base font-medium">Excel 数据转换工具</span>
                      <span className="text-xs text-gray-200">V1.3 &nbsp; by 成都兴城融晟科技有限公司 张潇</span>
                    </div>
                </div>
                <div className="flex-1 flex items-end h-full">
                    <div onClick={() => setActiveTab('mapping')} className={`flex items-center h-full px-5 border-b-4 ${activeTab === 'mapping' ? 'border-white' : 'border-transparent'} cursor-pointer`}>
                        <span className={`text-sm font-medium ${activeTab === 'mapping' ? 'text-white' : 'text-gray-400 hover:text-white transition-colors'}`}>字段映射 (Mapping)</span>
                    </div>
                    <div onClick={() => setActiveTab('result')} className={`flex items-center h-full px-5 border-b-4 ${activeTab === 'result' ? 'border-white' : 'border-transparent'} cursor-pointer`}>
                        <span className={`text-sm font-medium ${activeTab === 'result' ? 'text-white' : 'text-gray-400 hover:text-white transition-colors'}`}>映射结果 (Result)</span>
                    </div>
                </div>
            </div>
        </header>

        {/* --- 主内容区 --- */}
        <div className="flex flex-1 overflow-hidden">
          {/* --- 左侧控制面板 --- */}
          <aside className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col justify-between">
            <div className="flex-1 p-5 overflow-y-auto">
              <section className="mb-6">
                <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">① 文件配置</h2>
                {/* --- 源文件 (A表) --- */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">源文件 (A表)</label>
                  {fileA ? (
                    <div className="flex items-center p-3 rounded-lg border-2 border-green-500 bg-green-50 text-green-800">
                      <svg className="w-5 h-5 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      <span className="text-sm truncate">{fileA.name}</span>
                      <span onClick={() => handleUpload('A')} className="text-xs ml-auto pl-2 text-green-600 font-medium cursor-pointer hover:underline">更换</span>
                    </div>
                  ) : (
                    <div onClick={() => handleUpload('A')} className="flex items-center justify-center p-4 rounded-lg border-2 border-dashed border-gray-300 bg-white text-gray-500 cursor-pointer hover:border-blue-500 hover:bg-blue-50">
                      <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3 3m3-3l3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
                      <span className="text-sm font-medium">点击或拖拽上传</span>
                    </div>
                  )}
                  <select value={selectedSheetA ?? ''} onChange={handleSelectSheetA} disabled={!fileA} className="mt-2 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm">
                    {fileA ? (sheetsA.length > 0 ? sheetsA.map(s => <option key={s.value} value={s.value}>{s.label}</option>) : <option>无 Sheet</option>) : <option>请先上传文件</option>}
                  </select>
                </div>
                {/* --- 模板文件 (B表) --- */}
                <div >
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">模板文件 (B表)</label>
                  {fileB ? (
                     <div className="flex items-center p-3 rounded-lg border-2 border-green-500 bg-green-50 text-green-800">
                      <svg className="w-5 h-5 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                      <span className="text-sm truncate">{fileB.name}</span>
                      <span onClick={() => handleUpload('B')} className="text-xs ml-auto pl-2 text-green-600 font-medium cursor-pointer hover:underline">更换</span>
                    </div>
                  ) : (
                    <div onClick={() => handleUpload('B')} className="flex items-center justify-center p-4 rounded-lg border-2 border-dashed border-gray-300 bg-white text-gray-500 cursor-pointer hover:border-blue-500 hover:bg-blue-50">
                      <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3 3m3-3l3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" /></svg>
                      <span className="text-sm font-medium">点击或拖拽上传</span>
                    </div>
                  )}
                  <select value={selectedSheetB ?? ''} onChange={handleSelectSheetB} disabled={!fileB} className="mt-2 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm">
                    {fileB ? (sheetsB.length > 0 ? sheetsB.map(s => <option key={s.value} value={s.value}>{s.label}</option>) : <option>无 Sheet</option>) : <option>请先上传文件</option>}
                  </select>
                </div>
              </section>
              {/* --- 方案管理 --- */}
              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">② 方案管理</h2>
                <div className="flex space-x-2">
                  <select value={selectedSchemeName} onChange={(e) => setSelectedSchemeName(e.target.value)} className="flex-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm">
                    <option value="">加载历史方案...</option>
                    {schemes.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                  <button onClick={handleLoadScheme} disabled={!selectedSchemeName} className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50">加载</button>
                  <button onClick={handleDeleteScheme} disabled={!selectedSchemeName} className="px-2 py-2 rounded-md border border-transparent bg-transparent text-sm font-medium text-gray-500 hover:text-red-600 disabled:opacity-50">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
                <div className="flex space-x-2 mt-3">
                  <input type="text" placeholder="保存为新方案..." value={schemeNameInput} onChange={(e) => setSchemeNameInput(e.target.value)} className="flex-1 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
                  <button onClick={handleSaveScheme} className="px-3 py-2 rounded-md border border-blue-600 text-sm font-medium text-blue-600 shadow-sm hover:bg-blue-50 disabled:opacity-50" disabled={!fileA || !fileB || mappings.length === 0}>
                    {schemes.some(s => s.name === schemeNameInput.trim()) ? "覆盖" : "保存"}
                  </button>
                </div>
              </section>
            </div>
            {/* --- 主操作按钮 --- */}
            <div className="p-5 border-t border-gray-200 bg-gray-50">
              <button onClick={handleProcess} disabled={isProcessing || !fileA || !fileB || mappings.length === 0} className="w-full bg-blue-600 text-white font-medium py-3 rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400">
                {isProcessing ? "转换中..." : "开始转换并另存"}
              </button>
            </div>
          </aside>

          {/* --- 右侧主工作区 --- */}
          <main className="flex-1 flex flex-col overflow-hidden bg-white">
            {/* --- 映射 Tab --- */}
            {activeTab === 'mapping' && (
              <div className="flex-1 flex p-6 space-x-6 overflow-hidden">
                <div className="flex-1 flex flex-col bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="px-4 py-3 text-sm font-medium text-gray-800 border-b border-gray-200">源字段 (A表) <span className="text-gray-400 font-normal">({headersA.length})</span></h3>
                  <ul className="flex-1 p-3 space-y-2 overflow-y-auto">
                    {headersA.length > 0 ? (
                      headersA.map(h => <DraggableField key={h} name={h} isMapped={mappedSources.has(h)} />)
                    ) : (
                      <div className="text-center text-gray-400 p-4">请先选择文件和Sheet</div>
                    )}
                  </ul>
                </div>
                <div className="flex-1 flex flex-col bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="px-4 py-3 text-sm font-medium text-gray-800 border-b border-gray-200">模板字段 (B表) <span className="text-gray-400 font-normal">({headersB.length})</span></h3>
                  <ul className="flex-1 p-3 space-y-2 overflow-y-auto">
                    {headersB.length > 0 ? (
                      headersB.map(h => <DroppableTarget key={h} name={h} isMapped={mappedTemplates.has(h)} mappedSource={mappedTemplates.get(h)} onDrop={(sf) => handleFieldDrop(sf, h)} />)
                    ) : (
                      <div className="text-center text-gray-400 p-4">请先选择文件和Sheet</div>
                    )}
                  </ul>
                </div>
              </div>
            )}
            {/* --- 结果 Tab --- */}
            {activeTab === 'result' && (
              <div className="flex-1 flex flex-col p-6 overflow-hidden">
                <div className="flex-1 flex flex-col border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 flex justify-between items-center border-b border-gray-200 bg-gray-50">
                    <h3 className="text-sm font-medium text-gray-800">映射结果预览</h3>
                    <button onClick={() => setShowMappingsJson(!showMappingsJson)} className="text-xs font-medium text-blue-600 hover:underline">
                      {showMappingsJson ? '隐藏 JSON' : '显示 JSON'}
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {showMappingsJson ? (
                      <CodeViewer language="json" codeString={JSON.stringify(mappings, null, 2)} />
                    ) : (
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">源 (A)</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">模板 (B)</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {mappings.map(m => (
                            <tr key={m.source}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{m.source}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{m.template}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                <button onClick={() => deleteMapping(m.source)} className="text-red-500 hover:text-red-700">删除</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                {/* --- 日志区 (V1.3 REFACTOR) --- */}
                <div className="h-48 flex flex-col border border-gray-200 rounded-lg overflow-hidden mt-6">
                  <h3 className="px-4 py-3 text-sm font-medium text-gray-800 border-b border-gray-200 bg-gray-50">运行日志</h3>
                  {/* (需求 2 & 3) 从 textarea 改为可滚动的 div */}
                  <div ref={logRef} className="flex-1 p-4 w-full h-full overflow-y-auto text-xs text-gray-600 bg-gray-50 font-mono resize-none focus:outline-none">
                    {log.map((entry, index) => {
                      if (entry.type === 'text') {
                        // 使用 <pre> 来保留换行符 \n
                        return <pre key={index} className="whitespace-pre-wrap font-mono">{entry.content}</pre>;
                      }
                      if (entry.type === 'image') {
                        // 渲染图片
                        return <img key={index} src={entry.content} alt="log image" className="my-2 max-w-[200px] rounded" />;
                      }
                      return null;
                    })}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </DndProvider>
  );
}

export default App;
