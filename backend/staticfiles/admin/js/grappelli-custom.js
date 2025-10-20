// backend/blog/static/admin/js/grappelli-custom.js
// Кастомные JavaScript для Grappelli

(function($) {
    'use strict';
    
    // Инициализация после загрузки DOM
    $(document).ready(function() {
        
        // Улучшаем таблицы с данными
        enhanceTables();
        
        // Добавляем обработчики для статус-бейджей
        enhanceStatusBadges();
        
        // Улучшаем формы
        enhanceForms();
        
        // Инициализация медиа библиотеки
        initMediaLibrary();
        
        // Добавляем плавные анимации
        addSmoothAnimations();
    });
    
    function enhanceTables() {
        // Добавляем zebra-striping для таблиц
        $('table.grp-table').each(function() {
            var $table = $(this);
            
            // Добавляем класс для полосатых строк
            $table.addClass('grp-table-striped');
            
            // Добавляем hover эффекты
            $table.find('tbody tr').hover(
                function() {
                    $(this).css('background-color', '#f8f9fa');
                },
                function() {
                    $(this).css('background-color', '');
                }
            );
        });
    }
    
    function enhanceStatusBadges() {
        // Автоматически добавляем классы для статус-бейджей
        $('.status-badge').each(function() {
            var $badge = $(this);
            var text = $badge.text().toLowerCase();
            
            if (text.includes('опубликован') || text.includes('published')) {
                $badge.addClass('status-published');
            } else if (text.includes('черновик') || text.includes('draft')) {
                $badge.addClass('status-draft');
            } else if (text.includes('архив') || text.includes('archived')) {
                $badge.addClass('status-archived');
            }
        });
    }
    
    function enhanceForms() {
        // Добавляем валидацию для форм
        $('form').on('submit', function(e) {
            var $form = $(this);
            var requiredFields = $form.find('input[required], select[required], textarea[required]');
            var isValid = true;
            
            requiredFields.each(function() {
                var $field = $(this);
                if (!$field.val().trim()) {
                    $field.addClass('grp-error');
                    isValid = false;
                    
                    // Добавляем сообщение об ошибке
                    if (!$field.next('.field-error').length) {
                        $field.after('<span class="field-error" style="color: #dc3545; font-size: 12px; display: block;">Это поле обязательно для заполнения</span>');
                    }
                } else {
                    $field.removeClass('grp-error');
                    $field.next('.field-error').remove();
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                showNotification('Пожалуйста, заполните все обязательные поля', 'error');
            }
        });
        
        // Улучшаем поля даты/времени
        $('input[type="date"], input[type="datetime-local"]').each(function() {
            var $field = $(this);
            $field.wrap('<div class="date-field-wrapper" style="position: relative;"></div>');
        });
    }
    
    function initMediaLibrary() {
        // Функциональность для медиа библиотеки
        $('.media-item').click(function(e) {
            if ($(e.target).is('button') || $(e.target).is('a')) {
                return; // Не обрабатываем клики по кнопкам
            }
            
            var $item = $(this);
            $item.toggleClass('selected');
        });
        
        // Массовые действия для медиа
        $('.media-bulk-actions').on('change', function() {
            var action = $(this).val();
            if (action) {
                var selectedItems = $('.media-item.selected');
                if (selectedItems.length === 0) {
                    showNotification('Выберите файлы для выполнения действия', 'warning');
                    return;
                }
                
                // Здесь можно добавить логику для массовых действий
                console.log('Выполнение действия:', action, 'для', selectedItems.length, 'файлов');
            }
        });
    }
    
    function addSmoothAnimations() {
        // Плавное появление элементов
        $('.grp-module').hide().fadeIn(300);
        
        // Плавная прокрутка к якорям
        $('a[href^="#"]').click(function(e) {
            var target = $(this.getAttribute('href'));
            if (target.length) {
                e.preventDefault();
                $('html, body').stop().animate({
                    scrollTop: target.offset().top - 20
                }, 500);
            }
        });
    }
    
    function showNotification(message, type) {
        // Создаем уведомление
        var $notification = $('<div class="grp-message" style="position: fixed; top: 20px; right: 20px; z-index: 10000; padding: 15px 20px; border-radius: 8px; color: white; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 300px; animation: slideInRight 0.3s ease;"></div>');
        
        var backgroundColor = '#28a745'; // success по умолчанию
        if (type === 'error') backgroundColor = '#dc3545';
        if (type === 'warning') backgroundColor = '#ffc107';
        if (type === 'info') backgroundColor = '#17a2b8';
        
        $notification.css('background', backgroundColor)
                    .text(message)
                    .appendTo('body');
        
        // Автоматическое скрытие через 5 секунд
        setTimeout(function() {
            $notification.fadeOut(300, function() {
                $(this).remove();
            });
        }, 5000);
        
        // Возможность закрыть кликом
        $notification.click(function() {
            $(this).fadeOut(300, function() {
                $(this).remove();
            });
        });
    }
    
    // Глобальные утилиты
    window.GrappelliUtils = {
        showNotification: showNotification,
        
        formatFileSize: function(bytes) {
            if (bytes === 0) return '0 Bytes';
            var k = 1024;
            var sizes = ['Bytes', 'KB', 'MB', 'GB'];
            var i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        
        debounce: function(func, wait, immediate) {
            var timeout;
            return function() {
                var context = this, args = arguments;
                var later = function() {
                    timeout = null;
                    if (!immediate) func.apply(context, args);
                };
                var callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };
        }
    };
    
})(grp.jQuery);