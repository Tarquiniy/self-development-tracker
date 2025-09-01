import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Minus, Save, Edit3, Trash2, BarChart3 } from 'lucide-react';
import type { ProgressTable, Category} from '../../types';
import { apiService } from '../../services/api';

const TableEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  const handleProgressChange = async (categoryId: string, newValue: number) => {
    if (!table || !id) return;

    const currentProgress = table.progress_entries.find(
      (entry) => entry.date === selectedDate
    )?.data || {};

    const clampedValue = Math.max(0, Math.min(99, newValue));
    const newData = { ...currentProgress, [categoryId]: clampedValue };

    setSaving(true);
    try {
      await apiService.updateProgress(id, selectedDate, newData);
      const updatedTable = await apiService.getTable(id);
      setTable(updatedTable);
    } catch (error) {
      console.error('Failed to update progress:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleIncrement = (categoryId: string) => {
    const currentValue = table?.progress_entries
      .find((entry) => entry.date === selectedDate)
      ?.data[categoryId] || 0;
    
    handleProgressChange(categoryId, currentValue + 1);
  };

  const handleDecrement = (categoryId: string) => {
    const currentValue = table?.progress_entries
      .find((entry) => entry.date === selectedDate)
      ?.data[categoryId] || 0;
    
    handleProgressChange(categoryId, currentValue - 1);
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

  const handleAddCategory = async (name: string) => {
    if (!id) return;

    try {
      const updatedTable = await apiService.addCategory(id, name);
      setTable(updatedTable);
    } catch (error) {
      console.error('Failed to add category:', error);
    }
  };

  const handleRemoveCategory = async (categoryId: string) => {
    if (!id) return;

    try {
      const updatedTable = await apiService.removeCategory(id, categoryId);
      setTable(updatedTable);
    } catch (error) {
      console.error('Failed to remove category:', error);
    }
  };

  const handleRenameCategory = async (categoryId: string, newName: string) => {
    if (!id) return;

    try {
      const updatedTable = await apiService.renameCategory(id, categoryId, newName);
      setTable(updatedTable);
    } catch (error) {
      console.error('Failed to rename category:', error);
    }
  };

  const navigateToDiagram = () => {
    if (id) {
      navigate(`/diagram/${id}`);
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
          <button
            onClick={navigateToDiagram}
            className="btn-primary flex items-center"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Диаграмма
          </button>
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

      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
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
              onAddCategory={handleAddCategory}
              onRemoveCategory={handleRemoveCategory}
              onRenameCategory={handleRenameCategory}
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

      {/* История прогресса */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-medium text-gray-900">История прогресса</h2>
        </div>
        <div className="px-6 py-4 overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Дата</th>
                {table.categories.map((category) => (
                  <th key={category.id} className="px-4 py-2 text-center">
                    {category.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.progress_entries.slice(-7).reverse().map((entry) => (
                <tr key={entry.date}>
                  <td className="px-4 py-2 border">{new Date(entry.date).toLocaleDateString()}</td>
                  {table.categories.map((category) => (
                    <td key={category.id} className="px-4 py-2 border text-center">
                      {entry.data[category.id] || 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const CategoryEditor: React.FC<{
  categories: Category[];
  onSave: (categories: Category[]) => void;
  onCancel: () => void;
  onAddCategory: (name: string) => void;
  onRemoveCategory: (id: string) => void;
  onRenameCategory: (id: string, newName: string) => void;
}> = ({ categories, onSave, onCancel, onAddCategory, onRemoveCategory, onRenameCategory }) => {
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = () => {
    if (newCategoryName.trim() && categories.length < 12) {
      onAddCategory(newCategoryName.trim());
      setNewCategoryName('');
    }
  };

  return (
    <div>
      <div className="space-y-3 mb-4">
        {categories.map((category) => (
          <div key={category.id} className="flex items-center space-x-3">
            <input
              type="text"
              value={category.name}
              onChange={(e) => onRenameCategory(category.id, e.target.value)}
              className="input-field flex-1"
              placeholder="Название категории"
            />
            <button
              onClick={() => onRemoveCategory(category.id)}
              disabled={categories.length <= 3}
              className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center space-x-3 mb-4">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          className="input-field flex-1"
          placeholder="Новая категория"
          disabled={categories.length >= 12}
        />
        <button
          onClick={handleAddCategory}
          disabled={!newCategoryName.trim() || categories.length >= 12}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Добавить
        </button>
      </div>

      <div className="flex justify-between items-center">
        <button onClick={onCancel} className="btn-secondary">
          Отмена
        </button>
        <button
          onClick={() => onSave(categories)}
          className="btn-primary"
        >
          Сохранить изменения
        </button>
      </div>

      <p className="text-sm text-gray-500 mt-4">
        Минимум: 3 категории, Максимум: 12 категорий
      </p>
    </div>
  );
};

export default TableEditor;