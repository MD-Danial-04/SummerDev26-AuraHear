import { Outlet } from 'react-router'

import { AppProvider } from '../context/AppProvider.jsx'

export function Root() {
  return (
    <AppProvider>
      <Outlet />
    </AppProvider>
  )
}
