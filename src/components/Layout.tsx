import { Outlet } from 'react-router-dom'
import BottomNavBar from './BottomNavBar'
import './Layout.css'

export default function Layout() {
  return (
    <div className="layout">
      <main className="layout-content">
        <Outlet />
      </main>
      <BottomNavBar />
    </div>
  )
}
