import React from 'react';
import styles from './SearchBar.module.css';

const SearchBar = ({ value, onChange, placeholder = 'Search…', onClear }) => (
  <div className={styles.wrapper}>
    <span className={styles.icon}>🔍</span>
    <input
      type="text"
      className={styles.input}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
    {value && (
      <button
        className={styles.clearBtn}
        onClick={() => { onChange(''); onClear?.(); }}
        aria-label="Clear search"
      >
        ✕
      </button>
    )}
  </div>
);

export default SearchBar;
