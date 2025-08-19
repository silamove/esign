import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { LogOut, User, Settings } from 'lucide-react';

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            PDF Signature App
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-gray-700">
            <User className="w-5 h-5" />
            <span className="text-sm font-medium">
              {user?.firstName} {user?.lastName}
            </span>
          </div>

          <button
            onClick={logout}
            className="flex items-center space-x-2 px-3 py-2 text-gray-700 hover:text-red-600 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
