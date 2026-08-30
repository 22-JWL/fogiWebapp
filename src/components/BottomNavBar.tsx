import { NavLink } from 'react-router-dom'
import './BottomNavBar.css'

interface NavItem {
  path: string
  label: string
  icon: string
}

const navItems: NavItem[] = [
  { path: '/', label: '홈', icon: 'home' },
  { path: '/calendar', label: '일정/출석', icon: 'calendar' },
  { path: '/stats', label: '출석통계', icon: 'stats' },
  { path: '/manito', label: '마니또', icon: 'gift' },
  { path: '/mypage', label: '마이페이지', icon: 'user' }
]

export default function BottomNavBar() {
  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          end={item.path === '/'}
        >
          <span className={`nav-icon icon-${item.icon}`} />
          <span className="nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
