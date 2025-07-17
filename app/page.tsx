"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './prototypes/digital-painting-tool/styles.module.css';
import ColorPicker from './prototypes/digital-painting-tool/ColorPicker';

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

export default function Home() {
  // Initialize layers with 2 default layers
  const createLayer = (id: string, name: string): Layer => ({
    id,
    name,
    visible: true,
    opacity: 100,
    canvasRef: React.createRef<HTMLCanvasElement>()
  });

  const [layers, setLayers] = useState<Layer[]>(() => [
    createLayer('layer-1', 'Layer 1'),
    createLayer('layer-2', 'Layer 2')
  ]);
  
  const [activeLayerId, setActiveLayerId] = useState<string>('layer-1');
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPaintBucketMode, setIsPaintBucketMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Drag and drop state
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<string | null>(null);
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: 10,
    color: '#000000',
    shape: 'round',
    opacity: 100,
    smoothing: false,
    edgeStyle: 'sharp'
  });

  const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null);

  // Get the active layer
  const activeLayer = layers.find(layer => layer.id === activeLayerId);
  const activeCanvasRef = activeLayer?.canvasRef;

  // Layer management functions
  const createNewLayer = useCallback(() => {
    const nextLayerNumber = layers.length + 1;
    const newLayerId = `layer-${Date.now()}`;
    const newLayer = createLayer(newLayerId, `Layer ${nextLayerNumber}`);
    
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newLayerId);
  }, [layers.length]);

  const deleteLayer = useCallback((layerId: string) => {
    if (layers.length <= 1) return; // Don't delete if it's the last layer
    
    setLayers(prev => prev.filter(layer => layer.id !== layerId));
    
    // If deleting the active layer, switch to another layer
    if (activeLayerId === layerId) {
      const remainingLayers = layers.filter(layer => layer.id !== layerId);
      if (remainingLayers.length > 0) {
        setActiveLayerId(remainingLayers[0].id);
      }
    }
  }, [layers, activeLayerId]);

  const startEditingLayerName = useCallback((layerId: string, currentName: string) => {
    setEditingLayerId(layerId);
    setEditingLayerName(currentName);
  }, []);

  const saveLayerName = useCallback(() => {
    if (editingLayerId && editingLayerName.trim()) {
      setLayers(prev => prev.map(layer => 
        layer.id === editingLayerId 
          ? { ...layer, name: editingLayerName.trim() }
          : layer
      ));
    }
    setEditingLayerId(null);
    setEditingLayerName('');
  }, [editingLayerId, editingLayerName]);

  const cancelEditingLayerName = useCallback(() => {
    setEditingLayerId(null);
    setEditingLayerName('');
  }, []);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, layerId: string) => {
    setDraggedLayerId(layerId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', layerId);
    
    // Create a custom drag image with layer info
    const dragElement = e.currentTarget as HTMLElement;
    const rect = dragElement.getBoundingClientRect();
    e.dataTransfer.setDragImage(dragElement, rect.width / 2, rect.height / 2);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverLayerId(layerId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverLayerId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetLayerId: string) => {
    e.preventDefault();
    
    if (!draggedLayerId || draggedLayerId === targetLayerId) {
      setDraggedLayerId(null);
      setDragOverLayerId(null);
      return;
    }

    // Reorder layers
    setLayers(prev => {
      const draggedIndex = prev.findIndex(layer => layer.id === draggedLayerId);
      const targetIndex = prev.findIndex(layer => layer.id === targetLayerId);
      
      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const newLayers = [...prev];
      const [draggedLayer] = newLayers.splice(draggedIndex, 1);
      newLayers.splice(targetIndex, 0, draggedLayer);
      
      return newLayers;
    });

    setDraggedLayerId(null);
    setDragOverLayerId(null);
  }, [draggedLayerId]);

  const handleDragEnd = useCallback(() => {
    setDraggedLayerId(null);
    setDragOverLayerId(null);
  }, []);

  // Get canvas thumbnail for layer preview
  const getLayerThumbnail = useCallback((layer: Layer) => {
    const canvas = layer.canvasRef.current;
    if (!canvas) return null;
    
    try {
      // Create a small thumbnail canvas
      const thumbnailCanvas = document.createElement('canvas');
      const thumbnailCtx = thumbnailCanvas.getContext('2d');
      if (!thumbnailCtx) return null;
      
      // Set thumbnail size (40px square for w-10 h-10)
      const thumbnailSize = 40;
      thumbnailCanvas.width = thumbnailSize;
      thumbnailCanvas.height = thumbnailSize;
      
      // Fill with white background
      thumbnailCtx.fillStyle = '#FDFCFB';
      thumbnailCtx.fillRect(0, 0, thumbnailSize, thumbnailSize);
      
      // Draw the layer canvas scaled down
      thumbnailCtx.drawImage(canvas, 0, 0, thumbnailSize, thumbnailSize);
      return thumbnailCanvas.toDataURL();
    } catch (error) {
      return null;
    }
  }, []);

  // Trigger thumbnail regeneration when layers change
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  
  useEffect(() => {
    const generateThumbnails = () => {
      const newThumbnails: Record<string, string> = {};
      layers.forEach(layer => {
        const thumbnail = getLayerThumbnail(layer);
        if (thumbnail) {
          newThumbnails[layer.id] = thumbnail;
        }
      });
      setThumbnails(newThumbnails);
    };

    // Generate thumbnails after a short delay to ensure canvas content is rendered
    const timeoutId = setTimeout(generateThumbnails, 100);
    return () => clearTimeout(timeoutId);
  }, [layers, getLayerThumbnail]);

  // Update thumbnails when drawing stops or paint bucket operation completes
  useEffect(() => {
    if ((!isDrawing || !isProcessing) && layers.length > 0) {
      const timeoutId = setTimeout(() => {
        const newThumbnails: Record<string, string> = {};
        layers.forEach(layer => {
          const thumbnail = getLayerThumbnail(layer);
          if (thumbnail) {
            newThumbnails[layer.id] = thumbnail;
          }
        });
        setThumbnails(newThumbnails);
      }, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [isDrawing, isProcessing, layers, getLayerThumbnail]);

  // Initialize all layer canvases with responsive sizing and ResizeObserver
  useEffect(() => {
    if (layers.length === 0) return;

    // Function to set canvas size based on displayed dimensions for all layers
    const resizeAllCanvases = () => {
      const firstCanvas = layers[0]?.canvasRef.current;
      if (!firstCanvas) return;

      const rect = firstCanvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      
      const newWidth = Math.floor(rect.width * pixelRatio);
      const newHeight = Math.floor(rect.height * pixelRatio);

      layers.forEach(layer => {
        const canvas = layer.canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        // Only resize if dimensions have actually changed
        if (canvas.width !== newWidth || canvas.height !== newHeight) {
          // Save current content
          const imageData = canvas.width > 0 && canvas.height > 0 ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
          
          // Resize canvas
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          // Scale the drawing context so everything draws at the correct size
          ctx.scale(pixelRatio, pixelRatio);
          
          // Set the display size (CSS pixels)
          canvas.style.width = rect.width + 'px';
          canvas.style.height = rect.height + 'px';

          // For the first layer (background), set white background
          if (layer.id === layers[0]?.id) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, rect.width, rect.height);
          }

          // Restore content if it existed
          if (imageData) {
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
      });
    };

    // Initial resize
    resizeAllCanvases();

    // Use ResizeObserver for more efficient resize detection
    let resizeObserver: ResizeObserver | null = null;
    const firstCanvas = layers[0]?.canvasRef.current;
    
    if (window.ResizeObserver && firstCanvas) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === firstCanvas) {
            resizeAllCanvases();
          }
        }
      });
      resizeObserver.observe(firstCanvas);
    }

    // Fallback to window resize for older browsers
    const handleResize = () => {
      setTimeout(resizeAllCanvases, 100);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [layers]);

  // Get mouse position relative to canvas (in CSS pixels)
  const getMousePosition = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = activeCanvasRef?.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, [activeCanvasRef]);

  // Flood fill algorithm
  const floodFill = useCallback((startX: number, startY: number, targetColor: string, fillColor: string) => {
    const canvas = activeCanvasRef?.current;
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

      // Set pixel color
      const index = (y * imageData.width + x) * 4;
      imageData.data[index] = fillColorData.r;
      imageData.data[index + 1] = fillColorData.g;
      imageData.data[index + 2] = fillColorData.b;
      imageData.data[index + 3] = fillColorData.a;

      // Add adjacent pixels to stack
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }

    ctx.putImageData(imageData, 0, 0);
  }, [brushSettings.opacity, activeCanvasRef]);

  // Handle canvas click
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPaintBucketMode) return;

    setIsProcessing(true);
    const position = getMousePosition(e);
    const canvas = activeCanvasRef?.current;
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
  }, [isPaintBucketMode, getMousePosition, floodFill, brushSettings.color, activeCanvasRef]);

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

    const canvas = activeCanvasRef?.current;
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
      
      // Apply brush shape and edge style
      if (brushSettings.shape === 'round') {
        ctx.lineCap = brushSettings.edgeStyle === 'sharp' ? 'butt' : 'round';
      } else if (brushSettings.shape === 'square') {
        ctx.lineCap = 'square';
      } else if (brushSettings.shape === 'soft') {
        ctx.lineCap = 'round';
        ctx.shadowColor = brushSettings.color;
        ctx.shadowBlur = brushSettings.size * 0.3;
      }

      if (brushSettings.smoothing) {
        // Smooth line drawing
        const midX = (lastPosition.x + currentPosition.x) / 2;
        const midY = (lastPosition.y + currentPosition.y) / 2;
        
        ctx.beginPath();
        ctx.moveTo(lastPosition.x, lastPosition.y);
        ctx.quadraticCurveTo(lastPosition.x, lastPosition.y, midX, midY);
        ctx.stroke();
      } else {
        // Direct line drawing
        ctx.beginPath();
        ctx.moveTo(lastPosition.x, lastPosition.y);
        ctx.lineTo(currentPosition.x, currentPosition.y);
        ctx.stroke();
      }

      // Reset shadow
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    
    setLastPosition(currentPosition);
  }, [isDrawing, lastPosition, brushSettings, getMousePosition, activeCanvasRef]);

  // Stop drawing
  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    setLastPosition(null);
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = activeCanvasRef?.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, [activeCanvasRef]);

  // Save canvas as image
  const saveCanvas = useCallback(() => {
    const canvas = activeCanvasRef?.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'my-painting.png';
    link.href = canvas.toDataURL();
    link.click();
  }, [activeCanvasRef]);

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
                  <label className={styles.label}>Size</label>
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
                      <span className={styles.toggleSlider}></span>
                      <span className={styles.toggleText}>{brushSettings.smoothing ? 'ON' : 'OFF'}</span>
                    </label>
                  </div>
                </div>

                <div className={styles.controlGroup}>
                  <label className={styles.label}>Edge Style</label>
                  <div className={styles.edgeButtons}>
                    {([
                      { value: 'sharp', icon: '⚡', label: 'Sharp' },
                      { value: 'soft', icon: '🌟', label: 'Soft' },
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

            {/* Layers Section */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Layers</h3>
                <button
                  onClick={createNewLayer}
                  className={styles.addLayerButton}
                  title="Add new layer"
                >
                  <span className={styles.addLayerIcon}>+</span>
                </button>
              </div>
              <div className={styles.sectionContent}>
                <div className={styles.layersList}>
                  {[...layers].reverse().map((layer, index) => (
                    <div
                      key={layer.id}
                      className={`${styles.layerItem} ${layer.id === activeLayerId ? styles.layerItemActive : ''} ${
                        draggedLayerId === layer.id ? styles.layerDragging : ''
                      } ${dragOverLayerId === layer.id ? styles.layerDragOver : ''}`}
                      onClick={() => setActiveLayerId(layer.id)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, layer.id)}
                      onDragOver={(e) => handleDragOver(e, layer.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, layer.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className={styles.layerDragHandle} title="Drag to reorder layers">
                        <span className={styles.dragHandleIcon}>☰</span>
                      </div>
                      
                      <div className={styles.layerThumbnail}>
                        {thumbnails[layer.id] ? (
                          <img 
                            src={thumbnails[layer.id]} 
                            alt={`${layer.name} thumbnail`}
                            className={styles.thumbnailImage}
                          />
                        ) : (
                          <div className={styles.thumbnailPlaceholder}>
                            {layer.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      
                      <div className={styles.layerInfo}>
                        {editingLayerId === layer.id ? (
                          <input
                            type="text"
                            value={editingLayerName}
                            onChange={(e) => setEditingLayerName(e.target.value)}
                            onBlur={saveLayerName}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveLayerName();
                              if (e.key === 'Escape') cancelEditingLayerName();
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={styles.layerNameInput}
                            autoFocus
                          />
                        ) : (
                          <span 
                            className={styles.layerName}
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditingLayerName(layer.id, layer.name);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Click to edit layer name"
                          >
                            {layer.name}
                          </span>
                        )}
                        
                        <div className={styles.layerOpacity}>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={layer.opacity}
                            onChange={(e) => {
                              e.stopPropagation();
                              const newOpacity = parseInt(e.target.value);
                              setLayers(prev => prev.map(l => 
                                l.id === layer.id ? { ...l, opacity: newOpacity } : l
                              ));
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={styles.opacitySlider}
                            title={`Opacity: ${layer.opacity}%`}
                          />
                        </div>
                      </div>
                      
                      <div className={styles.layerControls}>
                        <button
                          className={`${styles.layerVisibilityButton} ${layer.visible ? styles.layerVisible : styles.layerHidden}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLayers(prev => prev.map(l => 
                              l.id === layer.id ? { ...l, visible: !l.visible } : l
                            ));
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          title={layer.visible ? 'Hide layer' : 'Show layer'}
                        >
                          {layer.visible ? '👁️' : '🙈'}
                        </button>
                        
                        {layers.length > 1 && (
                          <button
                            className={styles.layerDeleteButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteLayer(layer.id);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Delete layer"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Canvas Actions Section */}
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

          {/* Canvas Layers */}
          <div className={styles.canvasWrapper}>
            <div className={styles.layersContainer}>
              {layers.map((layer, index) => (
                <canvas
                  key={layer.id}
                  ref={layer.canvasRef}
                  className={`${styles.canvas} ${styles.layerCanvas} ${isPaintBucketMode ? styles.canvasBucketMode : ''} ${isProcessing ? styles.canvasProcessing : ''}`}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: index + 1, // First layer (index 0) has z-index 1, last layer has highest z-index
                    opacity: layer.visible ? layer.opacity / 100 : 0,
                    pointerEvents: layer.id === activeLayerId ? 'auto' : 'none',
                    cursor: isPaintBucketMode ? 'url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTkuNSAxMS41TDEyIDkuNUwxNiAxMy41TDE0IDcuNUwxNi41IDVMMjEuNSA5TDE5LjUgMTFMMTUuNSA3TDE0LjUgMTAuNUwxOCAxNEwyMC41IDE2LjVMMTguNSAxOC41TDE2IDE2TDE0LjUgMTcuNUwxMyAxNkwxMS41IDE3LjVMOSAxNkw2LjUgMTMuNUw5IDEwLjVaIiBmaWxsPSIjZWM0ODk5Ii8+CjxyZWN0IHg9IjMiIHk9IjE2IiB3aWR0aD0iMTgiIGhlaWdodD0iNSIgcng9IjIiIGZpbGw9IiNlYzQ4OTkiLz4KPC9zdmc+") 12 12, pointer' : 'crosshair'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
