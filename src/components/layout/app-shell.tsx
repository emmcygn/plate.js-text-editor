import { type ReactNode } from 'react';

interface AppShellProps {
  toolbar?: ReactNode;
  editor: ReactNode;
  sidebar: ReactNode;
}

export function AppShell({ toolbar, editor, sidebar }: AppShellProps) {
  return (
    <div className="h-screen flex flex-col bg-white">
      {toolbar && (
        <header className="border-b border-gray-200 px-4 py-2 flex items-center gap-2 shrink-0">
          {toolbar}
        </header>
      )}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-[2] overflow-y-auto bg-gray-100">
          {editor}
        </main>
        <aside className="flex-1 border-l border-gray-200 overflow-y-auto bg-gray-50">
          {sidebar}
        </aside>
      </div>
    </div>
  );
}
