import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import DetachedChatPage from './DetachedChatPage'

// Check if we're in detached chat mode
const urlParams = new URLSearchParams(window.location.search);
const isDetachedMode = urlParams.get('mode') === 'detached';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <>
    {isDetachedMode ? <DetachedChatPage /> : <App />}
  </>,
)