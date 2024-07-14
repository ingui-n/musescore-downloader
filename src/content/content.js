import browser from 'webextension-polyfill';
import Printer from "pdfmake";
import {getMediaUrlWithAlgorithm} from "./tokenAlgorithm";
import {getMediaUrlWithScrape} from "./scrape";
import {promiseTimeout} from "../modules/utils";

let abortController;

let isInitFunctionOver = false;
let isOnMobile = false;
let firstImage = '';
let scoreUrl = '';
let scoreName = '';
let scoreComposer = '';
export let scoreId = '';
export let scorePagesSum = 0;
let latestProgressMessage = null;
let isTokenAlgorithmAvailable = true;
let pdfFile = null;

const setScoreProps = async () => {
  isOnMobile = window.innerWidth < 960;
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  for (const script of scripts) {
    try {
      const obj = JSON.parse(script.textContent);

      if (obj?.['@type'] !== 'MusicComposition')
        continue;

      if (obj?.thumbnailUrl)
        firstImage = obj.thumbnailUrl;
      if (obj?.composer?.name)
        scoreComposer = obj.composer.name.replaceAll('\n', ' ');
      if (obj?.name)
        scoreName = obj.name;
      if (obj?.url) {
        scoreId = obj.url.split('/').pop();
        scoreUrl = obj.url;
      }
    } catch (e) {
    }
  }

  if (!firstImage || firstImage.includes('score_0.png'))
    setFirstImage();
  if (!scoreComposer)
    setScoreComposer();
  if (!scoreName)
    setScoreName();
  if (!scoreId)
    setScoreId();
  if (!scorePagesSum)
    setScorePagesSum();

  isInitFunctionOver = true;
};

const setFirstImage = () => {
  const svgLinks = document.querySelectorAll('link[type="image/svg+xml"]');
  for (const link of svgLinks) {
    if (link.href.includes('score_0.svg')) {
      firstImage = link.href;
      return;
    }
  }

  const pngLinks = document.querySelectorAll('link[type="image/png"]');
  for (const link of pngLinks) {
    if (link.href.includes('score_0.png')) {
      firstImage = link.href;
      return;
    }
  }
};

const setScoreName = () => {
  scoreName = document.querySelector('meta[property="og:title"]')?.content;
};

const setScoreComposer = () => {
  scoreComposer = document.querySelector('meta[property="musescore:composer"]')?.content?.replaceAll('\n', ' ');
};

const setScoreId = () => {
  const url =
    document.querySelector('meta[property="og:url"]')?.content
    ?? document.querySelector('meta[property^="twitter:app:url"]')?.content;

  if (url)
    scoreId = url.split('/').pop();
};

