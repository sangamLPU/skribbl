"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import { DrawOperation, Point, DrawingTool } from "shared";
import { Eraser, Paintbrush, Trash2, Undo, Redo, Circle, Square, Minus, PaintBucket } from "lucide-react";

interface DrawingCanvasProps {
  roomId: string;
  guestId: string;
  isDrawer: boolean;
}

const COLORS = [
  "#000000", "#555555", "#AAAAAA", "#FFFFFF",
  "#FF0000", "#FF7F00", "#FFFF00", "#00FF00",
  "#0000FF", "#4B0082", "#9400D3", "#FF69B4",
  "#8B4513", "#00FFFF"
];

const BRUSH_SIZES = [2, 5, 10, 20, 30];

// Helper to generate unique IDs
const genId = () => Math.random().toString(36).substring(2, 9);

export function DrawingCanvas({ roomId, guestId, isDrawer }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [tool, setTool] = useState<DrawingTool>("brush");
  const [fillMode, setFillMode] = useState(false); // For shapes
  
  // History state
  const [operations, setOperations] = useState<DrawOperation[]>([]);
  const [redoStack, setRedoStack] = useState<DrawOperation[]>([]);
  
  // Active drawing state
  const activeOpRef = useRef<DrawOperation | null>(null);
  const isDrawingRef = useRef(false);

  // Re-render everything from history
  const renderHistory = useCallback((ops: DrawOperation[], ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const op of ops) {
      if (op.type === "clear") {
        ctx.clearRect(0, 0, width, height);
        continue;
      }

      ctx.strokeStyle = (op.type === "stroke" && op.tool === "eraser") ? "#FFFFFF" : op.color;
      ctx.lineWidth = (op.type === "stroke" || op.type === "shape") ? op.width * Math.max(width, height) : 1;
      
      if (op.type === "stroke") {
        if (op.points.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(op.points[0].x * width, op.points[0].y * height);
        for (let i = 1; i < op.points.length; i++) {
          ctx.lineTo(op.points[i].x * width, op.points[i].y * height);
        }
        ctx.stroke();
      } else if (op.type === "shape") {
        const startX = op.start.x * width;
        const startY = op.start.y * height;
        const endX = op.end.x * width;
        const endY = op.end.y * height;
        
        ctx.beginPath();
        if (op.shape === "line") {
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
        } else if (op.shape === "rect") {
          ctx.rect(startX, startY, endX - startX, endY - startY);
        } else if (op.shape === "circle") {
          const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
          ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        }
        
        if (op.fill && op.shape !== "line") {
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
        } else {
          ctx.stroke();
        }
      } else if (op.type === "fill") {
        ctx.fillStyle = op.color;
        ctx.fillRect(0, 0, width, height);
      }
    }
  }, []);

  const redraw = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    
    // Render all confirmed operations
    renderHistory(operations, ctx, canvasRef.current.width, canvasRef.current.height);
    
    // Render the active operation currently being drawn
    if (activeOpRef.current) {
      renderHistory([activeOpRef.current], ctx, canvasRef.current.width, canvasRef.current.height);
    }
  }, [operations, renderHistory]);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        redraw();
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [redraw]);

  // Re-render when operations change
  useEffect(() => {
    redraw();
  }, [operations, redraw]);

  // Network synchronization
  useEffect(() => {
    const socket = getSocket();
    
    socket.on("draw:operation", (op: DrawOperation) => {
      setOperations(prev => [...prev, op]);
    });

    socket.on("draw:undo", (opId: string) => {
      setOperations(prev => prev.filter(o => o.id !== opId));
    });

    socket.on("draw:clear", () => {
      setOperations([]);
      setRedoStack([]);
    });

    return () => {
      socket.off("draw:operation");
      socket.off("draw:undo");
      socket.off("draw:clear");
    };
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer) return;
    const pt = getCoordinates(e);
    isDrawingRef.current = true;
    
    if (tool === "brush" || tool === "eraser") {
      activeOpRef.current = {
        type: "stroke",
        id: genId(),
        points: [pt],
        color,
        width: brushSize / 1000,
        tool
      };
    } else if (tool === "line" || tool === "rect" || tool === "circle") {
      activeOpRef.current = {
        type: "shape",
        id: genId(),
        shape: tool,
        start: pt,
        end: pt,
        color,
        width: brushSize / 1000,
        fill: fillMode
      };
    } else if (tool === "fill") {
      const op: DrawOperation = { type: "fill", id: genId(), point: pt, color };
      commitOperation(op);
      isDrawingRef.current = false;
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer || !isDrawingRef.current || !activeOpRef.current) return;
    
    const pt = getCoordinates(e);
    
    if (activeOpRef.current.type === "stroke") {
      activeOpRef.current.points.push(pt);
    } else if (activeOpRef.current.type === "shape") {
      activeOpRef.current.end = pt;
    }
    
    // Request animation frame for smooth local rendering
    requestAnimationFrame(redraw);
  };

  const commitOperation = (op: DrawOperation) => {
    setOperations(prev => [...prev, op]);
    setRedoStack([]); // Clear redo stack on new action
    
    const socket = getSocket();
    socket.emit("draw:operation", { roomId, guestId, operation: op });
  };

  const handleEnd = () => {
    if (!isDrawer || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    
    if (activeOpRef.current) {
      commitOperation(activeOpRef.current);
      activeOpRef.current = null;
    }
  };

  const handleUndo = () => {
    if (!isDrawer || operations.length === 0) return;
    
    const lastOp = operations[operations.length - 1];
    setOperations(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, lastOp]);
    
    const socket = getSocket();
    socket.emit("draw:undo", { roomId, guestId, operationId: lastOp.id });
  };

  const handleRedo = () => {
    if (!isDrawer || redoStack.length === 0) return;
    
    const nextOp = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    commitOperation(nextOp); // This emits operation back to network
  };

  const handleClear = () => {
    if (!isDrawer) return;
    setOperations([]);
    setRedoStack([]);
    
    const socket = getSocket();
    socket.emit("draw:clear", { roomId, guestId });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className="flex-grow w-full relative cursor-crosshair"
        style={{ touchAction: 'none' }} // Crucial for preventing mobile scroll
      >
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full bg-white"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
        {!isDrawer && (
          <div className="absolute inset-0 z-10" style={{ cursor: 'default' }} />
        )}
      </div>

      {/* Toolbar */}
      {isDrawer && (
        <div className="border-t bg-gray-50 flex flex-col p-2 gap-2">
          {/* Top Row: Tools & Actions */}
          <div className="flex items-center justify-between w-full overflow-x-auto pb-1 no-scrollbar">
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setTool("brush")} className={`p-2 rounded-lg ${tool === 'brush' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-200'}`}><Paintbrush size={18} /></button>
              <button onClick={() => setTool("eraser")} className={`p-2 rounded-lg ${tool === 'eraser' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-200'}`}><Eraser size={18} /></button>
              <button onClick={() => setTool("fill")} className={`p-2 rounded-lg ${tool === 'fill' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-200'}`}><PaintBucket size={18} /></button>
              <div className="h-6 w-px bg-gray-300 mx-1" />
              <button onClick={() => setTool("line")} className={`p-2 rounded-lg ${tool === 'line' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-200'}`}><Minus size={18} /></button>
              <button onClick={() => setTool("rect")} className={`p-2 rounded-lg ${tool === 'rect' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-200'}`}><Square size={18} /></button>
              <button onClick={() => setTool("circle")} className={`p-2 rounded-lg ${tool === 'circle' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-200'}`}><Circle size={18} /></button>
              <button onClick={() => setFillMode(!fillMode)} className={`px-2 py-1 text-xs rounded-md ml-1 border ${fillMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'}`}>Fill</button>
            </div>
            
            <div className="flex items-center gap-1 shrink-0 ml-4">
              <button onClick={handleUndo} disabled={operations.length === 0} className={`p-2 rounded-lg ${operations.length > 0 ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-300'}`}><Undo size={18} /></button>
              <button onClick={handleRedo} disabled={redoStack.length === 0} className={`p-2 rounded-lg ${redoStack.length > 0 ? 'text-gray-700 hover:bg-gray-200' : 'text-gray-300'}`}><Redo size={18} /></button>
              <button onClick={handleClear} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={18} /></button>
            </div>
          </div>
          
          {/* Bottom Row: Colors & Sizes */}
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1 shrink-0 mr-4">
              {BRUSH_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => setBrushSize(size)}
                  className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 ${brushSize === size ? 'bg-gray-200' : ''}`}
                >
                  <div className="bg-gray-800 rounded-full" style={{ width: Math.max(4, size/1.5), height: Math.max(4, size/1.5) }} />
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1 justify-end flex-grow">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 md:w-6 md:h-6 rounded-full border border-gray-300 shadow-sm ${color === c && tool !== 'eraser' ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
