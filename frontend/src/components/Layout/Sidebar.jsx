import React from 'react'
import { NavLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectUser } from '../../store/authSlice.js'
import { selectUnreadCount } from '../../store/notificationsSlice.js'

const navItems = [
  {
    label: 'Tableau de bord',
    to: '/dashboard',
    icon: (
      <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
  {
    label: 'Fiches Internes',
    to: '/fiches-internes',
    icon: (
      <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
      </svg>
    ),
  },
  {
    label: 'Fiches Externes',
    to: '/fiches-externes',
    icon: (
      <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    label: 'Bons de Paiement',
    to: '/bons-paiement',
    hideForCollaborateur: true,
    icon: (
      <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
  {
    label: 'Bons de Commande',
    to: '/bons-commande',
    hideForCollaborateur: true,
    icon: (
      <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    ),
  },
  {
    label: 'Missions',
    to: '/missions',
    hideForCollaborateur: true,
    icon: (
      <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
  },
  {
    label: 'Notifications',
    to: '/notifications',
    notifBadge: true,   // signal pour passer le unreadCount
    icon: (
      <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
      </svg>
    ),
  },
]

const adminItems = [
  {
    label: 'Utilisateurs',
    to: '/admin/utilisateurs',
    icon: (
      <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
  },
  {
    label: 'Départements',
    to: '/admin/departements',
    icon: (
      <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
]

function NavItem({ item, collapsed, onClick, badge }) {
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        [
          'relative flex items-center rounded-lg transition-colors duration-150 group',
          collapsed ? 'justify-center px-0 py-2.5 mx-1' : 'gap-3 px-3 py-2.5',
          isActive
            ? 'text-white'
            : 'text-blue-200 hover:text-white hover:bg-white/10',
        ].join(' ')
      }
      style={({ isActive }) => isActive ? { backgroundColor: '#37B6E9' } : {}}
    >
      <span className="flex-shrink-0 relative">
        {item.icon}
        {/* Badge count for items like Notifications */}
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold ring-2 ring-[#162C54]">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>

      {/* Label — hidden when collapsed */}
      {!collapsed && (
        <span className="flex-1 text-sm font-medium truncate">{item.label}</span>
      )}

      {/* Badge beside label (non-collapsed) */}
      {!collapsed && badge > 0 && (
        <span className="flex-shrink-0 ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}

      {/* Tooltip when collapsed */}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {item.label}{badge > 0 ? ` (${badge})` : ''}
        </span>
      )}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }) {
  const user = useSelector(selectUser)
  const unreadCount = useSelector(selectUnreadCount)
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'DIRECTOR'
  const isCollaborateur = user?.role === 'COLLABORATEUR'
  const hasSpecialRole = user?.is_comptable || user?.is_rh
  const visibleNavItems = navItems.filter(item =>
    !(item.hideForCollaborateur && isCollaborateur && !hasSpecialRole)
  )

  const sidebarContent = (
    <div className="flex h-full flex-col" style={{ backgroundColor: '#162C54' }}>

      {/* Brand + toggle button */}
      <div
        className="flex h-16 items-center px-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* Logo icon — always visible */}
        <div className="flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0" style={{ backgroundColor: '#37B6E9' }}>
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
          </svg>
        </div>

        {/* Title — hidden when collapsed */}
        {!collapsed && (
          <div className="ml-3 min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">Fiches de Besoins</p>
            <p className="text-xs" style={{ color: '#37B6E9' }}>Gestion & Suivi</p>
          </div>
        )}

        {/* Desktop toggle button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? 'Développer le menu' : 'Réduire le menu'}
          className="hidden lg:flex ml-auto items-center justify-center h-7 w-7 rounded-md transition-colors flex-shrink-0"
          style={{ color: 'rgba(255,255,255,0.5)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          {collapsed ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-0.5">
        {/* Section label */}
        {!collapsed && (
          <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(55,182,233,0.6)' }}>
            Navigation
          </p>
        )}
        {collapsed && <div className="mb-2" />}

        {visibleNavItems.map((item) => (
          <NavItem key={item.to} item={item} collapsed={collapsed} onClick={onClose} badge={item.notifBadge ? unreadCount : 0} />
        ))}

        {isAdmin && (
          <>
            <div className="my-3 mx-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }} />
            {!collapsed && (
              <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(55,182,233,0.6)' }}>
                Administration
              </p>
            )}
            {adminItems.map((item) => (
              <NavItem key={item.to} item={item} collapsed={collapsed} onClick={onClose} />
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
            &copy; {new Date().getFullYear()} Gestion des Fiches
          </p>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar — fixed, width transitions */}
      <aside
        className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 shadow-xl z-20 transition-[width] duration-300 ease-in-out overflow-hidden"
        style={{ width: collapsed ? '4rem' : '16rem' }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay drawer — always full width */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative flex w-72 flex-col shadow-xl">
            <div className="absolute top-3 right-3 z-10">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md transition-colors"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Mobile always shows expanded */}
            <div className="flex h-full flex-col" style={{ backgroundColor: '#162C54' }}>
              <div className="flex h-16 items-center gap-3 px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0" style={{ backgroundColor: '#37B6E9' }}>
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">Fiches de Besoins</p>
                  <p className="text-xs" style={{ color: '#37B6E9' }}>Gestion & Suivi</p>
                </div>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(55,182,233,0.6)' }}>
                  Navigation
                </p>
                {visibleNavItems.map((item) => (
                  <NavItem key={item.to} item={item} collapsed={false} onClick={onClose} badge={item.notifBadge ? unreadCount : 0} />
                ))}
                {isAdmin && (
                  <>
                    <div className="my-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                    <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(55,182,233,0.6)' }}>
                      Administration
                    </p>
                    {adminItems.map((item) => (
                      <NavItem key={item.to} item={item} collapsed={false} onClick={onClose} />
                    ))}
                  </>
                )}
              </nav>
              <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  &copy; {new Date().getFullYear()} Gestion des Fiches
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
