// tiptap-build/src/tiptap-umd.js
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';

/**
 * Expose conservative set of globals for older initializers that check:
 *  window.tiptap  or window.tiptapCore or window['@tiptap/core']
 *
 * This file intentionally exposes Editor, StarterKit, Image, Link on those objects.
 */

(function expose() {
  // ensure nest objects exist
  window.tiptap = window.tiptap || {};
  window.tiptap.Editor = Editor;
  window.tiptap.StarterKit = StarterKit;
  window.tiptap.Image = Image;
  window.tiptap.Link = Link;

  window.tiptapCore = window.tiptapCore || {};
  window.tiptapCore.Editor = Editor;

  // also create canonical key used by some builds
  window['@tiptap/core'] = window['@tiptap/core'] || {};
  window['@tiptap/core'].Editor = Editor;

  // some code checks window.TipTap
  window.TipTap = window.TipTap || {};
  window.TipTap.Editor = Editor;
})();

export { Editor, StarterKit, Image, Link };
export default { Editor, StarterKit, Image, Link };
