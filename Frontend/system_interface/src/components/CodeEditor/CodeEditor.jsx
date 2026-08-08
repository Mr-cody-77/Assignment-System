import React, { useState, useEffect } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import styles from './CodeEditor.module.css';

const LANGUAGES = [
  { value: 'python', label: 'Python', monaco: 'python' },
  { value: 'cpp', label: 'C / C++', monaco: 'cpp' },
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
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Read input from stdin (e.g., cin >> a >> b;)\n    // Write your C / C++ solution here\n    // Print output to stdout (e.g., cout << result << endl;)\n\n    return 0;\n}\n',
  java: 'public class Solution {\n    public static void main(String[] args) {\n        // Write your Java solution here\n    }\n}\n',
  javascript: '// Write your JavaScript solution here\n\nfunction solution() {\n    \n}\n',
};

// Explicitly tell monaco-editor to load assets from our local folder instead of the internet CDN.
// This MUST be called at the top level before the component renders.
loader.config({ paths: { vs: (process.env.PUBLIC_URL || '') + '/monaco/vs' } });

const CodeEditor = ({
  value,
  onChange,
  language = 'python',
  onLanguageChange,
  theme = 'vs-dark',
  onThemeChange,
  height = '100%',
  readOnly = false,
}) => {
  const [fullscreen, setFullscreen] = useState(false);
  const monacoLang = LANGUAGES.find((l) => l.value === language)?.monaco || 'python';

  const [monacoLoaded, setMonacoLoaded] = useState(false);
  const [monacoError, setMonacoError] = useState(false);

  useEffect(() => {
    let timeoutId = setTimeout(() => {
      if (!monacoLoaded) {
        console.warn("Monaco loading timed out, falling back to textarea.");
        setMonacoError(true);
      }
    }, 5000); // Increased timeout slightly for local loading

    loader.init()
      .then(() => {
        clearTimeout(timeoutId);
        setMonacoLoaded(true);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        console.error("Monaco loading failed:", err);
        setMonacoError(true);
      });

    return () => clearTimeout(timeoutId);
  }, [monacoLoaded]);

  // When language changes externally and code is empty/template, load new template
  useEffect(() => {
    if (!readOnly && (!value || Object.values(TEMPLATES).includes(value))) {
      onChange?.(TEMPLATES[language] || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly]);

  const handleLangChange = (e) => {
    const lang = e.target.value;
    
    if (readOnly) {
      onLanguageChange?.(lang);
      return;
    }

    const isDirty = value && !Object.values(TEMPLATES).includes(value);
    
    if (isDirty) {
      if (!window.confirm("Changing the language will delete your current code. Are you sure you want to proceed?")) {
        return;
      }
    }

    onLanguageChange?.(lang);
    onChange?.(TEMPLATES[lang] || '');
  };

  const container = fullscreen ? `${styles.container} ${styles.fullscreen}` : styles.container;

  return (
    <div className={container} style={fullscreen ? {} : { height }}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        {onLanguageChange ? (
          <select
            className={styles.select}
            value={language}
            onChange={handleLangChange}
            aria-label="Select language"
            disabled={readOnly}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        ) : (
          <div style={{ color: 'var(--clr-text-2)', fontSize: '14px', fontWeight: 'bold' }}>
            {LANGUAGES.find(l => l.value === language)?.label || language}
          </div>
        )}

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
        {monacoError ? (
          <textarea
            value={value}
            onChange={(e) => {
              if (!readOnly) onChange?.(e.target.value);
            }}
            readOnly={readOnly}
            placeholder="Type your solution here..."
            style={{
              width: '100%',
              height: '100%',
              background: theme === 'vs-light' ? '#ffffff' : '#1e1e1e',
              color: theme === 'vs-light' ? '#000000' : '#d4d4d4',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: '14px',
              padding: '16px',
              border: 'none',
              outline: 'none',
              resize: 'none',
            }}
          />
        ) : (
          <Editor
            height="100%"
            language={monacoLang}
            theme={theme}
            value={value}
            onChange={(v) => {
              if (!readOnly) onChange?.(v || '');
            }}
            options={{
              readOnly: readOnly,
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
              fontLigatures: false,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default CodeEditor;
