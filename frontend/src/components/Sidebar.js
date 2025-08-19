import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, FileText, User, Settings } from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    {
      to: '/dashboard',
      icon: Home,
      label: 'Dashboard'
    },
    {
      to: '/profile',
      icon: User,
      label: 'Profile'
    }
  ];

  return (
    <aside className="fixed left-0 top-16 w-64 h-[calc(100vh-4rem)] bg-white shadow-lg border-r border-gray-200">
      <nav className="p-6">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
