import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BarChart3, Edit3, Trash2, TrendingUp, Crown, RefreshCw } from 'lucide-react';
import type { ProgressTable } from '../types';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const [tables, setTables] = useState<ProgressTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTableTitle, setNewTableTitle] = useState('');
  const { profile } = useAuth();

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const tablesData = await apiService.getTables();
      
      // Убедимся, что tablesData - массив
      if (Array.isArray(tablesData)) {
        setTables(tablesData);
      } else {
        console.error('Expected array but got:', tablesData);
        setError('Неверный формат данных от сервера');
        setTables([]);
      }
    } catch (error: any) {
      console.error('Failed to load tables:', error);
      setError('Не удалось загрузить таблицы. Проверьте подключение к серверу.');
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTable = async () => {
    if (!newTableTitle.trim()) return;

    try {
      setError(null);
      const newTable = await apiService.createTable({
        title: newTableTitle.trim(),
      });

      if (newTable) {
        setTables([...tables, newTable]);
        setNewTableTitle('');
        setShowCreateModal(false);
      } else {
        setError('Не удалось создать таблицу');
      }
    } catch (error: any) {
      console.error('Failed to create table:', error);
      setError(error.message || 'Ошибка при создании таблицы');
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту таблицу?')) return;

    try {
      setError(null);
      const success = await apiService.deleteTable(id);
      
      if (success) {
        setTables(tables.filter(table => table.id !== id));
      } else {
        setError('Не удалось удалить таблицу');
      }
    } catch (error: any) {
      console.error('Failed to delete table:', error);
      setError(error.message || 'Ошибка при удалении таблицы');
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress === 0) return 'bg-gray-200';
    if (progress <= 33) return 'bg-red-500';
    if (progress <= 66) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const calculateTableProgress = (table: ProgressTable) => {
    if (!table.progress_entries || !table.progress_entries.length) return 0;
    
    const today = new Date().toISOString().split('T')[0];
    const todayProgress = table.progress_entries.find(entry => entry.date === today);
    
    if (!todayProgress) return 0;
    
    const values = Object.values(todayProgress.data);
    const total = values.reduce((sum: number, val: any) => sum + val, 0);
    const maxPossible = values.length * 99;
    
    return Math.round((total / maxPossible) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const canCreateMoreTables = tables.length < (profile?.tables_limit || 1);
  const tablesUsed = tables.length;
  const tablesLimit = profile?.tables_limit || 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Хедер с индикатором тарифа */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Мои таблицы прогресса</h1>
            <p className="opacity-90">
              {profile?.subscription_active ? (
                <span className="flex items-center">
                  <Crown className="h-5 w-5 mr-2" />
                  Премиум-тариф (до {tablesLimit} таблиц)
                </span>
              ) : (
                `Бесплатный тариф (до ${tablesLimit} таблиц)`
              )}
            </p>
          </div>
          
          <div className="text-right">
            <div className="flex items-center justify-end mb-2">
              <span className="text-2xl font-bold mr-2">{tablesUsed}</span>
              <span className="opacity-90">/ {tablesLimit}</span>
            </div>
            <div className="w-32 h-3 bg-white bg-opacity-20 rounded-full">
              <div 
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${(tablesUsed / tablesLimit) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={loadTables}
            className="text-red-800 font-semibold hover:text-red-900 flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Обновить
          </button>
        </div>
      )}

      {/* Кнопка создания таблицы */}
      <div className="flex justify-end mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={!canCreateMoreTables}
          className="btn-primary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-5 w-5 mr-2" />
          Новая таблица
        </button>
      </div>

      {!canCreateMoreTables && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            {profile?.subscription_active 
              ? 'Достигнут лимит таблиц. Рассмотрите возможность удаления старых таблиц.'
              : 'Достигнут лимит таблиц для бесплатного аккаунта. Перейдите на премиум для создания большего количества таблиц.'
            }
          </p>
        </div>
      )}

      {tables.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">У вас пока нет таблиц прогресса</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Создать первую таблицу
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.map((table) => {
            const progress = calculateTableProgress(table);
            
            return (
              <div key={table.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                {/* Индикатор прогресса */}
                <div className="h-2 bg-gray-200 rounded-t-lg">
                  <div 
                    className={`h-full rounded-t-lg ${getProgressColor(progress)}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                
                <div className="p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{table.title}</h3>
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-gray-600">
                      {table.categories?.length || 0} категорий
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {progress}% заполнено
                    </span>
                  </div>

                  <div className="flex space-x-2">
                    <Link
                      to={`/table/${table.id}`}
                      className="btn-primary flex-1 text-center"
                    >
                      <Edit3 className="h-4 w-4 inline mr-1" />
                      Редактировать
                    </Link>
                    <Link
                      to={`/diagram/${table.id}`}
                      className="btn-secondary flex items-center justify-center"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDeleteTable(table.id)}
                      className="btn-secondary text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Создать новую таблицу</h2>
            <input
              type="text"
              value={newTableTitle}
              onChange={(e) => setNewTableTitle(e.target.value)}
              placeholder="Название таблицы"
              className="input-field mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateTable()}
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateTable}
                disabled={!newTableTitle.trim()}
                className="btn-primary disabled:opacity-50"
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;