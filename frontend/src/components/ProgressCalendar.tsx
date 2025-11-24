import React, { useState, useEffect } from 'react';
import './ProgressCalendar.css';

interface CategoryData {
  [key: string]: string;
}

interface CalendarDay {
  id: number;
  date: string;
  data: CategoryData;
  notes: string;
  mood: number | null;
  total_progress: number;
}

interface ProgressCalendarProps {
  tableId: string;
  categories: Array<{ id: string; title: string; color?: string | null }>;
  calendarData: { [key: string]: CalendarDay };
  onDataUpdate: () => void;
}

const ProgressCalendar: React.FC<ProgressCalendarProps> = ({ 
  tableId, 
  categories, 
  calendarData,
  onDataUpdate 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [loading, setLoading] = useState(false);

  // Навигация по месяцам
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  // Получить данные для конкретного дня
  const getDayData = (date: Date): CalendarDay | null => {
    const dateStr = date.toISOString().split('T')[0];
    return calendarData[dateStr] || null;
  };

  // Отрисовка календаря
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const startingDay = (firstDay.getDay() + 6) % 7; // Начинаем с понедельника
    
    const days = [];
    
    // Заголовки дней недели
    const dayHeaders = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    dayHeaders.forEach(day => {
      days.push(
        <div key={`header-${day}`} className="calendar-day-header">
          {day}
        </div>
      );
    });
    
    // Пустые ячейки в начале месяца
    for (let i = 0; i < startingDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayData = getDayData(date);
      
      days.push(
        <div
          key={`day-${day}`}
          className={`calendar-day ${dayData ? 'has-data' : ''} ${
            date.toDateString() === new Date().toDateString() ? 'today' : ''
          }`}
          onClick={() => dayData && setSelectedDay(dayData)}
        >
          <div className="day-number">{day}</div>
          {dayData && (
            <>
              <div className="day-progress">{Math.round(dayData.total_progress)}%</div>
              <div className="progress-dots">
                {Object.entries(dayData.data).slice(0, 3).map(([categoryId, value]) => {
                  const category = categories.find(cat => cat.id === categoryId);
                  return (
                    <div
                      key={categoryId}
                      className="progress-dot"
                      style={{
                        backgroundColor: category?.color || '#ccc',
                        opacity: parseInt(value) > 50 ? 1 : 0.5
                      }}
                      title={`${category?.title}: ${value}%`}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      );
    }
    
    return days;
  };

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const moodEmojis = ['😢', '😞', '😐', '😊', '😁'];

  return (
    <div className="progress-calendar">
      <div className="calendar-container">
        <div className="calendar-header">
          <button 
            className="calendar-nav-btn"
            onClick={() => navigateMonth('prev')}
            disabled={loading}
          >
            ‹
          </button>
          <h3 className="calendar-title">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <button 
            className="calendar-nav-btn"
            onClick={() => navigateMonth('next')}
            disabled={loading}
          >
            ›
          </button>
        </div>

        <div className="calendar-grid">
          {renderCalendar()}
        </div>

        {/* Легенда прогресса */}
        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color high-progress"></div>
            <span>Высокий прогресс (&gt;50%)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color low-progress"></div>
            <span>Низкий прогресс (&lt;50%)</span>
          </div>
        </div>
      </div>

      {/* Попап с деталями дня */}
      {selectedDay && (
        <div className="calendar-popup-overlay" onClick={() => setSelectedDay(null)}>
          <div className="calendar-popup" onClick={e => e.stopPropagation()}>
            <div className="popup-header">
              <h4>
                {new Date(selectedDay.date).toLocaleDateString('ru-RU', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h4>
              <button 
                className="popup-close"
                onClick={() => setSelectedDay(null)}
              >
                ×
              </button>
            </div>
            
            <div className="popup-content">
              <div className="popup-stats">
                <div className="stat-item">
                  <span className="stat-label">Общий прогресс:</span>
                  <span className="stat-value">{Math.round(selectedDay.total_progress)}%</span>
                </div>
                {selectedDay.mood && (
                  <div className="stat-item">
                    <span className="stat-label">Настроение:</span>
                    <span className="stat-value">{moodEmojis[selectedDay.mood - 1]}</span>
                  </div>
                )}
              </div>

              <div className="popup-categories">
                <h5>Прогресс по категориям:</h5>
                {Object.entries(selectedDay.data).map(([categoryId, value]) => {
                  const category = categories.find(cat => cat.id === categoryId);
                  return (
                    <div key={categoryId} className="category-progress">
                      <div className="category-info">
                        <div 
                          className="category-color"
                          style={{ backgroundColor: category?.color || '#ccc' }}
                        ></div>
                        <span className="category-name">{category?.title || categoryId}</span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{ 
                            width: `${value}%`,
                            backgroundColor: category?.color || '#ccc'
                          }}
                        ></div>
                        <span className="progress-value">{value}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedDay.notes && (
                <div className="popup-notes">
                  <h5>Заметки:</h5>
                  <p>{selectedDay.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressCalendar;