import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import styles from './CodeEditor.module.css';

const LANGUAGES = [
  { value: 'python', label: 'Python', monaco: 'python' },
  { value: 'cpp', label: 'C++', monaco: 'cpp' },
  { value: 'java', label: 'Java', monaco: 'java' },
  { value: 'javascript', label: 'JavaScript', monaco: 'javascript' },
];

const THEMES = [
  { value: 'vs-dark', label: '🌙 Dark' },
  { value: 'vs-light', label: '☀️ Light' },
  { value: 'hc-black', label: '🔲 High Contrast' },
];

const TEMPLATES = {
  python: '# Write your Python solution here\n\ndef solution():\n    pass\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Read input from stdin (e.g., cin >> a >> b;)\n    // Write your C++ solution here\n    // Print output to stdout (e.g., cout << result << endl;)\n\n    return 0;\n}\n',
  java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your Java solution here\n    }\n}\n',
  javascript: '// Write your JavaScript solution here\n\nfunction solution() {\n    \n}\n',
};

const CodeEditor = ({
  value,
  onChange,
  language = 'python',
  onLanguageChange,
  theme = 'vs-dark',
  onThemeChange,
  height = '100%',
}) => {
  const [fullscreen, setFullscreen] = useState(false);
  const monacoLang = LANGUAGES.find((l) => l.value === language)?.monaco || 'python';

  // When language changes externally and code is empty/template, load new template
  useEffect(() => {
    if (!value || Object.values(TEMPLATES).includes(value)) {
      onChange?.(TEMPLATES[language] || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const handleLangChange = (e) => {
    const lang = e.target.value;
    onLanguageChange?.(lang);
    // Only apply template if current code is empty or is a known template
    if (!value || Object.values(TEMPLATES).includes(value)) {
      onChange?.(TEMPLATES[lang] || '');
    }
  };

  const container = fullscreen ? `${styles.container} ${styles.fullscreen}` : styles.container;

  return (
    <div className={container} style={fullscreen ? {} : { height }}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <select
          className={styles.select}
          value={language}
          onChange={handleLangChange}
          aria-label="Select language"
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>

        <select
          className={styles.select}
          value={theme}
          onChange={(e) => onThemeChange?.(e.target.value)}
          aria-label="Select theme"
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <button
          className={`btn btn-ghost btn-sm ${styles.fullscreenBtn}`}
          onClick={() => setFullscreen((f) => !f)}
          title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {fullscreen ? '⊡ Exit' : '⛶ Full'}
        </button>
      </div>

      {/* Editor */}
      <div className={styles.editorWrap}>
        <Editor
          height="100%"
          language={monacoLang}
          theme={theme}
          value={value}
          onChange={(v) => onChange?.(v || '')}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            lineNumbers: 'on',
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
          }}
        />
      </div>
    </div>
  );
};

export default CodeEditor;
