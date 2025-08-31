import React from 'react';

const Dashboard: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Дашборд</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Здесь будет список ваших таблиц прогресса.</p>
      </div>
    </div>
  );
};

export default Dashboard;