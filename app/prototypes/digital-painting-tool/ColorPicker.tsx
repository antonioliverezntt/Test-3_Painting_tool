'use client';

import React, { useState, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
}

const PRESET_COLORS = [
  '#FF4ECD', // Pink
  '#A855F7', // Purple 
  '#6366F1', // Indigo
  '#22D3EE', // Cyan
  '#FACC15', // Yellow
  '#F43F5E', // Rose
  '#10B981', // Emerald
  '#F97316'  // Orange
];

export default function ColorPicker({ color, onChange, className = '' }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Convert hex to RGB for display
  const hexToRgb = useCallback((hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 'rgb(0, 0, 0)';
    
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgb(${r}, ${g}, ${b})`;
  }, []);

  // Copy color to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(color);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy color to clipboard:', err);
    }
  }, [color]);

  // Handle preset color selection
  const handlePresetClick = useCallback((presetColor: string) => {
    onChange(presetColor);
  }, [onChange]);

  // Toggle picker visibility
  const togglePicker = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  return (
    <div className={`${styles.colorPickerContainer} ${className}`}>
      {/* Color Trigger Button */}
      <button
        type="button"
        onClick={togglePicker}
        className={styles.colorTrigger}
        style={{ backgroundColor: color }}
        title={`Current color: ${color}`}
      >
        <div className={styles.colorTriggerInner} style={{ backgroundColor: color }} />
      </button>

      {/* Color Picker Modal/Dropdown */}
      {isOpen && (
        <>
          {/* Mobile Backdrop */}
          <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
          
          {/* Picker Content */}
          <div className={styles.pickerWrapper}>
            <div className={styles.pickerContainer}>
              {/* Header */}
              <div className={styles.pickerHeader}>
                <h3 className={styles.pickerTitle}>Color Picker</h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className={styles.closeButton}
                >
                  ✕
                </button>
              </div>

              {/* Color Picker */}
              <div className={styles.pickerContent}>
                <div className={styles.colorPickerWrapper}>
                  <HexColorPicker 
                    color={color} 
                    onChange={onChange}
                    className={styles.reactColorful}
                  />
                </div>

                {/* Current Color Display */}
                <div className={styles.currentColorSection}>
                  <div className={styles.currentColorSwatch}>
                    <div 
                      className={styles.currentColorInner}
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  <div className={styles.colorInfo}>
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className={styles.colorValue}
                      title="Click to copy"
                    >
                      {color.toUpperCase()}
                      {copied && <span className={styles.copyFeedback}>Copied!</span>}
                    </button>
                    <div className={styles.rgbValue}>
                      {hexToRgb(color)}
                    </div>
                  </div>
                </div>

                {/* Preset Colors */}
                <div className={styles.presetsSection}>
                  <div className={styles.presetsLabel}>Presets</div>
                  <div className={styles.presetsGrid}>
                    {PRESET_COLORS.map((presetColor) => (
                      <button
                        key={presetColor}
                        type="button"
                        onClick={() => handlePresetClick(presetColor)}
                        className={`${styles.presetSwatch} ${
                          color.toLowerCase() === presetColor.toLowerCase() ? styles.presetActive : ''
                        }`}
                        style={{ backgroundColor: presetColor }}
                        title={presetColor}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 