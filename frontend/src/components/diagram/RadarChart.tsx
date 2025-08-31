import React, { useState, useEffect } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { Calendar, Download } from 'lucide-react';
import type { ChartData, Category } from '../../types';
import { apiService } from '../../services/api';

interface RadarChartComponentProps {
  tableId: string;
}

const RadarChartComponent: React.FC<RadarChartComponentProps> = ({ tableId }) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadChartData();
  }, [tableId, dateRange]);

  const loadChartData = async () => {
    try {
      const data = await apiService.getChartData(
        tableId,
        dateRange.start,
        dateRange.end
      );
      setChartData(data.progress_data);
      setCategories(data.categories);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  const prepareRadarData = () => {
    if (!chartData.length) return [];

    // Группируем данные по дате и преобразуем для RadarChart
    return chartData.map((entry) => {
      const radarEntry: any = { date: entry.date };
      categories.forEach((category) => {
        radarEntry[category.name] = entry[category.id] || 0;
      });
      return radarEntry;
    });
  };

  const radarData = prepareRadarData();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Лепестковая диаграмма прогресса</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="input-field"
            />
            <span className="text-gray-500">по</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="input-field"
            />
          </div>
          <button
            onClick={loadChartData}
            className="btn-primary flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Обновить
          </button>
        </div>
      </div>

      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="80%">
            <PolarGrid />
            <PolarAngleAxis
              dataKey="date"
              tick={({ payload, x, y, textAnchor }: any) => (
                <text
                  x={x}
                  y={y}
                  textAnchor={textAnchor}
                  fill="#666"
                  fontSize="12"
                >
                  {new Date(payload.value).toLocaleDateString()}
                </text>
              )}
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} />
            {categories.map((category, index) => (
              <Radar
                key={category.id}
                name={category.name}
                dataKey={category.name}
                stroke={`hsl(${(index * 360) / categories.length}, 70%, 50%)`}
                fill={`hsl(${(index * 360) / categories.length}, 70%, 50%)`}
                fillOpacity={0.6}
              />
            ))}
            <Legend />
            <Tooltip
              formatter={(value: number, name: string) => [
                value,
                `${name} (баллы)`,
              ]}
              labelFormatter={(label) => `Дата: ${new Date(label).toLocaleDateString()}`}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {!radarData.length && (
        <div className="text-center py-12 text-gray-500">
          Нет данных для отображения за выбранный период
        </div>
      )}
    </div>
  );
};

export default RadarChartComponent;