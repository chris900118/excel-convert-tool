// --- 这是 "src/CodeViewer.tsx" 的全部内容 (V1.3) ---
// 这是一个用于显示代码高亮的可重用组件

import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// V1.3 新增：从库中导入 'oneLight' 浅色主题
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeViewerProps {
  codeString: string;
  language: string;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ codeString, language }) => {
  return (
    <SyntaxHighlighter
      language={language}
      style={oneLight}
      customStyle={{
        borderRadius: '4px',
        border: '1px solid #e8e8e8',
        padding: '16px',
        fontSize: '13px',
        marginTop: '16px' // V1.3 新增：与上方表格保持间距
      }}
      showLineNumbers={true} // V1.3 新增：显示行号
    >
      {codeString}
    </SyntaxHighlighter>
  );
};

export default CodeViewer;