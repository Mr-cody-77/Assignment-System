import React from 'react';
import styles from './Header.module.css';

const Header = ({ title, subtitle, onMenuToggle, actions }) => (
  <header className={styles.header}>
    <button
      className={styles.menuBtn}
      onClick={onMenuToggle}
      aria-label="Toggle sidebar"
    >
      ☰
    </button>

    <div className={styles.titles}>
      {title && <h1 className={styles.title}>{title}</h1>}
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>

    {actions && <div className={styles.actions}>{actions}</div>}
  </header>
);

export default Header;
