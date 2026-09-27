import { NavLink, Outlet } from 'react-router-dom'

export default function App() {
  return (
    <div className="shell">
      <header>
        <h1>Quiz Practice</h1>
        <nav>
          <NavLink to="/" end>Question sets</NavLink>
          <NavLink to="/import">Import</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
