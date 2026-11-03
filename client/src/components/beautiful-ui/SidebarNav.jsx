import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  FileText,
  LogOut,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  X,
} from "lucide-react";
import GlideMenu from "./GlideMenu";

const SIDEBAR_MOTION = {
  expandedWidth: 224,
  collapsedWidth: 52,
  duration: 280,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

const CHAT_SEARCH_MOTION = {
  duration: 180,
  closedWidth: 28,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};

function GlideGroup({ children }) {
  return (
    <GlideMenu
      rowSelector="[data-row]"
      highlightClassName="sidebar-glide-highlight rounded-[7px] bg-hover-2"
      className="group/glide flex flex-col gap-px"
    >
      {children}
    </GlideMenu>
  );
}

function RailButton({ icon, label, active = false, count, onClick }) {
  return (
    <button
      data-row
      type="button"
      onClick={onClick}
      className={`sidebar-row relative z-10 mx-2 flex h-8 items-center rounded-[8px] px-2 text-left
        transition-[width,background-color,color,transform] duration-150 active:scale-[0.98]
        ${active ? "bg-hover-2 group-hover/glide:bg-transparent" : ""}`}
    >
      <span
        className={`flex size-5 shrink-0 items-center justify-center ${
          active ? "text-ink" : "text-ink-2"
        }`}
      >
        {icon}
      </span>
      <span
        className={`sidebar-copy ml-1.5 min-w-0 flex-1 truncate text-[14px] font-medium ${
          active ? "text-ink" : "text-ink-2"
        }`}
      >
        {label}
      </span>
      {count ? (
        <span className="sidebar-copy mr-2 shrink-0 text-[12px] font-medium tabular-nums text-ink-3">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function WorkspaceMenu({ position, workspace, onClose, onLogout }) {
  return createPortal(
    <div
      data-workspace-menu
      className="fixed z-50 w-64 rounded-[14px] bg-surface p-1.5 shadow-overlay"
      style={{
        top: position.top,
        left: position.left,
        animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both",
        transformOrigin: "top left",
      }}
    >
      <GlideMenu
        className="flex flex-col gap-px"
        highlightClassName="inset-x-0 rounded-[8px] bg-hover-2"
        rowSelector="[data-menu-row]"
      >
        <button
          data-menu-row
          type="button"
          onClick={onClose}
          className="relative z-10 flex h-10 w-full items-center gap-1.5 rounded-[8px] px-2 text-left"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-ink text-[11px] font-semibold text-surface">
            {workspace.monogram}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
            {workspace.name}
          </span>
        </button>
        <div className="my-1 h-px bg-line" />
        <button
          data-menu-row
          type="button"
          onClick={onClose}
          className="relative z-10 flex h-9 w-full items-center gap-1.5 rounded-[8px] px-2 text-left"
        >
          <span className="flex size-5 shrink-0 items-center justify-center text-ink-2">
            <Settings size={16} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
            Workspace settings
          </span>
        </button>
        <div className="my-1 h-px bg-line" />
        <button
          data-menu-row
          type="button"
          onClick={() => {
            onClose();
            onLogout?.();
          }}
          className="relative z-10 flex h-9 w-full items-center gap-1.5 rounded-[8px] px-2 text-left"
        >
          <span className="flex size-5 shrink-0 items-center justify-center text-ink-2">
            <LogOut size={16} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
            Sign out
          </span>
        </button>
      </GlideMenu>
    </div>,
    document.body
  );
}

/**
 * Beautiful UI Sidebar Nav wired to FinSight.
 */
export default function SidebarNav({
  workspaceName = "FinSight",
  monogram = "F",
  recents = [],
  documents = [],
  activeTitle = null,
  fill = true,
  onNewChat,
  onPick,
  onLogout,
  footerLabel,
  onFooterClick,
  className = "",
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspacePosition, setWorkspacePosition] = useState({ top: 0, left: 0 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [docsOpen, setDocsOpen] = useState(true);
  const workspaceButtonRef = useRef(null);
  const searchRef = useRef(null);

  const q = query.trim().toLowerCase();
  const visibleRecents = recents.filter((item) =>
    item.label.toLowerCase().includes(q)
  );
  const visibleDocs = documents.filter((d) =>
    (d.label || "").toLowerCase().includes(q)
  );

  useEffect(() => {
    if (!workspaceOpen) return;
    const close = (event) => {
      const target = event.target;
      if (
        !target.closest("[data-workspace-trigger]") &&
        !target.closest("[data-workspace-menu]")
      ) {
        setWorkspaceOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [workspaceOpen]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const collapse = () => {
    setCollapsed(true);
    setWorkspaceOpen(false);
    setSearchOpen(false);
    setQuery("");
  };

  return (
    <aside
      data-sidebar-collapsed={collapsed}
      aria-label="Workspace navigation"
      className={`relative flex shrink-0 overflow-hidden border-r border-line bg-canvas transition-[width] ${
        fill ? "h-full" : "h-[600px]"
      } ${className}`}
      style={{
        width: collapsed
          ? SIDEBAR_MOTION.collapsedWidth
          : SIDEBAR_MOTION.expandedWidth,
        transitionDuration: `${SIDEBAR_MOTION.duration}ms`,
        transitionTimingFunction: SIDEBAR_MOTION.easing,
      }}
    >
      <div className="flex min-h-0 w-[224px] shrink-0 flex-col">
        <div className="relative mb-2.5 h-10 shrink-0">
          <button
            ref={workspaceButtonRef}
            data-workspace-trigger
            type="button"
            aria-expanded={workspaceOpen}
            aria-hidden={collapsed}
            tabIndex={collapsed ? -1 : 0}
            onClick={() => {
              if (!workspaceOpen && workspaceButtonRef.current) {
                const rect = workspaceButtonRef.current.getBoundingClientRect();
                setWorkspacePosition({
                  top: rect.bottom + 6,
                  left: rect.left,
                });
              }
              setWorkspaceOpen((open) => !open);
            }}
            className="sidebar-workspace-control absolute left-2 top-1 flex h-8 w-[164px] items-center rounded-[8px] px-2 text-left transition-[background-color,transform] duration-100 hover:bg-hover-2 active:scale-[0.99]"
          >
            <span className="sidebar-logo flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-ink text-[10px] font-semibold text-surface">
              {monogram}
            </span>
            <span className="sidebar-copy ml-1.5 min-w-0 flex-1 truncate text-[14px] font-medium text-ink-2">
              {workspaceName}
            </span>
            <span className="sidebar-copy ml-1 flex shrink-0 text-ink-3">
              <ChevronDown size={16} />
            </span>
          </button>

          {workspaceOpen && (
            <WorkspaceMenu
              position={workspacePosition}
              workspace={{ name: workspaceName, monogram }}
              onClose={() => setWorkspaceOpen(false)}
              onLogout={onLogout}
            />
          )}

          <button
            type="button"
            aria-label="Collapse sidebar"
            aria-hidden={collapsed}
            tabIndex={collapsed ? -1 : 0}
            onClick={collapse}
            className="sidebar-collapse-control absolute right-2 top-1 flex size-8 items-center justify-center rounded-[8px] text-ink-3 transition-[opacity,background-color,color] duration-150 hover:bg-hover-2 hover:text-ink"
          >
            <PanelLeftClose size={18} />
          </button>
          <button
            type="button"
            aria-label="Expand sidebar"
            aria-hidden={!collapsed}
            tabIndex={collapsed ? 0 : -1}
            onClick={() => setCollapsed(false)}
            className="sidebar-expand-control absolute left-2 top-0.5 flex size-9 items-center justify-center rounded-[8px] text-ink-3 transition-[opacity,background-color,color] duration-150 hover:bg-hover-2 hover:text-ink"
          >
            <PanelLeftOpen size={18} />
          </button>
        </div>

        <GlideGroup>
          <RailButton
            icon={<MessageSquarePlus size={18} />}
            label="New chat"
            onClick={() => onNewChat?.()}
          />
        </GlideGroup>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {/* Documents */}
          <button
            type="button"
            onClick={() => setDocsOpen((v) => !v)}
            className="sidebar-copy mx-2 mb-1 flex h-7 w-[calc(100%-1rem)] items-center gap-1.5 px-2 text-[12.5px] font-medium text-ink-3"
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${docsOpen ? "" : "-rotate-90"}`}
            />
            <span>Documents</span>
            <span className="ml-auto tabular-nums">{documents.length}</span>
          </button>
          {docsOpen && (
            <GlideGroup>
              {visibleDocs.length === 0 ? (
                <div className="sidebar-copy mx-2 px-2 py-2 text-[12.5px] text-ink-3">
                  No documents
                </div>
              ) : (
                visibleDocs.map((doc) => (
                  <div
                    key={doc.id}
                    data-row
                    className="sidebar-row relative z-10 mx-2 flex h-8 items-center gap-2 rounded-[8px] px-2"
                    title={doc.label}
                  >
                    <FileText size={14} className="shrink-0 text-red" />
                    <span className="sidebar-copy min-w-0 flex-1 truncate text-[13px] text-ink-2">
                      {doc.label}
                    </span>
                  </div>
                ))
              )}
            </GlideGroup>
          )}

          {/* Chats + search */}
          <div className="sidebar-copy relative mx-2 mb-1 mt-3 h-8">
            <div
              aria-hidden={searchOpen}
              className={`absolute inset-0 flex items-center gap-1.5 px-2 text-[12.5px] font-medium text-ink-3 transition-[opacity,transform] ${
                searchOpen
                  ? "pointer-events-none -translate-x-1 opacity-0"
                  : "translate-x-0 opacity-100"
              }`}
              style={{
                transitionDuration: `${CHAT_SEARCH_MOTION.duration}ms`,
                transitionTimingFunction: CHAT_SEARCH_MOTION.easing,
              }}
            >
              <ChevronDown size={16} />
              <span>Chats</span>
            </div>

            <button
              type="button"
              aria-label="Search chats"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen(true)}
              className={`absolute right-0 top-0 z-10 flex size-8 items-center justify-center rounded-[8px] text-ink-3 transition-[opacity,background-color,color,transform] hover:bg-hover-2 hover:text-ink active:scale-[0.96] ${
                searchOpen ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
              style={{
                transitionDuration: `${CHAT_SEARCH_MOTION.duration}ms`,
              }}
            >
              <Search size={16} />
            </button>

            <div
              className={`absolute right-0 top-0 z-20 flex h-8 items-center overflow-hidden rounded-[8px] bg-field text-ink-3 shadow-hairline transition-[width,opacity] focus-within:text-ink-2 ${
                searchOpen
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
              style={{
                width: searchOpen ? "100%" : CHAT_SEARCH_MOTION.closedWidth,
                transitionDuration: `${CHAT_SEARCH_MOTION.duration}ms`,
                transitionTimingFunction: CHAT_SEARCH_MOTION.easing,
              }}
            >
              <span className="ml-2 flex shrink-0 items-center justify-center">
                <Search size={15} />
              </span>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    setQuery("");
                  }
                }}
                placeholder="Search chats"
                aria-label="Search chat history"
                className="ml-1.5 min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink outline-none placeholder:text-ink-3"
              />
              <button
                type="button"
                aria-label="Close chat search"
                onClick={() => {
                  setSearchOpen(false);
                  setQuery("");
                }}
                className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-ink-3 hover:bg-hover-2 hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <GlideGroup>
            {visibleRecents.map((item) => {
              const active = item.label === activeTitle;
              return (
                <button
                  key={item.id}
                  data-row
                  type="button"
                  title={item.label}
                  onClick={() => onPick?.(item.id, item.label, item.prompt)}
                  className={`sidebar-row relative z-10 mx-2 flex h-8 items-center rounded-[8px] px-2 text-left transition-[width,background-color,color,transform] duration-150 active:scale-[0.98] ${
                    active
                      ? "bg-hover-2 group-hover/glide:bg-transparent"
                      : ""
                  }`}
                >
                  <span
                    className={`sidebar-copy min-w-0 flex-1 truncate text-[14px] font-medium ${
                      active ? "text-ink" : "text-ink-2"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
            {query && visibleRecents.length === 0 && (
              <div className="sidebar-copy mx-2 px-2 py-2 text-[12.5px] text-ink-3">
                No chats found
              </div>
            )}
          </GlideGroup>
        </div>

        {footerLabel ? (
          <div className="sidebar-copy mx-2 mt-3 w-[208px] border-t border-line pt-3 pb-3">
            <button
              type="button"
              onClick={onFooterClick ?? onNewChat}
              className="flex h-8 w-full items-center justify-center gap-1.5 rounded-control bg-hover-2 text-[12.5px] font-medium text-ink transition-[background-color,transform] duration-150 hover:bg-line-strong active:scale-[0.98]"
            >
              {footerLabel}
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
