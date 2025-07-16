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

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export default function DigitalPaintingTool() {
  // Layer state management
  const [layers, setLayers] = useState<Layer[]>(() => [
    {
      id: 'layer-1',
      name: 'Layer 1',
      visible: true,
      opacity: 100,
      canvasRef: React.createRef<HTMLCanvasElement>()
    },
    {
      id: 'layer-2', 
      name: 'Layer 2',
      visible: true,
      opacity: 100,
      canvasRef: React.createRef<HTMLCanvasElement>()
    }
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('layer-1');

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
  const [thumbnailUpdateTrigger, setThumbnailUpdateTrigger] = useState(0);

  // Get active layer
  const getActiveLayer = useCallback(() => {
    return layers.find(layer => layer.id === activeLayerId);
  }, [layers, activeLayerId]);

  // Get active canvas
  const getActiveCanvas = useCallback(() => {
    const activeLayer = getActiveLayer();
    return activeLayer?.canvasRef.current;
  }, [getActiveLayer]);

  // Initialize all layer canvases
  useEffect(() => {
    const initializeCanvas = (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const resizeCanvas = () => {
        const rect = canvas.getBoundingClientRect();
        const pixelRatio = window.devicePixelRatio || 1;
        
        const newWidth = Math.floor(rect.width * pixelRatio);
        const newHeight = Math.floor(rect.height * pixelRatio);
        
        if (canvas.width !== newWidth || canvas.height !== newHeight) {
          const imageData = canvas.width > 0 && canvas.height > 0 ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
          
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          ctx.scale(pixelRatio, pixelRatio);
          
          canvas.style.width = rect.width + 'px';
          canvas.style.height = rect.height + 'px';

          // Set transparent background for layers
          ctx.clearRect(0, 0, rect.width, rect.height);

          if (imageData) {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCanvas.width = imageData.width;
              tempCanvas.height = imageData.height;
              tempCtx.putImageData(imageData, 0, 0);
              ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
            }
          }

          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      };

      resizeCanvas();

      let resizeObserver: ResizeObserver | null = null;
      
      if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          resizeCanvas();
        });
        resizeObserver.observe(canvas);
      }

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
    };

    // Initialize all layer canvases
    const cleanupFunctions: (() => void)[] = [];
    layers.forEach(layer => {
      if (layer.canvasRef.current) {
        const cleanup = initializeCanvas(layer.canvasRef.current);
        if (cleanup) {
          cleanupFunctions.push(cleanup);
        }
      }
    });

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [layers]);

  // Get mouse position relative to canvas
  const getMousePosition = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = getActiveCanvas();
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, [getActiveCanvas]);

  // Flood fill algorithm
  const floodFill = useCallback((startX: number, startY: number, targetColor: string, fillColor: string) => {
    const canvas = getActiveCanvas();
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

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
    
    const hexToRgba = (hex: string, alpha: number = 255) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b, a: alpha };
    };

    const fillColorData = hexToRgba(fillColor, Math.round(brushSettings.opacity * 2.55));

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

      const index = (y * imageData.width + x) * 4;
      imageData.data[index] = fillColorData.r;
      imageData.data[index + 1] = fillColorData.g;
      imageData.data[index + 2] = fillColorData.b;
      imageData.data[index + 3] = fillColorData.a;

      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }

    ctx.putImageData(imageData, 0, 0);
  }, [getActiveCanvas, brushSettings.opacity]);

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPaintBucketMode) return;

    setIsProcessing(true);
    const position = getMousePosition(e);
    const canvas = getActiveCanvas();
    const ctx = canvas?.getContext('2d');
    
    if (!canvas || !ctx) {
      setIsProcessing(false);
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    const scaledX = Math.floor(position.x * pixelRatio);
    const scaledY = Math.floor(position.y * pixelRatio);

    const imageData = ctx.getImageData(scaledX, scaledY, 1, 1);
    const clickedColor = `rgb(${imageData.data[0]}, ${imageData.data[1]}, ${imageData.data[2]})`;
    
    setTimeout(() => {
      floodFill(scaledX, scaledY, clickedColor, brushSettings.color);
      setIsProcessing(false);
      // Trigger thumbnail update after flood fill
      setThumbnailUpdateTrigger(prev => prev + 1);
    }, 100);
  }, [isPaintBucketMode, getMousePosition, floodFill, brushSettings.color, getActiveCanvas]);

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

    const canvas = getActiveCanvas();
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const currentPosition = getMousePosition(e);
    
    if (lastPosition) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = brushSettings.opacity / 100;
      ctx.strokeStyle = brushSettings.color;
      ctx.lineWidth = brushSettings.size;
      
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

      switch (brushSettings.edgeStyle) {
        case 'sharp':
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

      if (brushSettings.smoothing) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
      }

      ctx.beginPath();
      ctx.moveTo(lastPosition.x, lastPosition.y);
      ctx.lineTo(currentPosition.x, currentPosition.y);
      ctx.stroke();
      
      ctx.shadowBlur = 0;
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
    }
    
    setLastPosition(currentPosition);
  }, [isDrawing, lastPosition, brushSettings, getMousePosition, getActiveCanvas]);

  // Stop drawing
  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    setLastPosition(null);
    // Trigger thumbnail update after drawing is complete
    setThumbnailUpdateTrigger(prev => prev + 1);
  }, []);

  // Layer management functions
  const addLayer = useCallback(() => {
    const newId = `layer-${Date.now()}`;
    const newLayer: Layer = {
      id: newId,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      opacity: 100,
      canvasRef: React.createRef<HTMLCanvasElement>()
    };
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newId);
  }, [layers.length]);

  const deleteLayer = useCallback((layerId: string) => {
    if (layers.length <= 1) return; // Keep at least one layer
    
    setLayers(prev => prev.filter(layer => layer.id !== layerId));
    
    if (activeLayerId === layerId) {
      const remainingLayers = layers.filter(layer => layer.id !== layerId);
      setActiveLayerId(remainingLayers[0]?.id || '');
    }
  }, [layers, activeLayerId]);

  const toggleLayerVisibility = useCallback((layerId: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, visible: !layer.visible }
        : layer
    ));
  }, []);

  const updateLayerOpacity = useCallback((layerId: string, opacity: number) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, opacity }
        : layer
    ));
  }, []);

  const renameLayer = useCallback((layerId: string, newName: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, name: newName }
        : layer
    ));
  }, []);

  // Generate thumbnail for layer preview
  const generateThumbnail = useCallback((canvas: HTMLCanvasElement | null): string => {
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      return '';
    }

    try {
      // Create a small thumbnail canvas
      const thumbnailCanvas = document.createElement('canvas');
      const thumbnailCtx = thumbnailCanvas.getContext('2d');
      if (!thumbnailCtx) return '';

      // Set thumbnail size (32x24 maintains 4:3 aspect ratio)
      const thumbnailWidth = 32;
      const thumbnailHeight = 24;
      thumbnailCanvas.width = thumbnailWidth;
      thumbnailCanvas.height = thumbnailHeight;

      // Draw the layer canvas scaled down
      thumbnailCtx.imageSmoothingEnabled = true;
      thumbnailCtx.imageSmoothingQuality = 'high';
      thumbnailCtx.drawImage(canvas, 0, 0, thumbnailWidth, thumbnailHeight);

      return thumbnailCanvas.toDataURL();
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error);
      return '';
    }
  }, []);

  // Clear active layer
  const clearCanvas = useCallback(() => {
    const canvas = getActiveCanvas();
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    // Trigger thumbnail update after clearing
    setThumbnailUpdateTrigger(prev => prev + 1);
  }, [getActiveCanvas]);

  // Save all layers as single image
  const saveCanvas = useCallback(() => {
    if (layers.length === 0) return;

    // Create a temporary canvas to combine all layers
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Use the first layer's dimensions
    const firstCanvas = layers[0].canvasRef.current;
    if (!firstCanvas) return;

    tempCanvas.width = firstCanvas.width;
    tempCanvas.height = firstCanvas.height;

    // Set white background
    tempCtx.fillStyle = 'white';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Composite all visible layers
    layers.forEach(layer => {
      if (layer.visible && layer.canvasRef.current) {
        tempCtx.globalAlpha = layer.opacity / 100;
        tempCtx.drawImage(layer.canvasRef.current, 0, 0);
      }
    });

    tempCtx.globalAlpha = 1;

    const link = document.createElement('a');
    link.download = 'my-painting.png';
    link.href = tempCanvas.toDataURL();
    link.click();
  }, [layers]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Digital Painting Tool</h1>
        <div className={styles.headerInfo}>
          <div className={styles.tooltipContainer}>
            <div className={styles.infoIcon}>
              i
              <div className={styles.tooltip}>
                Create beautiful digital art with multiple layers!
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

            {/* Layer Management Section */}
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Layers</h3>
              <div className={styles.sectionContent}>
                <div className={styles.layerControls}>
                  <button
                    onClick={addLayer}
                    className={styles.layerAddButton}
                    title="Add new layer"
                  >
                    <span className={styles.buttonIcon}>➕</span>
                    Add Layer
                  </button>
                </div>
                
                <div className={styles.layerList}>
                  {layers.map((layer, index) => {
                    // Include thumbnailUpdateTrigger to force refresh when needed
                    const thumbnailSrc = thumbnailUpdateTrigger >= 0 ? generateThumbnail(layer.canvasRef.current) : '';
                    return (
                      <div
                        key={layer.id}
                        className={`${styles.layerItem} ${activeLayerId === layer.id ? styles.layerItemActive : ''}`}
                        onClick={() => setActiveLayerId(layer.id)}
                      >
                        <div className={styles.layerInfo}>
                          <div className={styles.layerHeader}>
                            <div className={styles.layerNameSection}>
                              <div className={styles.layerThumbnail}>
                                {thumbnailSrc ? (
                                  <img 
                                    src={thumbnailSrc} 
                                    alt={`${layer.name} preview`}
                                    className={styles.thumbnailImage}
                                  />
                                ) : (
                                  <div className={styles.thumbnailPlaceholder}>
                                    <span className={styles.thumbnailIcon}>🖼️</span>
                                  </div>
                                )}
                              </div>
                              <span className={styles.layerName}>{layer.name}</span>
                            </div>
                            <div className={styles.layerActions}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLayerVisibility(layer.id);
                                }}
                                className={`${styles.layerVisibilityButton} ${!layer.visible ? styles.layerHidden : ''}`}
                                title={layer.visible ? 'Hide layer' : 'Show layer'}
                              >
                                {layer.visible ? '👁️' : '🙈'}
                              </button>
                              {layers.length > 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteLayer(layer.id);
                                  }}
                                  className={styles.layerDeleteButton}
                                  title="Delete layer"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                          <div className={styles.layerOpacity}>
                            <span className={styles.layerOpacityLabel}>Opacity:</span>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={layer.opacity}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateLayerOpacity(layer.id, parseInt(e.target.value));
                              }}
                              className={styles.layerOpacitySlider}
                              title={`Layer opacity: ${layer.opacity}%`}
                            />
                            <span className={styles.layerOpacityValue}>{layer.opacity}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                  <button onClick={clearCanvas} className={styles.canvasButton} title="Clear the active layer">
                    <span className={styles.buttonIcon}>🗑️</span>
                    Clear Layer
                  </button>
                  <button onClick={saveCanvas} className={styles.canvasButtonPrimary} title="Download your painting">
                    <span className={styles.buttonIcon}>💾</span>
                    Save Painting
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Canvas Container with Multiple Layers */}
          <div className={styles.canvasWrapper}>
            <div className={styles.layersContainer}>
              {layers.map((layer, index) => (
                <canvas
                  key={layer.id}
                  ref={layer.canvasRef}
                  className={`${styles.layerCanvas} ${activeLayerId === layer.id ? styles.activeLayer : ''} ${isPaintBucketMode ? styles.canvasBucketMode : ''} ${isProcessing ? styles.canvasProcessing : ''}`}
                  style={{
                    zIndex: index,
                    opacity: layer.visible ? layer.opacity / 100 : 0,
                    cursor: isPaintBucketMode ? 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkuNSAxMS41TDEyIDkuNUwxNiAxMy41TDE0IDcuNUwxNi41IDVMMjEuNSA5TDE5LjUgMTFMMTUuNSA3TDE0LjUgMTAuNUwxOCAxNEwyMC41IDE2LjVMMTguNSAxOC41TDE2IDE2TDE0LjUgMTcuNUwxMyAxNkwxMS41IDE3LjVMOSAxNkw2LjUgMTMuNUw5IDEwLjVaIiBmaWxsPSIjZWM0ODk5Ii8+CjxyZWN0IHg9IjMiIHk9IjE2IiB3aWR0aD0iMTgiIGhlaWdodD0iNSIgcng9IjIiIGZpbGw9IiNlYzQ4OTkiLz4KPC9zdmc+") 12 12, pointer' : 'crosshair'
                  }}
                  onMouseDown={activeLayerId === layer.id ? startDrawing : undefined}
                  onMouseMove={activeLayerId === layer.id ? draw : undefined}
                  onMouseUp={activeLayerId === layer.id ? stopDrawing : undefined}
                  onMouseLeave={activeLayerId === layer.id ? stopDrawing : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 