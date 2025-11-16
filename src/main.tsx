// --- 这是 "src/main.tsx" 的全部内容 (V1.3) ---
// (V1.3 变更: 确保 index.css 被导入)

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// V1.3 变更: 必须导入此文件以应用全局样式
import './index.css' 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)