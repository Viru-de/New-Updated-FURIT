import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initDisableNumberInputScroll } from './utils/disableNumberInputScroll';

// Initialize global mouse-wheel protection for all numeric inputs ERP-wide
initDisableNumberInputScroll();

createRoot(document.getElementById('root')!).render(<App />);

