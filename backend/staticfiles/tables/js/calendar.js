class TableCalendar {
    constructor(containerId, tableId = null) {
        this.container = document.getElementById(containerId);
        this.tableId = tableId;
        this.calendar = null;
        this.currentView = 'dayGridMonth';
        this.init();
    }

    init() {
        if (!this.container) {
            console.error('Calendar container not found');
            return;
        }

        this.renderCalendar();
        this.loadCalendarData();
    }

    renderCalendar() {
        const calendarEl = document.createElement('div');
        calendarEl.id = 'calendar';
        this.container.appendChild(calendarEl);

        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: this.currentView,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            views: {
                dayGridMonth: {
                    titleFormat: { year: 'numeric', month: 'long' }
                },
                timeGridWeek: {
                    titleFormat: { year: 'numeric', month: 'short', day: 'numeric' }
                },
                timeGridDay: {
                    titleFormat: { year: 'numeric', month: 'long', day: 'numeric' }
                }
            },
            events: this.getEvents.bind(this),
            eventClick: this.handleEventClick.bind(this),
            dateClick: this.handleDateClick.bind(this),
            eventDidMount: this.customizeEvent.bind(this),
            locale: 'ru',
            firstDay: 1,
            buttonText: {
                today: 'Сегодня',
                month: 'Месяц',
                week: 'Неделя',
                day: 'День'
            },
            allDayText: 'Весь день',
            moreLinkText: 'ещё',
            noEventsText: 'Нет событий для отображения'
        });

        this.calendar.render();
    }

    getEvents(fetchInfo, successCallback, failureCallback) {
        const url = this.tableId 
            ? `/api/tables/tables/${this.tableId}/calendar_data/?start=${fetchInfo.startStr}&end=${fetchInfo.endStr}`
            : `/api/tables/calendar/events/?start=${fetchInfo.startStr}&end=${fetchInfo.endStr}`;

        fetch(url, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(events => {
            successCallback(events);
        })
        .catch(error => {
            console.error('Error loading calendar events:', error);
            failureCallback(error);
        });
    }

    handleEventClick(info) {
        const event = info.event;
        const extendedProps = event.extendedProps;
        
        this.showEventModal(extendedProps, event.start);
    }

    handleDateClick(info) {
        this.showProgressForm(info.date);
    }

    customizeEvent(info) {
        const progress = info.event.extendedProps.progress;
        const mood = info.event.extendedProps.mood;
        
        // Добавляем индикатор прогресса
        if (progress !== undefined) {
            const progressEl = document.createElement('div');
            progressEl.className = 'progress-indicator';
            progressEl.innerHTML = `
                <span class="progress-dot" style="background-color: ${info.backgroundColor}"></span>
                <span>${Math.round(progress)}%</span>
            `;
            info.el.querySelector('.fc-event-title').appendChild(progressEl);
        }

        // Добавляем смайлик настроения
        if (mood) {
            const moodEmojis = ['😢', '😞', '😐', '😊', '😁'];
            const moodEl = document.createElement('span');
            moodEl.textContent = moodEmojis[mood - 1] || '';
            moodEl.style.marginLeft = '4px';
            info.el.querySelector('.fc-event-title').appendChild(moodEl);
        }
    }

    showEventModal(data, date) {
        // Создаем модальное окно с деталями прогресса
        const modal = document.createElement('div');
        modal.className = 'calendar-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 24px;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `;

        const moodEmojis = ['😢', '😞', '😐', '😊', '😁'];
        const moodText = data.mood ? moodEmojis[data.mood - 1] : '—';

        modalContent.innerHTML = `
            <h3 style="margin-top: 0; color: #1F2937;">Прогресс за ${new Date(date).toLocaleDateString('ru-RU')}</h3>
            <div style="margin-bottom: 16px;">
                <strong>Общий прогресс:</strong> ${Math.round(data.progress)}%
            </div>
            <div style="margin-bottom: 16px;">
                <strong>Настроение:</strong> ${moodText}
            </div>
            ${data.notes ? `<div style="margin-bottom: 16px;"><strong>Заметки:</strong><br>${data.notes}</div>` : ''}
            ${this.renderProgressDetails(data.data)}
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="this.closest('.calendar-modal').remove()" style="padding: 8px 16px; border: 1px solid #D1D5DB; background: white; border-radius: 6px; cursor: pointer;">Закрыть</button>
                <button onclick="this.editProgress('${date}')" style="padding: 8px 16px; background: #3B82F6; color: white; border: none; border-radius: 6px; cursor: pointer;">Редактировать</button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Закрытие по клику вне модального окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    renderProgressDetails(progressData) {
        if (!progressData) return '';
        
        let html = '<div><strong>Детали по категориям:</strong></div><div style="margin-top: 8px;">';
        for (const [categoryId, value] of Object.entries(progressData)) {
            html += `
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 4px;">
                    <span>${categoryId}:</span>
                    <span style="margin-left: auto; font-weight: 600;">${value}%</span>
                </div>
            `;
        }
        html += '</div>';
        return html;
    }

    showProgressForm(date) {
        // Показываем форму для добавления/редактирования прогресса
        const formattedDate = date.toISOString().split('T')[0];
        window.location.href = `/tables/progress/?date=${formattedDate}${this.tableId ? `&table=${this.tableId}` : ''}`;
    }

    refresh() {
        if (this.calendar) {
            this.calendar.refetchEvents();
        }
    }

    changeView(view) {
        if (this.calendar) {
            this.calendar.changeView(view);
            this.currentView = view;
        }
    }
}

// Глобальные функции для использования в HTML
window.editProgress = function(date) {
    // Редирект на страницу редактирования
    window.location.href = `/tables/progress/?date=${date}`;
};

window.refreshCalendar = function() {
    if (window.tableCalendar) {
        window.tableCalendar.refresh();
    }
};

// Инициализация календаря при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const calendarContainer = document.getElementById('calendar-container');
    if (calendarContainer) {
        const tableId = calendarContainer.dataset.tableId;
        window.tableCalendar = new TableCalendar('calendar-container', tableId || null);
    }
});