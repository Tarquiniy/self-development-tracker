// src/index.js — собираем Editor + нужные расширения и экспортируем в window
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';

(function () {
  if (typeof window !== 'undefined') {
    window.TipTapBundle = window.TipTapBundle || {};
    window.TipTapBundle.Editor = Editor;
    window.TipTapBundle.StarterKit = StarterKit;
    window.TipTapBundle.Link = Link;
    window.TipTapBundle.Image = Image;

    // удобные алиасы
    window.Editor = Editor;
    window.StarterKit = StarterKit;
    window.Link = Link;
    window.Image = Image;
  }
})();
