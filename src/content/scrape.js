import {delay, fetchApiUrl} from "../modules/utils";
import browser from "webextension-polyfill";
import {scoreId, scorePagesSum} from "./content";

let allTokens = {};

browser.runtime.onMessage.addListener(req => {
  if (typeof req === 'object' && req.scoreData) {
    allTokens[req.scoreData[0]] = req.scoreData[1];
  }
});

export const getMediaUrlWithScrape = async (scoreId, type, index = 0, round = 0) => {
  if (allTokens[`${scoreId}_${type}_${index}`]) {
    const url = await fetchApiUrl(scoreId, allTokens[`${scoreId}_${type}_${index}`], type, index);

    if (url)
      return url;
  }

  if (round > 2)
    return null;

  if (type === 'mp3') {
    await scrapeMp3Data();
    return await getMediaUrlWithScrape(scoreId, type, index, round + 1);
  } else if (type === 'midi') {
    await scrapeMidiData();
    return await getMediaUrlWithScrape(scoreId, type, index, round + 1);
  } else if (type === 'img') {
    await scrapeImagesData();
    return await getMediaUrlWithScrape(scoreId, type, index, round + 1);
  }
};

const scrapeMp3Data = async () => {
  document.querySelector('button[title="Toggle Play"]')?.click();
  await delay(100);
  document.querySelector('button[title="Toggle Play"]')?.click();
  await delay(100);
};

const scrapeMidiData = async () => {
  const scrapeMidiDataWithClick = async () => {
    const button = document.querySelector('path[d^="M2 3.875V20.125C2 20.6223"]')?.parentElement?.parentElement;

    if (!button)
      return false;

    button.click();

    const isMidiPartLoaded = await new Promise((resolve, reject) => {
      if (window.location.pathname.endsWith('/piano-tutorial')) {
        resolve(true);
      }

      setInterval(() => {
        if (window.location.pathname.endsWith('/piano-tutorial')) {
          resolve(true);
        }
      }, 50);

      setTimeout(() => {
        reject(false);
      }, 2000);
    });

    if (isMidiPartLoaded) {
      button.click();
      return true;
    }

    return false;
  };

  const scrapeMidiDataWithIframe = async () => {
    const ifr = document.createElement('iframe');

    ifr.src = window.location.href + '/piano-tutorial';
    ifr.style.width = '0';
    ifr.style.height = '0';
    ifr.style.position = 'fixed';
    document.body.appendChild(ifr);

    await new Promise((resolve) => {
      if (ifr.complete && ifr.readyState === 'complete') {
        resolve();
      }

      ifr.addEventListener('load', resolve);
    });
  };

  if (!await scrapeMidiDataWithClick()) {
    await scrapeMidiDataWithIframe();
  }
};

const scrapeImagesData = async () => {
  const scrapeImagesWithDiv = async () => {
    const imgDiv = document.querySelector('#jmuse-scroller-component')?.parentElement;

    if (imgDiv) {
      document.body.style.overflow = 'hidden';
      imgDiv.style.height = '200000px';

      let round = 0;

      while (!isAllImageTokensSet()) {
        await delay(50);

        round++;

        if (round > 60) {
          return false;
        }
      }

      imgDiv.style.height = 'auto';

      return true;
    }
    return false;
  };

  const scrapeImagesWithIframe = async () => {
    const ifr = document.createElement('iframe');

    ifr.src = window.location.href;
    ifr.style.width = '1000px';
    ifr.style.height = '300000px';
    ifr.style.position = 'fixed';

    await new Promise(resolve => {
      document.body.appendChild(ifr);

      ifr.addEventListener('load', async () => {
        while (!isAllImageTokensSet()) {
          await delay(100);
        }

        resolve();
      });
    });
  };

  const isAllImageTokensSet = () => {
    for (let i = 1; i < scorePagesSum; i++) {
      if (!allTokens[`${scoreId}_img_${i}`])
        return false;
    }

    return true;
  };

  if (!await scrapeImagesWithDiv()) {
    await scrapeImagesWithIframe();
  }
};
