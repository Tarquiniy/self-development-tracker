// index.js — собираем Editor + нужные расширения и экспортируем в window
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { lowlight } from 'lowlight/lib/core';

// Прокидываем в глобальный скоуп — в браузере будет доступно window.Editor и т.д.
(function () {
  if (typeof window !== 'undefined') {
    window.TipTapBundle = window.TipTapBundle || {};
    window.TipTapBundle.Editor = Editor;
    window.TipTapBundle.StarterKit = StarterKit;
    window.TipTapBundle.Link = Link;
    window.TipTapBundle.Image = Image;
    window.TipTapBundle.CodeBlockLowlight = CodeBlockLowlight;
    window.TipTapBundle.lowlight = lowlight;
    // legacy simple aliases
    window.Editor = Editor;
    window.StarterKit = StarterKit;
    window.Link = Link;
    window.Image = Image;
    window.CodeBlockLowlight = CodeBlockLowlight;
    window.lowlight = lowlight;
  }
})();
