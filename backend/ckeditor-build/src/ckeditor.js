// src/ckeditor.js
import ClassicEditorBase from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';
import Essentials from '@ckeditor/ckeditor5-essentials/src/essentials';
import Bold from '@ckeditor/ckeditor5-basic-styles/src/bold';
import Italic from '@ckeditor/ckeditor5-basic-styles/src/italic';
import Underline from '@ckeditor/ckeditor5-basic-styles/src/underline';
import Strikethrough from '@ckeditor/ckeditor5-basic-styles/src/strikethrough';
import Code from '@ckeditor/ckeditor5-basic-styles/src/code';
import Heading from '@ckeditor/ckeditor5-heading/src/heading';
import Link from '@ckeditor/ckeditor5-link/src/link';
import List from '@ckeditor/ckeditor5-list/src/list';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';

import Table from '@ckeditor/ckeditor5-table/src/table';
import TableToolbar from '@ckeditor/ckeditor5-table/src/tabletoolbar';

import Image from '@ckeditor/ckeditor5-image/src/image';
import ImageUpload from '@ckeditor/ckeditor5-image/src/imageupload';
import SimpleUploadAdapter from '@ckeditor/ckeditor5-upload/src/adapters/simpleuploadadapter';

import CodeBlock from '@ckeditor/ckeditor5-code-block/src/codeblock';
import Font from '@ckeditor/ckeditor5-font/src/font';
import Highlight from '@ckeditor/ckeditor5-highlight/src/highlight';
import SpecialCharacters from '@ckeditor/ckeditor5-special-characters/src/specialcharacters';
import MediaEmbed from '@ckeditor/ckeditor5-media-embed/src/mediaembed';
import Indent from '@ckeditor/ckeditor5-indent/src/indent';
import Alignment from '@ckeditor/ckeditor5-alignment/src/alignment';

class ClassicEditor extends ClassicEditorBase {}

ClassicEditor.builtinPlugins = [
  Essentials, Bold, Italic, Underline, Strikethrough, Code, Heading, Link, List, Paragraph,
  Table, TableToolbar, Image, ImageUpload, SimpleUploadAdapter,
  CodeBlock, Font, Highlight, SpecialCharacters, MediaEmbed, Indent, Alignment, HtmlSupport
];

ClassicEditor.defaultConfig = {
  toolbar: {
    items: [
      'heading','|',
      'bold','italic','underline','strikethrough','code','codeBlock','|',
      'fontFamily','fontSize','fontColor','fontBackgroundColor','highlight','|',
      'link','bulletedList','numberedList','outdent','indent','alignment','|',
      'insertTable','imageUpload','mediaEmbed','specialCharacters','|',
      'undo','redo'
    ]
  },
  image: {
    toolbar: ['imageTextAlternative','imageStyle:full','imageStyle:side']
  },
  table: {
    contentToolbar: ['tableColumn','tableRow','mergeTableCells']
  },
  language: 'ru'
};

export default ClassicEditor;
