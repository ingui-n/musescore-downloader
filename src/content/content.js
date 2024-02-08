import browser from 'webextension-polyfill';
import Printer from "pdfmake";
import {delay} from "../modules/utils";

const allTokens = {};
const allUrls = {};
let scoreUrl = '';
let scoreName = '';
let scoreComposer = '';
let scoreId = '';
let scorePagesSum = 0;

const setScoreProps = () => {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  for (const script of scripts) {
    try {
      const obj = JSON.parse(script.textContent);

      if (obj?.['@type'] !== 'MusicComposition')
        continue;

      if (obj?.thumbnailUrl)
        allUrls.img_0 = {
          url: getSvgUrlOfFirstImage(obj.thumbnailUrl),
          expiration: new Date(10000000000000).toISOString()
        };
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

  if (!allUrls.img_0)
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
    allUrls.img_0 = {
      url: svgHref || getSvgUrlOfFirstImage(pngHref),
      expiration: new Date(10000000000000).toISOString()
    };
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

  if (typeof request === 'object' && request.scoreData) {
    allTokens[request.scoreData[0]] = request.scoreData[1];
    // console.log('tokens', allTokens);
    return;
  }

  if (typeof request === 'object' && request.scoreDataUrl) {
    allUrls[request.scoreDataUrl[0]] = request.scoreDataUrl[1];
    // console.log('urls', allUrls);
    return;
  }

  if (typeof request !== 'object' || !request.label || !request.type)
    return;

  removeExpiredUrls();

  switch (request.label) {//todo
    case 'downloadSheet':
      return downloadSheet();
    case 'openSheet':
      return openSheet();
    case 'downloadAudio':
      return downloadAudio();
    case 'downloadMidi':
      return downloadMidi();
    default:
      return sendMessageToPopup('badMediaType');
  }
});

const isScoreIdValid = scoreId => {
  return /^\d{7}$/.test(scoreId);
};

const openSheet = async () => {//todo messages to popup
  const pdfFile = await getPdfDocument();

  if (typeof pdfFile === 'object') {
    pdfFile.open();
    await sendMessageToPopup('downloadSuccess');
  }
};

const downloadSheet = async (scoreId) => {
  await sendMessageToPopup('getMetadata');
  const {pagesNumber, composer, title} = getMetadata();

  await sendMessageToPopup('downloadingPages');
  const sheetImages = await fetchImages(scoreId, pagesNumber);

  await sendMessageToPopup('generatePdf');
  (await generatePDF(sheetImages, composer, title)).download(title);
  await sendMessageToPopup('downloadSuccess');
};

const downloadAudio = async (attempt = 0) => {
  await sendMessageToPopup('urlRequest');

  if (allUrls.mp3_0) {
    downloadFile(allUrls.mp3_0.url);
    return sendMessageToPopup('downloadSuccess');
  }

  if (allTokens[`${scoreId}_mp3_0`]) {
    const dataUrl = await fetchApiUrl(scoreId, 'mp3');
    await sendMessageToPopup('downloadingUrl');

    downloadFile(dataUrl);
    return sendMessageToPopup('downloadSuccess');
  }

  if (attempt > 2)
    return sendMessageToPopup('cannotDownload');

  await loadData('mp3');
  return downloadAudio(attempt + 1);
};

const getPdfDocument = async (attempt = 0) => {
  removeExpiredUrls();
  await sendMessageToPopup('getMetadata');

  const tokensToFetch = [];
  const currentUrls = [allUrls.img_0.url];

  for (let i = 1; i < scorePagesSum; i++) {
    if (!allUrls['img_' + i]) {
      if (allTokens[`${scoreId}_img_${i}`]) {
        tokensToFetch.push({
          index: i,
          token: allTokens[`${scoreId}_img_${i}`]
        });
      } else {
        if (attempt > 3) {
          await sendMessageToPopup('downloadError');
          return;
        }

        await loadImagesDiv();

        if (!isAllImageTokensSet() && !isAllImageUrlsSet() && attempt > 0)
          await loadImagesIframe();

        return openSheet(attempt + 1);
      }
    } else {
      currentUrls.push(allUrls['img_' + i].url);
    }
  }

  if (tokensToFetch.length > 0) {
    await sendMessageToPopup('downloadingPages');
    currentUrls.push(...await fetchImageUrls(tokensToFetch));
  }

  const sheetImages = await fetchImages(currentUrls);

  await sendMessageToPopup('generatePdf');
  return generatePDF(sheetImages);
};

const downloadMidi = async (attempt = 0) => {
  if (allUrls.mid_0) {
    downloadFile(allUrls.mid_0.url);
    return sendMessageToPopup('downloadSuccess');
  }

  if (allTokens[`${scoreId}_midi_0`]) {
    const dataUrl = await fetchApiUrl(scoreId, 'midi');
    await sendMessageToPopup('downloadingUrl');

    downloadFile(dataUrl);
    return sendMessageToPopup('downloadSuccess');
  }

  if (attempt > 2)
    return sendMessageToPopup('cannotDownload');

  if (!await loadMidiDataWithClick())
    await loadMidiDataWithIframe();

  return downloadMidi(attempt + 1);
};

const getMetadata = () => {
  const composer = document.querySelector('meta[property="musescore:composer"]')?.content?.replaceAll('\n', ' ');
  const title = document.querySelector('meta[property="og:title"]')?.content;
  const matchPagesNumber1 = document.querySelector('body').outerHTML.match(/\d+ of (\d+) pages/);

  let pagesSum = matchPagesNumber1 ? Number(matchPagesNumber1[1]) : null;

  if (!pagesSum) {
    const matchPagesNumber2 = document.querySelector('body').outerHTML.match(/Pages<\/h3><\/th><td><div[\w ="]+>(\d+)</);
    pagesSum = matchPagesNumber2 ? Number(matchPagesNumber2[1]) : null;
  }

  if (!pagesSum) {
    const pagesDivClassName = document.querySelector('#jmuse-scroller-component')?.firstChild?.classList[0];
    pagesSum = document.querySelectorAll('.' + pagesDivClassName).length;
  }

  return {composer, title, pagesSum};
};

const sendMessageToPopup = async type => {
  await browser.runtime.sendMessage(type).catch(() => null);
};

const fetchImageUrls = async tokens => {
  return Promise.all([...tokens.map(({index, token}) =>
    fetch(
      `https://musescore.com/api/jmuse?id=${scoreId}&index=${index}&type=img`,
      {headers: {authorization: token}}
    )
      .then(res => res.json())
      .then(res => res.info.url)
  )]);
};

const fetchImages = async urls => {
  return Promise.all([...urls.map(url =>
    fetch(url)
      .then(res => res.blob())
      .then(blob => {
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
      })
  )]);
};

const generatePDF = async (pages = []) => {
  const docContent = [];
  let pageOrientation = 'portrait';
  let size = {width: 575, height: 822};

  if (pages.length > 0) {
    let imageSize = await getImageSize(pages[0]);

    if (imageSize.width > imageSize.height) {
      pageOrientation = 'landscape';
      [size.width, size.height] = [size.height, size.width];
    }

    for (const page of pages) {
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

  return new Printer.createPdf(docDefinition);
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

const fetchApiUrl = async (id, type, index = 0, token) => {
  token = allTokens[`${id}_${type}_${index}`];

  return fetch(
    `https://musescore.com/api/jmuse?id=${id}&index=${index}&type=${type}`,
    {headers: {authorization: token}}
  )
    .then(async res =>
      res.ok ? (await res.json()).info.url : null
    );
};

const downloadFile = url => {
  //window.open(url);
  window.location.assign(url);
};

const getAllTokensSum = (scoreId) => {
  for (let i = 1; i < 300; i++) {
    if (!allTokens[`${scoreId}_img_${i}`])
      return i;
  }
};

const loadIframe = (type) => {
  if (type === 'img') {
    const imgDiv = document.querySelector('#jmuse-scroller-component')?.parentElement;
    if (imgDiv)
      imgDiv.style.height = '200000px';
  }
  const ifr = document.createElement('iframe');

  ifr.src = window.location.href + '/piano-tutorial';
  ifr.style.width = '1000px';
  ifr.style.height = '200000px';
  ifr.style.position = 'fixed';
  document.body.appendChild(ifr);
};

const removeExpiredUrls = () => {
  const date = new Date();

  for (let [key, value] of Object.entries(allUrls)) {
    if (date > new Date(value.expiration))
      delete allUrls[key];
  }
};

const isAllImageTokensSet = () => {
  for (let i = 1; i < scorePagesSum; i++) {
    if (!allTokens[`${scoreId}_img_${i}`])
      return false;
  }

  return true;
};

const isAllImageUrlsSet = () => {
  for (let i = 1; i < scorePagesSum; i++) {
    if (!allUrls[`img_${i}`])
      return false;
  }

  return true;
};

const loadData = async type => {
  if (type === 'img') {
    const imgDiv = document.querySelector('#jmuse-scroller-component')?.parentElement;
    if (imgDiv) {
      imgDiv.style.height = '200000px';
    } else {
      const ifr = document.createElement('iframe');

      ifr.src = window.location.href + '/piano-tutorial';
      ifr.style.width = '1000px';
      ifr.style.height = '200000px';
      ifr.style.position = 'fixed';
      document.body.appendChild(ifr);
    }
  } else if (type === 'midi') {

  } else if (type === 'mp3') {
    document.querySelector('button[title="Toggle Play"]')?.click();
    await delay(50);
    document.querySelector('button[title="Toggle Play"]')?.click();
  }
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

// loadIframe();

setTimeout(() => {
  document.querySelector('.N30cN').addEventListener('click', () => {
    console.log('A')
    loadImagesDiv().then(() => console.log(2));
    console.log(allUrls)
    console.log(allTokens)
  });
  // setScoreProps()
}, 5000);

window.addEventListener('load', setScoreProps);
