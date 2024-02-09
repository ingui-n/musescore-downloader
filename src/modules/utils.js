import browser from 'webextension-polyfill';

let loadingAnimationInterval;

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
      clearInterval(loadingAnimationInterval);
      loadingAnimationInterval = undefined;
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

  if (loadingAnimationInterval)
    return;

  let direction = false;
  let i = 0;

  resetBgColorAnimation();
  intervalHandler();

  loadingAnimationInterval = setInterval(intervalHandler, 85);
};

export const resetBgColorAnimation = () => {
  const html = document.querySelector('html');

  html.style.setProperty('--color-animation', 'null');
  setTimeout(() => {
    html.style.setProperty('--color-animation', 'background-migration 3s ease alternate infinite');
  }, 10);
};

export const delay = time => {
  return new Promise(resolve => setTimeout(resolve, time));
};
