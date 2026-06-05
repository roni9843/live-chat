import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Extract config from the script tag
const scriptTag = document.getElementById('ochat-script');
const merchantId = scriptTag ? scriptTag.getAttribute('data-merchant-id') : '64abc1234567890123456789';
const widgetId = scriptTag ? scriptTag.getAttribute('data-widget-id') : 'temp_widget_id';

// Create a container for the widget if it doesn't exist
let widgetRoot = document.getElementById('ochat-widget-root');
if (!widgetRoot) {
  widgetRoot = document.createElement('div');
  widgetRoot.id = 'ochat-widget-root';
  document.body.appendChild(widgetRoot);
}

createRoot(widgetRoot).render(
  <StrictMode>
    <App merchantId={merchantId} widgetId={widgetId} />
  </StrictMode>,
)
