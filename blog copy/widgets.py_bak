# backend/blog/widgets.py
"""
CKEditor 5 Widget for Django Admin
Modern, powerful editor replacement for TipTap
"""

from django import forms
from django.utils.safestring import mark_safe
from django.utils.html import escape


class CKEditor5Widget(forms.Textarea):
    """
    CKEditor 5 Widget for Django Admin
    Features:
    - Modern CKEditor 5 with latest features
    - Image upload integration with existing media library
    - Auto-save functionality
    - Preview support
    """
    
    def __init__(self, attrs=None):
        base_attrs = {
            "class": "ckeditor5-widget",
            "data-upload-url": "/api/blog/media/upload/",
            "data-preview-url": "/admin/posts/preview-token/",
        }
        if attrs:
            base_attrs.update(attrs)
        super().__init__(attrs=base_attrs)

    def render(self, name, value, attrs=None, renderer=None):
        attrs = attrs or {}
        attrs.update(self.attrs)
        attrs['class'] = attrs.get('class', '') + ' ckeditor5-widget'
        
        # Render the textarea
        textarea_html = super().render(name, value, attrs, renderer)
        
        # Add CKEditor 5 initialization script
        widget_id = attrs.get('id', f'id_{name}')
        
        editor_script = f"""
        <script>
        document.addEventListener('DOMContentLoaded', function() {{
            const textarea = document.getElementById('{widget_id}');
            if (textarea && typeof ClassicEditor !== 'undefined') {{
                ClassicEditor
                    .create(textarea, {{
                        toolbar: {{
                            items: [
                                'heading', '|',
                                'bold', 'italic', 'underline', 'strikethrough', '|',
                                'link', 'imageUpload', 'mediaEmbed', '|',
                                'alignment', '|',
                                'bulletedList', 'numberedList', 'todoList', '|',
                                'outdent', 'indent', '|',
                                'blockQuote', 'insertTable', '|',
                                'undo', 'redo', '|',
                                'code', 'codeBlock', '|',
                                'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor', '|',
                                'highlight', '|',
                                'horizontalLine', 'pageBreak', '|',
                                'sourceEditing'
                            ],
                            shouldNotGroupWhenFull: true
                        }},
                        image: {{
                            toolbar: [
                                'imageTextAlternative', 'toggleImageCaption', '|',
                                'imageStyle:inline', 'imageStyle:block', 'imageStyle:side', '|',
                                'linkImage'
                            ],
                            upload: {{
                                types: ['jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg']
                            }}
                        }},
                        table: {{
                            contentToolbar: [
                                'tableColumn', 'tableRow', 'mergeTableCells', '|',
                                'tableProperties', 'tableCellProperties'
                            ]
                        }},
                        link: {{
                            addTargetToExternalLinks: true,
                            defaultProtocol: 'https://'
                        }},
                        mediaEmbed: {{
                            previewsInData: true
                        }},
                        licenseKey: '',
                        simpleUpload: {{
                            uploadUrl: '{attrs.get("data-upload-url", "/api/blog/media/upload/")}',
                            withCredentials: true,
                            headers: {{
                                'X-CSRFToken': getCookie('csrftoken')
                            }}
                        }},
                        autosave: {{
                            save(editor) {{
                                return saveContent(editor, '{widget_id}');
                            }}
                        }}
                    }})
                    .then(editor => {{
                        window.editor = editor;
                        
                        // Handle form submission
                        const form = textarea.closest('form');
                        if (form) {{
                            form.addEventListener('submit', function() {{
                                textarea.value = editor.getData();
                            }});
                        }}
                        
                        // Auto-save every 30 seconds
                        setInterval(() => {{
                            if (editor.plugins.get('Autosave').hasDirty()) {{
                                editor.plugins.get('Autosave').save();
                            }}
                        }}, 30000);
                    }})
                    .catch(error => {{
                        console.error('CKEditor 5 initialization failed:', error);
                    }});
            }} else {{
                console.warn('CKEditor 5 not available or textarea not found');
            }}
            
            function getCookie(name) {{
                let cookieValue = null;
                if (document.cookie && document.cookie !== '') {{
                    const cookies = document.cookie.split(';');
                    for (let i = 0; i < cookies.length; i++) {{
                        const cookie = cookies[i].trim();
                        if (cookie.substring(0, name.length + 1) === (name + '=')) {{
                            cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                            break;
                        }}
                    }}
                }}
                return cookieValue;
            }}
            
            async function saveContent(editor, widgetId) {{
                try {{
                    const content = editor.getData();
                    const title = document.querySelector('[name="title"]')?.value || '';
                    const excerpt = document.querySelector('[name="excerpt"]')?.value || '';
                    const postId = document.querySelector('[name="id"]')?.value || '';
                    
                    const response = await fetch('/api/blog/revisions/autosave/', {{
                        method: 'POST',
                        headers: {{
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCookie('csrftoken')
                        }},
                        body: JSON.stringify({{
                            post_id: postId,
                            title: title,
                            content: content,
                            excerpt: excerpt,
                            autosave: true
                        }})
                    }});
                    
                    if (response.ok) {{
                        const data = await response.json();
                        console.log('Auto-save successful:', data);
                        return data;
                    }}
                }} catch (error) {{
                    console.error('Auto-save failed:', error);
                }}
            }}
        }});
        </script>
        """
        
        # Add CKEditor 5 CSS and JS
        cdn_links = """
        <link href="https://cdn.ckeditor.com/ckeditor5/41.0.0/classic/ckeditor5.css" rel="stylesheet">
        <script src="https://cdn.ckeditor.com/ckeditor5/41.0.0/classic/ckeditor5.js"></script>
        <script src="https://cdn.ckeditor.com/ckeditor5/41.0.0/classic/translations/en.js"></script>
        """
        
        return mark_safe(cdn_links + textarea_html + editor_script)

    class Media:
        css = {
            'all': ('admin/css/ckeditor5-admin.css',)
        }


class CKEditorWidget(CKEditor5Widget):
    """Backwards compatibility alias"""
    pass


__all__ = ["CKEditor5Widget", "CKEditorWidget"]