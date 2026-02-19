import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type SubtitleLine = {
  text: string;
  startMs: number;
  endMs: number;
};

const TimeInput: React.FC<{
  value: number;
  onChange: (ms: number) => void;
}> = ({ value, onChange }) => {
  const [localValue, setLocalValue] = useState(
    String(+(value / 1000).toFixed(1)),
  );

  useEffect(() => {
    setLocalValue(String(+(value / 1000).toFixed(1)));
  }, [value]);

  return (
    <input
      type="number"
      step={0.1}
      min={0}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => {
        const ms = Math.max(
          0,
          Math.round(parseFloat(localValue || "0") * 1000),
        );
        onChange(ms);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      style={{
        width: 90,
        padding: "5px 8px",
        fontSize: 14,
        backgroundColor: "rgba(255,255,255,0.1)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 4,
        color: "white",
        fontFamily: "monospace",
        outline: "none",
      }}
    />
  );
};

const SubtitleItem = React.memo<{
  index: number;
  subtitle: SubtitleLine;
  isActive: boolean;
  onChange: (
    index: number,
    field: keyof SubtitleLine,
    value: string | number,
  ) => void;
  onDelete: (index: number) => void;
}>(({ index, subtitle, isActive, onChange, onDelete }) => {
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive]);

  return (
    <div
      ref={itemRef}
      style={{
        padding: "12px 16px",
        backgroundColor: isActive
          ? "rgba(59, 130, 246, 0.15)"
          : "transparent",
        borderLeft: isActive
          ? "3px solid #3b82f6"
          : "3px solid transparent",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 14,
            color: "#64748b",
            fontWeight: 600,
            minWidth: 32,
          }}
        >
          #{index + 1}
        </span>
        <TimeInput
          value={subtitle.startMs}
          onChange={(ms) => onChange(index, "startMs", ms)}
        />
        <span style={{ color: "#475569", fontSize: 14 }}>~</span>
        <TimeInput
          value={subtitle.endMs}
          onChange={(ms) => onChange(index, "endMs", ms)}
        />
        <span style={{ color: "#475569", fontSize: 13, marginLeft: 2 }}>
          s
        </span>
        <button
          onClick={() => onDelete(index)}
          style={{
            marginLeft: "auto",
            padding: "4px 10px",
            fontSize: 13,
            backgroundColor: "transparent",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: 4,
            color: "#ef4444",
            cursor: "pointer",
          }}
          title="Delete this subtitle"
        >
          X
        </button>
      </div>
      <textarea
        value={subtitle.text}
        onChange={(e) => onChange(index, "text", e.target.value)}
        style={{
          width: "100%",
          height: 52,
          minHeight: 52,
          padding: "0 10px",
          fontSize: 14,
          lineHeight: "52px",
          backgroundColor: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 4,
          color: "white",
          resize: "vertical",
          fontFamily: "system-ui, sans-serif",
          outline: "none",
          boxSizing: "border-box" as const,
          textAlign: "center",
          overflow: "auto",
        }}
        rows={1}
      />
    </div>
  );
});

SubtitleItem.displayName = "SubtitleItem";

function usePortalContainer() {
  const ref = useRef<HTMLDivElement | null>(null);

  if (typeof document !== "undefined" && !ref.current) {
    const existing = document.getElementById(
      "subtitle-editor-portal",
    ) as HTMLDivElement | null;
    if (existing) {
      ref.current = existing;
    } else {
      const div = document.createElement("div");
      div.id = "subtitle-editor-portal";
      document.body.appendChild(div);
      ref.current = div;
    }
  }

  useEffect(() => {
    return () => {
      if (ref.current?.parentNode) {
        ref.current.parentNode.removeChild(ref.current);
        ref.current = null;
      }
    };
  }, []);

  return ref.current;
}

