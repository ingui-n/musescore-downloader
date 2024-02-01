import browser from 'webextension-polyfill';

export const messages = {
  initializing: {message: 'Loading extension', loading: true},
  pageLoading: {message: 'Loading webpage', loading: true},
  badPage: {message: 'This extension works only on musescore website', loading: false},
  cannotDetect: {message: 'Cannot detect a score', loading: false},
  unknownError: {message: 'Something went wrong', loading: false},
  noConnection: {message: 'Refresh the score page please', loading: false},
  badMediaType: {message: 'Unsupported media type', loading: false},
  downloadSuccess: {message: 'Media downloaded successfully', loading: false},
  downloadError: {message: 'Cannot download media', loading: false},
  sendingRequest: {message: 'Sending request', loading: true},
  getMetadata: {message: 'Gathering metadata', loading: true},
  downloadingPages: {message: 'Downloading pages', loading: true},
  generatePdf: {message: 'Generating PDF file', loading: true},
  urlRequest: {message: 'Requesting url address', loading: true},
  downloadingUrl: {message: 'Downloading media', loading: true},
};

export const updateCurrentTab = async () => {
  const [tab] = await browser.tabs.query({active: true, lastFocusedWindow: true});
  return tab;
};

export const isConnectionOk = async tabId => {
  try {
    await browser.tabs.sendMessage(tabId, '');
    return true;
  } catch (e) {
    return false;
  }
};

export const isMuseScoreUrl = url => {
  return url.match(/^https?:\/\/musescore\.com\//) !== null;
};

export const isScoreUrl = url => {
  return url.match(/^https?:\/\/musescore\.com\/(?:user\/\d+|\w+)\/scores\/\d+/) !== null;
};

export const setLoadingAnimation = loadingRef => {
  const intervalHandler = () => {
    if (!loadingRef.current) {
      clearInterval(interval);
      return;
    }

    let dotsCount = i % 8;
    let spacesCount = 7 - dotsCount;

    let dotsString = '.'.repeat(dotsCount);
    let spacesString = ' '.repeat(spacesCount);

    loadingRef.current.textContent = direction ? dotsString + spacesString : spacesString + dotsString;

    if (i === 7 || i === 0) {
      direction = !direction;
      i = direction ? 0 : 7;
    }

    direction ? i++ : i--;
  };

  let direction = false;
  let i = 0;

  const interval = setInterval(intervalHandler, 85);
};

export const resetBgColorAnimation = () => {
  const html = document.querySelector('html');

  html.style.setProperty('--color-animation', 'null');
  setTimeout(() => {
    html.style.setProperty('--color-animation', 'background-migration 3s ease alternate infinite');
  }, 10);
};
