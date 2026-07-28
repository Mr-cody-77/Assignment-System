import React, { useState, useEffect, useCallback } from 'react';
import styles from './Timer.module.css';

const Timer = ({ durationMinutes, onTimeUp }) => {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const stored = localStorage.getItem('exam_end_time');
    if (stored) {
      const remaining = Math.max(0, Math.floor((parseInt(stored, 10) - Date.now()) / 1000));
      return remaining;
    }
    return durationMinutes * 60;
  });

  useEffect(() => {
    if (!localStorage.getItem('exam_end_time') && durationMinutes) {
      const endTime = Date.now() + durationMinutes * 60 * 1000;
      localStorage.setItem('exam_end_time', endTime.toString());
    }
  }, [durationMinutes]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onTimeUp?.();
      return;
    }

    const interval = setInterval(() => {
      const stored = localStorage.getItem('exam_end_time');
      if (stored) {
        const remaining = Math.max(0, Math.floor((parseInt(stored, 10) - Date.now()) / 1000));
        setSecondsLeft(remaining);
      } else {
        setSecondsLeft((prev) => Math.max(0, prev - 1));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft, onTimeUp]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft <= 300; // last 5 minutes
  const isCritical = secondsLeft <= 60; // last minute

  return (
    <div className={`${styles.timer} ${isUrgent ? styles.urgent : ''} ${isCritical ? styles.critical : ''}`}>
      <div className={styles.icon}>⏱️</div>
      <div className={styles.time}>
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      <div className={styles.label}>Remaining</div>
    </div>
  );
};

export default Timer;
