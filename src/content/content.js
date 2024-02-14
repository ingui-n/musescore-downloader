import browser from 'webextension-polyfill';
import Printer from "pdfmake";
import {delay} from "../modules/utils";

let abortController;

const allTokens = {};
let firstImage = '';
let scoreUrl = '';
let scoreName = '';
let scoreComposer = '';
let scoreId = '';
let scorePagesSum = 0;
let latestProgressMessage = null;
let pdfFile = null;

const setScoreProps = () => {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  for (const script of scripts) {
    try {
      const obj = JSON.parse(script.textContent);

      if (obj?.['@type'] !== 'MusicComposition')
        continue;

      if (obj?.thumbnailUrl)
        firstImage = getSvgUrlOfFirstImage(obj.thumbnailUrl);
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

  if (!firstImage)
    setFirstImage();
  if (!scoreComposer)
    setScoreComposer();
  if (!scoreName)
    setScoreName();
  if (!scoreId)
    setScoreId();
  if (!scorePagesSum)
    setScorePagesSum();
};

const setFirstImage = () => {
  const svgHref = document.querySelector('link[type="image/svg+xml"]')?.href;
  const pngHref = document.querySelector('link[type="image/png"]')?.href;

  if (svgHref || pngHref)
    firstImage = svgHref || getSvgUrlOfFirstImage(pngHref);
};

const getSvgUrlOfFirstImage = pngUrl => {
  let urlArray = pngUrl.split('.');
  urlArray.pop();
  urlArray.push('svg');

  return urlArray.join('.');
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

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request === 'isScorePage') {
    sendResponse(isScoreIdValid(scoreId));
    return;
  }

  if (request === 'getLatestMessage') {
    sendResponse(latestProgressMessage);
    return;
  }

  if (request === 'hardStop') {
    abortController.abort();
    latestProgressMessage = null;
    sendResponse(true);
    return;
  }

  if (typeof request === 'object' && request.scoreData) {
    allTokens[request.scoreData[0]] = request.scoreData[1];
    return;
  }

  if (typeof request !== 'string' || request.length === 0)
    return;

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
});

const isScoreIdValid = scoreId => {
  return /^\d{7}$/.test(scoreId);
};

const openSheet = async (resolve, reject) => {
  abortController.signal.addEventListener('abort', reject);

  if (pdfFile) {
    await sendMessageToPopup('PDF successfully generated');
    resolve(pdfFile.open());
  } else {
    await pdfBuild();

    if (pdfFile) {
      await sendMessageToPopup('PDF successfully generated');
      resolve(pdfFile.open());
    }
  }
};

const downloadSheet = async (resolve, reject) => {
  abortController.signal.addEventListener('abort', reject);

  if (pdfFile) {
    await sendMessageToPopup('PDF successfully generated');
    pdfFile.download(scoreName);
  } else {
    await pdfBuild();

    if (pdfFile) {
      await sendMessageToPopup('PDF successfully generated');
      pdfFile.download(scoreName);
    }
  }
};

const pdfBuild = async (attempt = 0) => {
  await sendMessageToPopup('Retrieving media links', true);

  const tokensToFetch = [];
  const sheetImages = [];

  for (let i = 1; i < scorePagesSum; i++) {
    if (abortController.signal.aborted)
      return;

    if (allTokens[`${scoreId}_img_${i}`]) {
      tokensToFetch.push({
        index: i,
        token: allTokens[`${scoreId}_img_${i}`]
      });
    } else {
      if (attempt > 3) {
        await sendMessageToPopup('Failed to download score images');
        return;
      }

      await loadImagesDiv();

      if (!isAllImageTokensSet() && attempt > 0)
        await loadImagesIframe();

      return pdfBuild(attempt + 1);
    }
  }

  if (abortController.signal.aborted)
    return;

  await sendMessageToPopup(`Retrieving page 1/${scorePagesSum}`, true);

  let data = await fetchImageUrl(firstImage);
  sheetImages.push(data);

  if (tokensToFetch.length > 0) {
    for (let i = 0; i < tokensToFetch.length; i++) {
      if (abortController.signal.aborted)
        return;

      await sendMessageToPopup(`Retrieving page ${i + 2}/${scorePagesSum}`, true);

      let url = await fetchApiUrl('img', tokensToFetch[i].token, tokensToFetch[i].index);
      let data = await fetchImageUrl(url);
      sheetImages.push(data);
    }
  }

  await sendMessageToPopup('Generating PDF', true);
  await generatePDF(sheetImages);
};

