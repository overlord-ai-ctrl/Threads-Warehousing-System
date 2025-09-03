import React from 'react';
import { useParams } from 'react-router-dom';

export const BrandDashboard: React.FC = () => {
  const { brandId } = useParams<{ brandId: string }>();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Brand Dashboard - {brandId}
        </h1>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">Brand dashboard coming soon...</p>
        </div>
      </div>
    </div>
  );
};

export default BrandDashboard;
