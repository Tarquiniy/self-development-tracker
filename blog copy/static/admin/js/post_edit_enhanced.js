// post_edit_enhanced.js
document.addEventListener('DOMContentLoaded', function() {
  // Auto-save functionality
  let autoSaveInterval;
  let isAutoSaveEnabled = true;
  
  // Character counters
  const excerptTextarea = document.querySelector('#id_excerpt');
  const metaDescTextarea = document.querySelector('#id_meta_description');
  
  // Initialize
  initAutoSave();
  initCharacterCounters();
  initQuickActions();
  initSlugGeneration();
  initSEOAutoFill();
  
  function initAutoSave() {
    const toggleBtn = document.getElementById('auto-save-toggle');
    if (!toggleBtn) return;
    
    toggleBtn.addEventListener('click', function() {
      isAutoSaveEnabled = !isAutoSaveEnabled;
      toggleBtn.textContent = isAutoSaveEnabled ? '💾 Auto' : '⏸️ Paused';
      toggleBtn.title = isAutoSaveEnabled ? 'Автосохранение включено' : 'Автосохранение приостановлено';
      
      if (isAutoSaveEnabled) {
        startAutoSave();
      } else {
        stopAutoSave();
      }
    });
    
    // Start auto-save on load
    startAutoSave();
  }
  
  function startAutoSave() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    
    autoSaveInterval = setInterval(() => {
      if (isAutoSaveEnabled && hasUnsavedChanges()) {
        saveDraft();
      }
    }, 30000); // 30 seconds
  }
  
  function stopAutoSave() {
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
      autoSaveInterval = null;
    }
  }
  
  function hasUnsavedChanges() {
    // Check if form has unsaved changes
    const form = document.querySelector('#post_form');
    return form && form.checkValidity();
  }
  
  function saveDraft() {
    // Simulate auto-save (in real implementation, this would be an AJAX call)
    console.log('Auto-saving draft...');
    showNotification('Черновик сохранен', 'success');
  }
  
  function initCharacterCounters() {
    if (excerptTextarea) {
      updateCounter(excerptTextarea, 'excerpt-counter');
      excerptTextarea.addEventListener('input', () => updateCounter(excerptTextarea, 'excerpt-counter'));
    }
    
    if (metaDescTextarea) {
      updateCounter(metaDescTextarea, 'meta-desc-counter');
      metaDescTextarea.addEventListener('input', () => updateCounter(metaDescTextarea, 'meta-desc-counter'));
    }
  }
  
  function updateCounter(textarea, counterId) {
    const counter = document.getElementById(counterId);
    if (counter && textarea) {
      const length = textarea.value.length;
      counter.textContent = length;
      
      // Add warning colors
      const maxLength = counterId === 'excerpt-counter' ? 320 : 160;
      if (length > maxLength) {
        counter.style.color = '#ef4444';
      } else if (length > maxLength * 0.9) {
        counter.style.color = '#f59e0b';
      } else {
        counter.style.color = '';
      }
    }
  }
  
  function initQuickActions() {
    // Preview button
    const previewBtn = document.getElementById('preview-btn');
    if (previewBtn) {
      previewBtn.addEventListener('click', function() {
        const postId = getPostId();
        if (postId) {
          window.open(`/preview/${postId}`, '_blank');
        } else {
          showNotification('Сохраните пост для предпросмотра', 'warning');
        }
      });
    }
    
    // Word count button
    const wordCountBtn = document.getElementById('word-count-btn');
    if (wordCountBtn) {
      wordCountBtn.addEventListener('click', showWordCount);
    }
  }
  
  function initSlugGeneration() {
    const generateSlugBtn = document.getElementById('generate-slug');
    const titleField = document.querySelector('#id_title');
    const slugField = document.querySelector('#id_slug');
    
    if (generateSlugBtn && titleField && slugField) {
      generateSlugBtn.addEventListener('click', function() {
        const title = titleField.value.trim();
        if (title) {
          const slug = generateSlug(title);
          slugField.value = slug;
          showNotification('Slug сгенерирован', 'success');
        } else {
          showNotification('Введите заголовок сначала', 'warning');
        }
      });
    }
  }
  
  function initSEOAutoFill() {
    const fillMetaBtn = document.getElementById('fill-meta');
    const titleField = document.querySelector('#id_title');
    const excerptField = document.querySelector('#id_excerpt');
    const metaTitleField = document.querySelector('#id_meta_title');
    const metaDescField = document.querySelector('#id_meta_description');
    
    if (fillMetaBtn && titleField) {
      fillMetaBtn.addEventListener('click', function() {
        const title = titleField.value.trim();
        const excerpt = excerptField ? excerptField.value.trim() : '';
        
        if (title) {
          // Fill meta title if empty
          if (metaTitleField && !metaTitleField.value.trim()) {
            metaTitleField.value = title;
          }
          
          // Fill meta description if empty and we have excerpt
          if (metaDescField && !metaDescField.value.trim() && excerpt) {
            metaDescField.value = excerpt.substring(0, 160);
          }
          
          showNotification('SEO данные заполнены', 'success');
        } else {
          showNotification('Введите заголовок сначала', 'warning');
        }
      });
    }
  }
  
  function generateSlug(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  
  function getPostId() {
    // Extract post ID from URL or hidden field
    const urlMatch = window.location.pathname.match(/\/admin\/blog\/post\/(\d+)\/change/);
    return urlMatch ? urlMatch[1] : null;
  }
  
  function showWordCount() {
    const contentField = document.querySelector('[name="content"]');
    if (!contentField) return;
    
    const text = contentField.value || '';
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const charCount = text.length;
    const readingTime = Math.ceil(wordCount / 200);
    
    showNotification(
      `📊 Статистика:<br>Слов: ${wordCount}<br>Символов: ${charCount}<br>Время чтения: ${readingTime} мин`,
      'info',
      5000
    );
  }
  
  function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    const existing = document.querySelector('.custom-notification');
    if (existing) existing.remove();
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `custom-notification notification-${type}`;
    notification.innerHTML = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      background: white;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      border-left: 4px solid ${getNotificationColor(type)};
      max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, duration);
  }
  
  function getNotificationColor(type) {
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    return colors[type] || colors.info;
  }
  
  // Form validation enhancement
  const form = document.querySelector('#post_form');
  if (form) {
    form.addEventListener('submit', function(e) {
      const title = document.querySelector('#id_title').value.trim();
      if (!title) {
        e.preventDefault();
        showNotification('Заголовок обязателен для заполнения', 'error');
        return;
      }
      
      // Show saving indicator
      showNotification('Сохранение...', 'info');
    });
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // Ctrl+S or Cmd+S for save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      document.querySelector('button[name="_save"]').click();
    }
    
    // Ctrl+Enter for save and continue
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      document.querySelector('button[name="_continue"]').click();
    }
  });
  
  console.log('Post editor enhanced loaded');
});