const downloadAudio = async (resolve, reject, attempt = 0) => {
  if (attempt === 0)
    abortController.signal.addEventListener('abort', reject);
  if (abortController.signal.aborted)
    return;

  if (allTokens[`${scoreId}_mp3_0`]) {
    await sendMessageToPopup('Retrieving audio link', true);
    const dataUrl = await fetchApiUrl('mp3', allTokens[`${scoreId}_mp3_0`]);
    await sendMessageToPopup('Downloading link', true);

    downloadFile(dataUrl);
    return sendMessageToPopup('Audio downloaded successfully');
  }

  if (attempt > 2)
    return sendMessageToPopup('Failed to download audio');

  await sendMessageToPopup('Loading data', true);
  await loadMp3Data();
  return downloadAudio(resolve, reject, attempt + 1);
};

const downloadMidi = async (resolve, reject, attempt = 0) => {
  if (attempt === 0)
    abortController.signal.addEventListener('abort', reject);
  if (abortController.signal.aborted)
    return;

  if (allTokens[`${scoreId}_midi_0`]) {
    await sendMessageToPopup('Retrieving midi link', true);
    const dataUrl = await fetchApiUrl('midi', allTokens[`${scoreId}_midi_0`]);
    await sendMessageToPopup('Downloading link', true);

    downloadFile(dataUrl);
    return sendMessageToPopup('Midi downloaded successfully');
  }

  if (attempt > 2)
    return sendMessageToPopup('Failed to download midi');

  await sendMessageToPopup('Loading data', true);

  if (!await loadMidiDataWithClick())
    await loadMidiDataWithIframe();

  return downloadMidi(resolve, reject, attempt + 1);
};

const sendMessageToPopup = async (message, loading = false) => {
  latestProgressMessage = loading ? {message, loading} : null;
  await browser.runtime.sendMessage({message, loading}).catch(() => null);
};

const fetchApiUrl = async (type, token, index = 0) => {
  return fetch(
    `https://musescore.com/api/jmuse?id=${scoreId}&index=${index}&type=${type}`,
    {headers: {authorization: token}}
  )
    .then(res => res.json())
    .then(res => res.info.url);
};

const fetchImageUrl = async url => {
  return fetch(url)
    .then(res => res.blob())
    .then(async blob => {
      if (blob.type === 'image/svg+xml') {
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
  window.open(url);
  // window.location.assign(url);
};

const isAllImageTokensSet = () => {
  for (let i = 1; i < scorePagesSum; i++) {
    if (!allTokens[`${scoreId}_img_${i}`])
      return false;
  }

  return true;
};

const loadMp3Data = async () => {
  document.querySelector('button[title="Toggle Play"]')?.click();
  await delay(50);
  document.querySelector('button[title="Toggle Play"]')?.click();
}

const loadMidiDataWithIframe = async () => {
  const ifr = document.createElement('iframe');

  ifr.src = window.location.href + '/piano-tutorial';
  ifr.style.width = '0px';
  ifr.style.height = '0px';
  ifr.style.position = 'fixed';
  document.body.appendChild(ifr);

  await new Promise((resolve) => {
    if (ifr.complete && ifr.readyState === 'complete') {
      resolve();
      return;
    }

    ifr.addEventListener('load', () => resolve());
  });
};

const loadMidiDataWithClick = async () => {
  const button = document.querySelector('path[d^="M2 3.875V20"]')?.parentElement?.parentElement;

  if (!button)
    return false;

  button.click();

  await new Promise(resolve => {
    if (window.location.pathname.endsWith('/piano-tutorial')) {
      resolve();
      return;
    }

    navigation.addEventListener("navigate", () => resolve());
  });

  button.click();
  return true;
};

const loadImagesDiv = async () => {
  const imgDiv = document.querySelector('#jmuse-scroller-component')?.parentElement;

  if (imgDiv) {
    document.body.style.overflow = 'hidden';
    imgDiv.style.height = '200000px';
    await delay(50);
    imgDiv.style.height = 'auto';

    return true;
  }
  return false;
};

const loadImagesIframe = async () => {
  const ifr = document.createElement('iframe');

  ifr.src = window.location.href;
  ifr.style.width = '1000px';
  ifr.style.height = '300000px';
  ifr.style.position = 'fixed';
  document.body.appendChild(ifr);

  await new Promise(resolve => {
    if (ifr.complete && ifr.readyState === 'complete') {
      resolve();
      return;
    }

    ifr.addEventListener('load', resolve);
  });
};

if (window)
  window.addEventListener('load', setScoreProps);
