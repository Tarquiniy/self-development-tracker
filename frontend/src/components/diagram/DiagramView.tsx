import React from 'react';
import { useParams } from 'react-router-dom';
import RadarChartComponent from './RadarChart';

const DiagramView: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>Неверный ID таблицы</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <RadarChartComponent tableId={id} />
    </div>
  );
};

export default DiagramView;