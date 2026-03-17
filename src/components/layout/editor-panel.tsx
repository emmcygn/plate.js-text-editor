import { type ReactNode } from 'react';

interface EditorPanelProps {
  children: ReactNode;
}

export function EditorPanel({ children }: EditorPanelProps) {
  return (
    <div className="max-w-5xl mx-auto my-8 px-16 py-12 bg-white rounded border border-gray-200 shadow-lg">
      {children}
    </div>
  );
}
