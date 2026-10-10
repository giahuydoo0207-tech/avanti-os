"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";

export interface BranchOption { id: string; name: string; addr: string; rooms: number; stars: number }

/** Thanh chọn chi nhánh: bấm mũi tên để mở danh sách (mở lên trên vì nằm cuối cột trái) */
export function BranchPicker({ branches, value, onChange }: { branches: BranchOption[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = branches.find(b => b.id === value) ?? branches[0];
  const meta = (b: BranchOption) => `${b.addr} · ${b.rooms} phòng · ${"★".repeat(b.stars)}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const pick = (id: string) => { onChange(id); setOpen(false); triggerRef.current?.focus(); };

  return (
    <div ref={rootRef} className="relative">
      <AnimatePresence>
        {open && (
          <motion.ul id={listId} role="listbox" aria-label="Chi nhánh" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 right-0 mb-2 p-1 rounded-card border border-night-line bg-night-2 z-10">
            {branches.map(b => {
              const on = b.id === current.id;
              return (
                <li key={b.id} role="option" aria-selected={on}>
                  <button type="button" onClick={() => pick(b.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-[7px] text-left transition-colors ${on ? "bg-night-3 text-white" : "text-night-text hover:bg-night-3 hover:text-white"}`}>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-semibold">{b.name}</span>
                      <span className="block text-[12px] text-night-muted mt-0.5">{meta(b)}</span>
                    </span>
                    {on && <Check size={16} strokeWidth={2} className="text-accent-bright shrink-0" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
      <button ref={triggerRef} id="branch-trigger" type="button" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-card border text-left transition-colors bg-night-2 ${open ? "border-accent-bright/60" : "border-night-line hover:border-night-muted"}`}>
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold text-white">{current.name}</span>
          <span className="block text-[12px] text-night-muted mt-0.5">{meta(current)}</span>
        </span>
        <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" className={`text-night-text shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}