export const SubtitleEditor: React.FC<{
  subtitles: SubtitleLine[];
  currentTimeMs: number;
  onSubtitlesChange: (subtitles: SubtitleLine[]) => void;
  onSave: () => void;
  onExport: () => void;
  onReset: () => void;
}> = ({ subtitles, currentTimeMs, onSubtitlesChange, onSave, onExport, onReset }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const portalContainer = usePortalContainer();

  // Initialize position on first open
  useEffect(() => {
    if (isOpen && position === null && typeof window !== "undefined") {
      setPosition({
        x: window.innerWidth - 520,
        y: 50,
      });
    }
  }, [isOpen, position]);

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!position) return;
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
      e.preventDefault();
    },
    [position],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const activeIndex = useMemo(() => {
    return subtitles.findIndex(
      (s) => currentTimeMs >= s.startMs && currentTimeMs < s.endMs,
    );
  }, [subtitles, currentTimeMs]);

  const handleChange = useCallback(
    (index: number, field: keyof SubtitleLine, value: string | number) => {
      const updated = [...subtitles];
      updated[index] = { ...updated[index], [field]: value };
      onSubtitlesChange(updated);
    },
    [subtitles, onSubtitlesChange],
  );

  const handleDelete = useCallback(
    (index: number) => {
      const updated = subtitles.filter((_, i) => i !== index);
      onSubtitlesChange(updated);
    },
    [subtitles, onSubtitlesChange],
  );

  const handleAdd = useCallback(() => {
    const lastSubtitle = subtitles[subtitles.length - 1];
    const newStart = lastSubtitle ? lastSubtitle.endMs : 0;
    const newEntry: SubtitleLine = {
      text: "",
      startMs: newStart,
      endMs: newStart + 2000,
    };
    onSubtitlesChange([...subtitles, newEntry]);
  }, [subtitles, onSubtitlesChange]);

  const handleInsertAtPosition = useCallback(() => {
    const newEntry: SubtitleLine = {
      text: "",
      startMs: Math.round(currentTimeMs),
      endMs: Math.round(currentTimeMs) + 2000,
    };
    const insertIndex = subtitles.findIndex((s) => s.startMs > currentTimeMs);
    const updated = [...subtitles];
    if (insertIndex === -1) {
      updated.push(newEntry);
    } else {
      updated.splice(insertIndex, 0, newEntry);
    }
    onSubtitlesChange(updated);
  }, [subtitles, currentTimeMs, onSubtitlesChange]);

  if (!portalContainer) return null;

  // Toggle button when closed
  if (!isOpen) {
    return createPortal(
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 99999,
        }}
      >
        <button
          onClick={() => setIsOpen(true)}
          style={{
            padding: "10px 20px",
            fontSize: 14,
            backgroundColor: "rgba(59, 130, 246, 0.9)",
            border: "none",
            borderRadius: 8,
            color: "white",
            cursor: "pointer",
            fontWeight: 600,
            boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Edit Subtitles ({subtitles.length})
        </button>
      </div>,
      portalContainer,
    );
  }

  // Full draggable editor panel
  return createPortal(
    <div
      style={{
        position: "fixed",
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        width: 500,
        height: "70vh",
        minHeight: 400,
        backgroundColor: "rgba(15, 23, 42, 0.98)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        zIndex: 99999,
        fontFamily: "system-ui, -apple-system, sans-serif",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        overflow: "hidden",
        userSelect: isDragging ? "none" : "auto",
      }}
    >
      {/* Drag Handle / Header */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          cursor: isDragging ? "grabbing" : "grab",
          backgroundColor: "rgba(30, 41, 59, 0.8)",
          borderRadius: "10px 10px 0 0",
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, color: "white" }}>
          Subtitle Editor
        </span>
        <div
          style={{ display: "flex", gap: 8 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={onSave}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              backgroundColor: "rgba(59, 130, 246, 0.2)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: 6,
              color: "#3b82f6",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
            }}
            title="保存到字幕文件"
          >
            Save
          </button>
          <button
            onClick={onExport}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              backgroundColor: "rgba(34, 197, 94, 0.2)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              borderRadius: 6,
              color: "#22c55e",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            title="Export subtitles as JSON file"
          >
            Export
          </button>
          <button
            onClick={onReset}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              backgroundColor: "rgba(245, 158, 11, 0.2)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: 6,
              color: "#f59e0b",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            title="Reset to original subtitles"
          >
            Reset
          </button>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              backgroundColor: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 6,
              color: "#94a3b8",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            title="Close editor panel"
          >
            Close
          </button>
        </div>
      </div>

      {/* Info bar */}
      <div
        style={{
          padding: "10px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
          fontSize: 13,
          color: "#64748b",
        }}
      >
        <span>
          {subtitles.length} items | Active:{" "}
          {activeIndex >= 0 ? `#${activeIndex + 1}` : "-"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleInsertAtPosition}
            style={{
              padding: "5px 12px",
              fontSize: 13,
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: 6,
              color: "#3b82f6",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            title="Insert subtitle at current playback time"
          >
            + Insert Here
          </button>
          <button
            onClick={handleAdd}
            style={{
              padding: "5px 12px",
              fontSize: 13,
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              borderRadius: 6,
              color: "#3b82f6",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            title="Add subtitle at end"
          >
            + Append
          </button>
        </div>
      </div>

      {/* Subtitle list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {subtitles.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              padding: 32,
              color: "#64748b",
              fontSize: 14,
              textAlign: "center",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 40, opacity: 0.5 }}>CC</div>
            <div>No subtitles yet</div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              Use &quot;+ Insert Here&quot; to add a subtitle at the current playback
              position, or &quot;+ Append&quot; to add one at the end.
            </div>
          </div>
        )}
        {subtitles.map((subtitle, index) => (
          <SubtitleItem
            key={`${index}-${subtitle.startMs}`}
            index={index}
            subtitle={subtitle}
            isActive={index === activeIndex}
            onChange={handleChange}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>,
    portalContainer,
  );
};
