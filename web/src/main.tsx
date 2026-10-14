import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as NativeApp } from '@capacitor/app'
import App from './App'
import SetsPage from './pages/SetsPage'
import ImportPage from './pages/ImportPage'
import QuizPage from './pages/QuizPage'
import ResultPage from './pages/ResultPage'
import RunPage from './pages/RunPage'
import './styles.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <SetsPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'attempts/:attemptId', element: <QuizPage /> },
      { path: 'attempts/:attemptId/result', element: <ResultPage /> },
      { path: 'runs/:runId', element: <RunPage /> }
    ]
  }
])

// Android's back button walks back through the pages, and only leaves the app from the first one.
if (Capacitor.isNativePlatform()) {
  void NativeApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void NativeApp.exitApp()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
