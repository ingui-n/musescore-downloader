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
          url: obj.thumbnailUrl,
          expiration: new Date(10000000000000).toISOString()
        };
      console.log(obj)
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

  if (!allUrls.img_0) {
    const pngHref = document.querySelector('link[type="image/png"]')?.href;
    const svgHref = document.querySelector('link[type="image/svg+xml"]')?.href;

    if (pngHref || svgHref)
      allUrls.img_0 = {
        url: pngHref || svgHref,
        expiration: new Date(10000000000000).toISOString()
      };
  }

  if (!scoreComposer)
    scoreComposer = document.querySelector('meta[property="musescore:composer"]')?.content?.replaceAll('\n', ' ');

  if (scoreName)
    scoreName = document.querySelector('meta[property="og:title"]')?.content;

  setScorePagesSum();
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
  if (typeof request === 'object' && request.scoreData) {
    allTokens[request.scoreData[0]] = request.scoreData[1];
    console.log('tokens', allTokens);
    return;
  }

  if (typeof request === 'object' && request.scoreDataUrl) {
    allUrls[request.scoreDataUrl[0]] = request.scoreDataUrl[1];
    console.log('urls', allUrls);
    return;
  }

  const scoreId = getScoreId();

  if (request === 'isScorePage') {
    sendResponse(isScoreIdValid(scoreId));
    return;
  }

  if (typeof request !== 'object' || !request.label || !request.type)
    return;

  removeExpiredUrls();

  switch (request.label) {//todo
    case 'downloadSheet':
      return downloadSheet(scoreId);
    case 'openSheet':
      return openSheet(scoreId);
    case 'downloadAudio':
      return downloadAudio(scoreId);
    case 'downloadMidi':
      return downloadMidi(scoreId);
    default:
      return sendMessageToPopup('badMediaType');
  }
});

const getScoreId = () => {
  const url =
    document.querySelector('meta[property="og:url"]')?.content
    ?? document.querySelector('meta[property^="twitter:app:url"]')?.content;
  return url.split('/').pop();
};

const isScoreIdValid = scoreId => {
  return /^\d{7}$/.test(scoreId);
};

const openSheet = async (scoreId, attempt) => {
  await sendMessageToPopup('getMetadata');

  await sendMessageToPopup('downloadingPages');

  const tokensToFetch = [];

  for (let i = 1; i <= scorePagesSum; i++) {
    if (!allUrls['img_' + i]) {
      if (allTokens[`${scoreId}_img_${i}`]) {
        tokensToFetch.push(allTokens[`${scoreId}_img_${i}`]);
      } else {
        if (attempt > 3)
          return sendMessageToPopup('downloadError');

        if (await loadImagesDiv()) {
          console.log(allTokens);//todo
          return openSheet(scoreId, attempt + 1);
        } else {
          await loadImagesIframe();
          return openSheet(scoreId, attempt + 1);
        }
      }
    }
  }

  console.log(allUrls)
  console.log(allTokens);
  return;

  if (pagesNumber === 0 && attempt === 0) {
    //todo loadImagesDiv or loadImagesIframe
    return openSheet(scoreId, attempt + 1);

  }
  const allTokensSum = getAllTokensSum(scoreId);

  const allUrlsSum = getAllUrlsSum();


  //todo iterate with allurls/alltokens

  //todo test allUrls
  //todo call every missing from allurls with alltokens - if doesnt exist - loadImagesDiv or loadImagesIframe

  const sheetImages = await downloadSheetPages(scoreId, pagesNumber);

  await sendMessageToPopup('generatePdf');
  (await generatePdf(sheetImages, composer, title)).open();
  await sendMessageToPopup('downloadSuccess');
};

const downloadSheet = async (scoreId) => {
  await sendMessageToPopup('getMetadata');
  const {pagesNumber, composer, title} = getMetadata();

  await sendMessageToPopup('downloadingPages');
  const sheetImages = await downloadSheetPages(scoreId, pagesNumber);

  await sendMessageToPopup('generatePdf');
  (await generatePdf(sheetImages, composer, title)).download(title);
  await sendMessageToPopup('downloadSuccess');
};

const downloadAudio = async (scoreId, attempt = 0) => {
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
  return downloadAudio(scoreId, attempt + 1);
};

const downloadMidi = async (scoreId, attempt = 0) => {
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

  if (await loadMidiDataWithClick()) {
    return downloadMidi(scoreId, attempt + 1);
  } else {
    await loadMidiDataWithIframe();
    return downloadMidi(scoreId, attempt + 1);
  }
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

const downloadImageUrls = async (images) => {

};

const downloadSheetPages = async (scoreId, pagesNumber, round = 1) => {
  if (pagesNumber < 1)
    pagesNumber = 200;

  const targetTokens = [];

  for (let i = 1; i < pagesNumber; i++) {
    targetTokens.push(allTokens[`${scoreId}_img_${i}`]);
  }

  const imgUrls = await Promise.all([...targetTokens.map((token, i) =>
    fetch(
      `https://musescore.com/api/jmuse?id=${scoreId}&index=${i + 1}&type=img`,
      {headers: {authorization: token}}
    )
      .then(res => res.json())
      .then(res => res.info.url)
  )]);

  imgUrls.unshift(setScoreProps());

  return await Promise.all([...imgUrls.map(url => {
      try {
        return fetch(url)
          .then(async res => {
            if (res.ok) {
              let data = await res.blob();

              if (data.type === 'image/svg+xml') {
                return data.text();
              } else {
                return new Promise((resolve, reject) => {
                  const reader = new FileReader()
                  reader.onloadend = () => resolve(reader.result);
                  reader.onerror = reject;
                  reader.readAsDataURL(data);
                });
              }
            }
          });
      } catch (e) {
        return null;
      }
    }
  )]);
};

const generatePdf = async (pages = [], composer, title) => {
  const docContent = [];
  let pageOrientation = 'portrait';
  let size = {width: 575, height: 822};

  if (pages.length > 0) {
    let imageSize = await getImageSize(pages[0]);

    if (imageSize.width > imageSize.height) {
      pageOrientation = 'landscape';
      size.width = [size.height, size.height = size.width][0];
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
      title: title,
      author: composer || ''
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

  await new Promise((resolve) => {
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
    imgDiv.style.height = '200000px';
    setTimeout(() => imgDiv.style.height = 'auto', 20);
    return true;
  }
  return false;
};

const loadImagesIframe = async () => {
  const ifr = document.createElement('iframe');

  ifr.style.width = '1000px';
  ifr.style.height = '300000px';
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

// loadIframe();

setTimeout(() => {
  document.querySelector('.N30cN').addEventListener('click', () => {
    console.log('A')
    loadImagesDiv().then(() => console.log(2));
  });
  // setScoreProps()
}, 5000);

window.addEventListener('load', setScoreProps);
