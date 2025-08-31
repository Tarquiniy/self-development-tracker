import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Minus, Save, Edit3, Trash2 } from 'lucide-react';
import type { ProgressTable, Category, DailyProgress } from '../../types';
import { apiService } from '../../services/api';

const TableEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [table, setTable] = useState<ProgressTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCategories, setEditingCategories] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  useEffect(() => {
    const loadTable = async () => {
      if (!id) return;
      
      try {
        const tableData = await apiService.getTable(id);
        setTable(tableData);
      } catch (error) {
        console.error('Failed to load table:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTable();
  }, [id]);

  const handleIncrement = async (categoryId: string) => {
    if (!table || !id) return;

    const currentProgress = table.progress_entries.find(
      (entry) => entry.date === selectedDate
    )?.data || {};

    const newValue = Math.min(99, (currentProgress[categoryId] || 0) + 1);
    const newData = { ...currentProgress, [categoryId]: newValue };

    setSaving(true);
    try {
      await apiService.updateProgress(id, selectedDate, newData);
      // Обновляем локальное состояние
      const updatedTable = await apiService.getTable(id);
      setTable(updatedTable);
    } catch (error) {
      console.error('Failed to update progress:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDecrement = async (categoryId: string) => {
    if (!table || !id) return;

    const currentProgress = table.progress_entries.find(
      (entry) => entry.date === selectedDate
    )?.data || {};

    const newValue = Math.max(0, (currentProgress[categoryId] || 0) - 1);
    const newData = { ...currentProgress, [categoryId]: newValue };

    setSaving(true);
    try {
      await apiService.updateProgress(id, selectedDate, newData);
      // Обновляем локальное состояние
      const updatedTable = await apiService.getTable(id);
      setTable(updatedTable);
    } catch (error) {
      console.error('Failed to update progress:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryUpdate = async (updatedCategories: Category[]) => {
    if (!table || !id) return;

    setSaving(true);
    try {
      const updatedTable = await apiService.updateTable(id, {
        ...table,
        categories: updatedCategories,
      });
      setTable(updatedTable);
      setEditingCategories(false);
    } catch (error) {
      console.error('Failed to update categories:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Таблица не найдена</h2>
      </div>
    );
  }

  const currentProgress = table.progress_entries.find(
    (entry) => entry.date === selectedDate
  )?.data || {};

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{table.title}</h1>
        <div className="flex items-center space-x-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-field"
          />
          {saving && (
            <div className="text-sm text-gray-500 flex items-center">
              <Save className="h-4 w-4 animate-spin mr-1" />
              Сохранение...
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Категории</h2>
          <button
            onClick={() => setEditingCategories(!editingCategories)}
            className="btn-secondary flex items-center"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            {editingCategories ? 'Сохранить' : 'Редактировать'}
          </button>
        </div>

        <div className="px-6 py-4">
          {editingCategories ? (
            <CategoryEditor
              categories={table.categories}
              onSave={handleCategoryUpdate}
              onCancel={() => setEditingCategories(false)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {table.categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <span className="font-medium">{category.name}</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleDecrement(category.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="text-lg font-bold w-8 text-center">
                      {currentProgress[category.id] || 0}
                    </span>
                    <button
                      onClick={() => handleIncrement(category.id)}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CategoryEditor: React.FC<{
  categories: Category[];
  onSave: (categories: Category[]) => void;
  onCancel: () => void;
}> = ({ categories, onSave, onCancel }) => {
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);

  const handleAddCategory = () => {
    setLocalCategories([
      ...localCategories,
      { id: `cat-${Date.now()}`, name: 'Новая категория' },
    ]);
  };

  const handleRemoveCategory = (index: number) => {
    if (localCategories.length <= 3) return; // Минимум 3 категории
    setLocalCategories(localCategories.filter((_, i) => i !== index));
  };

  const handleCategoryChange = (index: number, name: string) => {
    const updated = [...localCategories];
    updated[index] = { ...updated[index], name };
    setLocalCategories(updated);
  };

  return (
    <div>
      <div className="space-y-3">
        {localCategories.map((category, index) => (
          <div key={category.id} className="flex items-center space-x-3">
            <input
              type="text"
              value={category.name}
              onChange={(e) => handleCategoryChange(index, e.target.value)}
              className="input-field flex-1"
              placeholder="Название категории"
            />
            <button
              onClick={() => handleRemoveCategory(index)}
              disabled={localCategories.length <= 3}
              className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-6">
        <button
          onClick={handleAddCategory}
          disabled={localCategories.length >= 12}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Добавить категорию
        </button>

        <div className="flex space-x-3">
          <button onClick={onCancel} className="btn-secondary">
            Отмена
          </button>
          <button
            onClick={() => onSave(localCategories)}
            className="btn-primary"
          >
            Сохранить
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-500 mt-4">
        Минимум: 3 категории, Максимум: 12 категорий
      </p>
    </div>
  );
};

export default TableEditor;