import React from 'react';
import {createRoot} from 'react-dom/client';
import browser from "webextension-polyfill";

import './index.css';
import Popup from './popup.jsx';

const {os} = await browser.runtime.getPlatformInfo();

switch (os.toString().toLowerCase()) {
  case 'android':
  case 'ios':
    import('./popupMobile.css');
    break;
  default:
    import('./popup.css');
}

const container = document.getElementById('app-container');
const root = createRoot(container);
root.render(<Popup/>);

if (module.hot)
  module.hot.accept();
