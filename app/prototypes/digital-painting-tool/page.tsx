"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './styles.module.css';
import ColorPicker from './ColorPicker';

interface BrushSettings {
  size: number;
  color: string;
  shape: 'round' | 'square' | 'soft';
  opacity: number;
  smoothing: boolean;
  edgeStyle: 'sharp' | 'soft' | 'blurred';
}

interface Point {
  x: number;
  y: number;
}

export default function DigitalPaintingTool() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPaintBucketMode, setIsPaintBucketMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: 10,
    color: '#000000',
    shape: 'round',
    opacity: 100,
    smoothing: false,
    edgeStyle: 'sharp'
  });

  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null);

  // Initialize canvas with responsive sizing and ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Function to set canvas size based on displayed dimensions
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      
      // Only resize if dimensions have actually changed
      const newWidth = Math.floor(rect.width * pixelRatio);
      const newHeight = Math.floor(rect.height * pixelRatio);
      
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        // Save current drawing before resize
        const imageData = canvas.width > 0 && canvas.height > 0 ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
        
        // Set the actual size in memory (scaled for retina displays)
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // Scale the drawing context so everything draws at the correct size
        ctx.scale(pixelRatio, pixelRatio);
        
        // Set the display size (CSS pixels)
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';

        // Set white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, rect.width, rect.height);

        // Restore drawing if it existed
        if (imageData) {
          // Create a temporary canvas to restore the drawing
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCanvas.width = imageData.width;
            tempCanvas.height = imageData.height;
            tempCtx.putImageData(imageData, 0, 0);
            
            // Draw the previous content scaled to new size
            ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
          }
        }

        // Configure drawing settings
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    };

    // Initial resize
    resizeCanvas();

    // Use ResizeObserver for more efficient resize detection
    let resizeObserver: ResizeObserver | null = null;
    
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === canvas) {
            resizeCanvas();
          }
        }
      });
      resizeObserver.observe(canvas);
    }

    // Fallback to window resize for older browsers
    const handleResize = () => {
      setTimeout(resizeCanvas, 100);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Get mouse position relative to canvas (in CSS pixels)
  const getMousePosition = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  // Flood fill algorithm
  const floodFill = useCallback((startX: number, startY: number, targetColor: string, fillColor: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Convert colors to ImageData format for comparison
    const getColorAtPixel = (x: number, y: number, imageData: ImageData) => {
      const index = (y * imageData.width + x) * 4;
      return {
        r: imageData.data[index],
        g: imageData.data[index + 1],
        b: imageData.data[index + 2],
        a: imageData.data[index + 3]
      };
    };

    const colorsMatch = (color1: any, color2: any) => {
      return color1.r === color2.r && color1.g === color2.g && color1.b === color2.b && color1.a === color2.a;
    };

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const targetColorData = getColorAtPixel(startX, startY, imageData);
    
    // Convert hex color to RGBA
    const hexToRgba = (hex: string, alpha: number = 255) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b, a: alpha };
    };

    const fillColorData = hexToRgba(fillColor, Math.round(brushSettings.opacity * 2.55));

    // If target and fill colors are the same, no need to fill
    if (colorsMatch(targetColorData, fillColorData)) return;

    const stack: Point[] = [{ x: startX, y: startY }];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const key = `${x},${y}`;

      if (visited.has(key) || x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
        continue;
      }

      const currentColor = getColorAtPixel(x, y, imageData);
      if (!colorsMatch(currentColor, targetColorData)) {
        continue;
      }

      visited.add(key);

      // Fill the pixel
      const index = (y * imageData.width + x) * 4;
      imageData.data[index] = fillColorData.r;
      imageData.data[index + 1] = fillColorData.g;
      imageData.data[index + 2] = fillColorData.b;
      imageData.data[index + 3] = fillColorData.a;

      // Add neighboring pixels to stack
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }

    ctx.putImageData(imageData, 0, 0);
  }, [brushSettings.opacity]);

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPaintBucketMode) return;

    setIsProcessing(true);
    const position = getMousePosition(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!canvas || !ctx) {
      setIsProcessing(false);
      return;
    }

    // Account for device pixel ratio when getting pixel data
    const pixelRatio = window.devicePixelRatio || 1;
    const scaledX = Math.floor(position.x * pixelRatio);
    const scaledY = Math.floor(position.y * pixelRatio);

    // Get the color at the clicked position
    const imageData = ctx.getImageData(scaledX, scaledY, 1, 1);
    const clickedColor = `rgb(${imageData.data[0]}, ${imageData.data[1]}, ${imageData.data[2]})`;
    
    // Perform flood fill with a slight delay for visual feedback
    setTimeout(() => {
      floodFill(scaledX, scaledY, clickedColor, brushSettings.color);
      setIsProcessing(false);
    }, 100);
  }, [isPaintBucketMode, getMousePosition, floodFill, brushSettings.color]);

  // Start drawing
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPaintBucketMode) {
      handleCanvasClick(e);
      return;
    }
    setIsDrawing(true);
    const position = getMousePosition(e);
    setLastPosition(position);
  }, [isPaintBucketMode, handleCanvasClick, getMousePosition]);

  // Draw on canvas
  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isPaintBucketMode) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const currentPosition = getMousePosition(e);
    
    if (lastPosition) {
      ctx.globalCompositeOperation = 'source-over';
      
      // Apply opacity
      ctx.globalAlpha = brushSettings.opacity / 100;
      
      // Set stroke color and size
      ctx.strokeStyle = brushSettings.color;
      ctx.lineWidth = brushSettings.size;
      
      // Configure brush shape and edge style
      switch (brushSettings.shape) {
        case 'round':
          ctx.lineCap = 'round';
          break;
        case 'square':
          ctx.lineCap = 'square';
          break;
        case 'soft':
          ctx.lineCap = 'round';
          ctx.shadowColor = brushSettings.color;
          ctx.shadowBlur = brushSettings.size / 4;
          break;
      }

      // Apply edge style effects
      switch (brushSettings.edgeStyle) {
        case 'sharp':
          // No additional effects for sharp edges
          break;
        case 'soft':
          if (brushSettings.shape !== 'soft') {
            ctx.shadowColor = brushSettings.color;
            ctx.shadowBlur = brushSettings.size / 8;
          }
          break;
        case 'blurred':
          ctx.shadowColor = brushSettings.color;
          ctx.shadowBlur = brushSettings.size / 3;
          ctx.filter = `blur(${brushSettings.size / 20}px)`;
          break;
      }

      // Apply smoothing if enabled
      if (brushSettings.smoothing) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
      }

      ctx.beginPath();
      ctx.moveTo(lastPosition.x, lastPosition.y);
      ctx.lineTo(currentPosition.x, currentPosition.y);
      ctx.stroke();
      
      // Reset effects
      ctx.shadowBlur = 0;
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    }
    
    setLastPosition(currentPosition);
  }, [isDrawing, lastPosition, brushSettings, getMousePosition]);

  // Stop drawing
  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    setLastPosition(null);
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  // Save canvas as image
  const saveCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'my-painting.png';
    link.href = canvas.toDataURL();
    link.click();
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Digital Painting Tool</h1>
        <div className={styles.headerInfo}>
          <div className={styles.tooltipContainer}>
            <div className={styles.infoIcon}>
              i
              <div className={styles.tooltip}>
                Create beautiful digital art with your mouse!
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.paintingArea}>
          {/* Painting Controls */}
          <div className={styles.controls}>
            {/* Tool Mode Section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Tool Mode</h3>
              <div className={styles.sectionContent}>
                <div className={styles.toolModeButtons}>
                  <button
                    type="button"
                    onClick={() => setIsPaintBucketMode(false)}
                    className={`${styles.toolButton} ${!isPaintBucketMode ? styles.toolButtonActive : ''}`}
                    title="Free drawing mode"
                  >
                    <span className={styles.toolIcon}>🖌️</span>
                    <span className={styles.toolLabel}>Brush</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPaintBucketMode(true)}
                    className={`${styles.toolButton} ${isPaintBucketMode ? styles.toolButtonActive : ''}`}
                    title="Paint bucket fill mode"
                  >
                    <span className={styles.toolIcon}>🪣</span>
                    <span className={styles.toolLabel}>Fill</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Brush Settings Section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Brush Settings</h3>
              <div className={styles.sectionContent}>
                <div className={styles.controlGroup}>
                  <label className={styles.label}>Brush Size</label>
                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={brushSettings.size}
                      onChange={(e) => setBrushSettings(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                      className={styles.slider}
                      title={`Brush size: ${brushSettings.size}px`}
                    />
                    <span className={styles.sliderValue}>{brushSettings.size}px</span>
                  </div>
                </div>

                <div className={styles.controlGroup}>
                  <label className={styles.label}>Color</label>
                  <ColorPicker
                    color={brushSettings.color}
                    onChange={(color) => setBrushSettings(prev => ({ ...prev, color }))}
                    className={styles.customColorPicker}
                  />
                </div>

                <div className={styles.controlGroup}>
                  <label className={styles.label}>Shape</label>
                  <div className={styles.shapeButtons}>
                    {([
                      { value: 'round', icon: '●', label: 'Round' },
                      { value: 'square', icon: '■', label: 'Square' },
                      { value: 'soft', icon: '◉', label: 'Soft' }
                    ] as const).map((shape) => (
                      <button
                        key={shape.value}
                        type="button"
                        onClick={() => setBrushSettings(prev => ({ ...prev, shape: shape.value }))}
                        className={`${styles.shapeButton} ${brushSettings.shape === shape.value ? styles.shapeButtonActive : ''}`}
                        title={`${shape.label} brush shape`}
                      >
                        <span className={styles.shapeIcon}>{shape.icon}</span>
                        <span className={styles.shapeLabel}>{shape.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Stroke Effects Section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Stroke Effects</h3>
              <div className={styles.sectionContent}>
                <div className={styles.controlGroup}>
                  <label className={styles.label}>Opacity</label>
                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={brushSettings.opacity}
                      onChange={(e) => setBrushSettings(prev => ({ ...prev, opacity: parseInt(e.target.value) }))}
                      className={styles.slider}
                      title={`Stroke opacity: ${brushSettings.opacity}%`}
                    />
                    <span className={styles.sliderValue}>{brushSettings.opacity}%</span>
                  </div>
                </div>

                <div className={styles.controlGroup}>
                  <div className={styles.toggleRow}>
                    <label className={styles.label}>Smoothing</label>
                    <label className={styles.toggleContainer}>
                      <input
                        type="checkbox"
                        checked={brushSettings.smoothing}
                        onChange={(e) => setBrushSettings(prev => ({ ...prev, smoothing: e.target.checked }))}
                        className={styles.toggleInput}
                      />
                      <div className={styles.toggleSlider}>
                        <span className={styles.toggleIndicator}></span>
                      </div>
                      <span className={styles.toggleLabel}>
                        {brushSettings.smoothing ? 'On' : 'Off'}
                      </span>
                    </label>
                  </div>
                </div>

                <div className={styles.controlGroup}>
                  <label className={styles.label}>Edge Style</label>
                  <div className={styles.edgeButtons}>
                    {([
                      { value: 'sharp', icon: '⚡', label: 'Sharp' },
                      { value: 'soft', icon: '✨', label: 'Soft' },
                      { value: 'blurred', icon: '☁️', label: 'Blurred' }
                    ] as const).map((edge) => (
                      <button
                        key={edge.value}
                        type="button"
                        onClick={() => setBrushSettings(prev => ({ ...prev, edgeStyle: edge.value }))}
                        className={`${styles.edgeButton} ${brushSettings.edgeStyle === edge.value ? styles.edgeButtonActive : ''}`}
                        title={`${edge.label} edge style`}
                      >
                        <span className={styles.edgeIcon}>{edge.icon}</span>
                        <span className={styles.edgeLabel}>{edge.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Canvas Section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Canvas</h3>
              <div className={styles.sectionContent}>
                <div className={styles.canvasButtons}>
                  <button onClick={clearCanvas} className={styles.canvasButton} title="Clear the entire canvas">
                    <span className={styles.buttonIcon}>🗑️</span>
                    Clear Canvas
                  </button>
                  <button onClick={saveCanvas} className={styles.canvasButtonPrimary} title="Download your painting">
                    <span className={styles.buttonIcon}>💾</span>
                    Save Painting
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className={styles.canvasWrapper}>
            <canvas
              ref={canvasRef}
              className={`${styles.canvas} ${isPaintBucketMode ? styles.canvasBucketMode : ''} ${isProcessing ? styles.canvasProcessing : ''}`}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              style={{
                cursor: isPaintBucketMode ? 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkuNSAxMS41TDEyIDkuNUwxNiAxMy41TDE0IDcuNUwxNi41IDVMMjEuNSA5TDE5LjUgMTFMMTUuNSA3TDE0LjUgMTAuNUwxOCAxNEwyMC41IDE2LjVMMTguNSAxOC41TDE2IDE2TDE0LjUgMTcuNUwxMyAxNkwxMS41IDE3LjVMOSAxNkw2LjUgMTMuNUw5IDEwLjVaIiBmaWxsPSIjZWM0ODk5Ii8+CjxyZWN0IHg9IjMiIHk9IjE2IiB3aWR0aD0iMTgiIGhlaWdodD0iNSIgcng9IjIiIGZpbGw9IiNlYzQ4OTkiLz4KPC9zdmc+") 12 12, pointer' : 'crosshair'
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
} 