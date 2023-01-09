import React from 'react';
import {createRoot} from 'react-dom/client';

import './index.css';
import Popup from './popup.jsx';

const container = document.getElementById('app-container');
const root = createRoot(container);
root.render(<Popup/>);

if (module.hot)
  module.hot.accept();