const setScorePagesSum = () => {
  if (!!scorePagesSum)
    return;

  const matchPagesNumber1 = document.querySelector('body').outerHTML.match(/\d+ of (\d+) pages/);

  if (matchPagesNumber1) {
    scorePagesSum = Number(matchPagesNumber1[1]);
    return;
  }

  const matchPagesNumber2 = document.querySelector('body').outerHTML.match(/Pages<\/h3><\/th><td><div[\w ="]+>(\d+)</);

  if (matchPagesNumber2) {
    scorePagesSum = Number(matchPagesNumber2[1]);
    return;
  }

  const pagesDivClassName = document.querySelector('#jmuse-scroller-component')?.firstChild?.classList[0];

  if (pagesDivClassName) {
    scorePagesSum = document.querySelectorAll('.' + pagesDivClassName).length;
  }
};

const isScoreIdValid = scoreId => {
  return /^\d{7}$/.test(scoreId);
};

const openSheet = async (resolve, reject) => {
  abortController.signal.addEventListener('abort', reject);

  if (pdfFile) {
    await sendMessageToPopup('Opening PDF file', true);

    pdfFile.getBlob(async blob => {
      const blobUrl = URL.createObjectURL(blob);
      // window.open(blobUrl, isOnMobile ? '_self' : '_blank');
      window.open(blobUrl, '_blank');

      await sendMessageToPopup('PDF successfully generated', false, true);
      resolve();
    });
  } else {
    await buildPdf();

    if (pdfFile) {
      await sendMessageToPopup('Opening PDF file', true);

      pdfFile.getBlob(async blob => {
        const blobUrl = URL.createObjectURL(blob);
        // window.open(blobUrl, isOnMobile ? '_self' : '_blank');
        window.open(blobUrl, '_blank');

        await sendMessageToPopup('PDF successfully generated', false, true);
        resolve();
      });
    }
  }
};

const downloadSheet = async (resolve, reject) => {
  abortController.signal.addEventListener('abort', reject);

  if (pdfFile) {
    await sendMessageToPopup('PDF successfully generated', false, true);
    resolve(pdfFile.download(scoreName + '.pdf'));
  } else {
    await buildPdf();

    if (pdfFile) {
      await sendMessageToPopup('PDF successfully generated', false, true);
      resolve(pdfFile.download(scoreName + '.pdf'));
    }
  }
};

const downloadAudio = async (resolve, reject) => {
  abortController.signal.addEventListener('abort', reject);

  await sendMessageToPopup('Retrieving audio link', true);
  const url = await getMediaUrl('mp3');

  if (abortController.signal.aborted)
    return reject();

  if (url) {
    await sendMessageToPopup('Downloading audio', true);
    downloadFile(url);
    await sendMessageToPopup('Audio successfully downloaded', false, true);
    resolve();
  } else {
    await sendMessageToPopup('Failed to download audio');
    reject();
  }
};

const downloadMidi = async (resolve, reject) => {
  abortController.signal.addEventListener('abort', reject);

  await sendMessageToPopup('Retrieving midi link', true);
  const url = await getMediaUrl('midi');

  if (abortController.signal.aborted)
    return reject();

  if (url) {
    await sendMessageToPopup('Downloading midi', true);
    downloadFile(url);
    await sendMessageToPopup('Midi successfully downloaded', false, true);
    resolve();
  } else {
    await sendMessageToPopup('Failed to download midi');
    reject();
  }
};

const sendMessageToPopup = async (message, loading = false, reset = false) => {
  latestProgressMessage = loading ? {message, loading} : null;

  browser.runtime.sendMessage({message, loading, reset}).catch(() => null);

  if (isOnMobile)
    showMobilePopupMessage(message, loading);
};

const getMediaUrl = async (type, index) => {
  if (abortController.signal.aborted)
    return;

  if (isTokenAlgorithmAvailable) {
    const url = await promiseTimeout(getMediaUrlWithAlgorithm(scoreId, type, index), 1000)
      .catch();

    if (url)
      return url;

    isTokenAlgorithmAvailable = false;
  }

  if (abortController.signal.aborted)
    return;

  return await getMediaUrlWithScrape(scoreId, type, index);
};

const fetchImageUrl = async url => {
  return await fetch(url)
    .then(res => res.blob())
    .then(async blob => {
      if (blob.type === 'application/xml') {
        return false;
      } else if (blob.type === 'image/svg+xml') {
        return blob.text();
      } else {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    });
};

const buildPdf = async () => {
  if (abortController.signal.aborted)
    return;

  await sendMessageToPopup('Retrieving media links', true);

  await sendMessageToPopup(`Retrieving page 1/${scorePagesSum}`, true);
  const sheetImages = [await fetchImageUrl(firstImage)];

  if (scorePagesSum > 1) {
    for (let i = 0; i < scorePagesSum - 1; i++) {
      if (abortController.signal.aborted)
        return;

      await sendMessageToPopup(`Retrieving page ${i + 2}/${scorePagesSum}`, true);

      const img = await fetchImageUrl(await getMediaUrl('img', i + 1));

      if (img) {
        sheetImages.push(img);
      } else {
        break;
      }
    }
  }

  if (abortController.signal.aborted)
    return;

  await sendMessageToPopup('Generating PDF file', true);
  await generatePDF(sheetImages);
};

const generatePDF = async (pages = []) => {
  if (abortController.signal.aborted)
    return;

  const docContent = [];
  let pageOrientation = 'portrait';
  let size = {width: 575, height: 822};

  if (pages.length > 0) {
    let imageSize = await getImageSize(pages[0]);

    if (imageSize.width > imageSize.height) {
      pageOrientation = 'landscape';
      [size.width, size.height] = [size.height, size.width];
    }

    await sendMessageToPopup('Parsing pages', true);

    for (const page of pages) {
      if (abortController.signal.aborted)
        return;

      if (/^<svg/.test(page)) {
        let svg = new DOMParser().parseFromString(page, "image/svg+xml");
        let {width, height} = await getImageSize(page);

        svg.firstChild.setAttribute('viewBox', `0 0 ${width} ${height}`);
        let svgString = new XMLSerializer().serializeToString(svg);

        docContent.push({svg: svgString, ...size, alignment: 'center'});
      } else {
        docContent.push({image: page, ...size, alignment: 'center'});
      }
    }
  }

  const docDefinition = {
    content: docContent,
    pageMargins: 0,
    // compress: false,
    pageSize: 'A4',
    pageOrientation,
    info: {
      title: scoreName || '',
      author: scoreComposer || ''
    }
  };

  if (abortController.signal.aborted)
    return;

  await sendMessageToPopup('Building PDF', true);

  pdfFile = new Printer.createPdf(docDefinition);
};

const getImageSize = async image => {
  if (/^<svg/.test(image)) {
    let svg = new DOMParser().parseFromString(image, "image/svg+xml");

    const width = Math.round(svg.firstChild.width.baseVal.value * 10) / 10;
    const height = Math.round(svg.firstChild.height.baseVal.value * 10) / 10;

    return {width, height};
  } else {
    return new Promise(resolve => {
      let i = new Image();
      i.onload = () => resolve({width: i.width, height: i.height});
      i.src = image;
    });
  }
};

const downloadFile = url => {
  // window.open(url);
  window.location.assign(url);
};

const showMobilePopupMessage = (message, loading) => {
  const wrapperDiv = document.querySelector('.msd-content__wrapper');

  if (wrapperDiv) {
    document.querySelector('.msd-message__text').textContent = message;
    document.querySelector('.msd-btn__fun.msd-btn__single').textContent = loading ? 'Stop' : 'Close';
  } else {
    const messageDocument = `
      <div class='msd-content__wrapper'>
        <div class='msd-content'>
          <div class='msd-message__div'>
            <p class='msd-message__text'>${message}</p>
            <div class='msd-fun__content'>
              <button class='msd-btn__fun msd-btn__single'>${loading ? 'Stop' : 'Close'}</button>
            </div>
          </div>
        </div>
      </div>`;

    document.body.innerHTML += messageDocument;

    const actionButton = document.querySelector('.msd-btn__fun.msd-btn__single');

    actionButton.addEventListener('click', () => {
      if (loading) {
        abortController.abort();
        latestProgressMessage = null;
      }

      document.querySelector('.msd-content__wrapper')?.remove();
    });
  }

  if (!loading) {
    setTimeout(() => {
      document.querySelector('.msd-content__wrapper')?.remove();
    }, 5000);
  }
};

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request === 'isConnectionOk') {
    sendResponse(isInitFunctionOver);
    return;
  }

  if (request === 'isScorePage') {
    sendResponse(isScoreIdValid(scoreId));
    return;
  }

  if (request === 'getLatestMessage') {
    sendResponse({latestProgressMessage, isOnMobile});
    return;
  }

  if (request === 'hardStop') {
    abortController.abort();
    latestProgressMessage = null;
    sendResponse(true);
    return;
  }

  if (typeof request === 'string') {
    abortController = new AbortController();

    switch (request) {
      case 'openSheet':
        return new Promise(openSheet);
      case 'downloadSheet':
        return new Promise(downloadSheet);
      case 'downloadAudio':
        return new Promise(downloadAudio);
      case 'downloadMidi':
        return new Promise(downloadMidi);
    }
  }
});

if (window)
  window.addEventListener('load', setScoreProps);
