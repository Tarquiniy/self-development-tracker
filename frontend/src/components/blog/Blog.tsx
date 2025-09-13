import React from 'react';

const Blog: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-8">Блог о саморазвитии</h1>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <p className="text-lg text-gray-700 mb-4">
            Раздел блога находится в разработке. Здесь скоро появятся статьи о методиках 
            саморазвития, когнитивной психологии, формировании привычек и достижении целей.
          </p>
          <p className="text-gray-600">
            Следите за обновлениями!
          </p>
        </div>
      </div>
    </div>
  );
};

export default Blog;