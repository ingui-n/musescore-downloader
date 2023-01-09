import browser from 'webextension-polyfill';
import {fetchApiUrl, fetchImageUrl, getTokens, isScoreUrl, setTokens} from '../modules/utils';
import Printer from "pdfmake";

const findTokensInJSFile = async () => {
  const sortTokens = async tokens => {
    const sortedTokens = {};
    const types = ['img', 'mp3', 'midi'];

    for (const type of types) {
      for (const token of tokens) {
        const url = await fetchApiUrl(getScoreId(), type, 0, token);

        if (url) {
          sortedTokens[type] = token;
          break;
        }
      }
    }

    return sortedTokens;
  };

  let authScriptLink = document.querySelector('link[href^="https://musescore.com/static/public/build/musescore_es6/2"]')?.href;

  if (authScriptLink) {
    await fetch(authScriptLink)
      .then(async res => {
        if (res.ok) {
          const text = await res.text();

          const match = [...text.matchAll(/"(\w{40})"/g)];
          const tokensFound = [];

          if (match) {
            for (const token of match) {
              tokensFound.push(token[1]);
            }
          }

          const sortedTokens = await sortTokens(tokensFound);
          const tokens = await getTokens();

          if (Object.entries(sortedTokens).length > 0) {
            for (const [type, token] of Object.entries(sortedTokens)) {
              tokens[type] = token;
            }

            await setTokens(tokens);
          }
        }
      })
      .catch(() => null);
  }
};

const checkTokens = async () => {
  const tokens = await getTokens();

  for (const token of Object.entries(tokens)) {
    if (token[1] === '') {
      const url = document.querySelector('meta[property="og:url"]')?.content;

      if (isScoreUrl(url)) {
        loadIframe();
        break;
      }
    }
  }
};

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const scoreId = getScoreId();

  if (request === 'isScorePage') {
    sendResponse(isScoreIdValid(scoreId));
    return;
  }

  if (typeof request !== 'object' || !request.label || !request.type)
    return;

  switch (request.label) {
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

const openSheet = async (scoreId) => {
  await sendMessageToPopup('getMetadata');
  const {pagesNumber, composer, title} = getMetadata();

  await sendMessageToPopup('downloadingPages');
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

const downloadAudio = async (scoreId) => {
  await sendMessageToPopup('urlRequest');
  const dataUrl = await fetchApiUrl(scoreId, 'mp3');

  await sendMessageToPopup('downloadingUrl');
  downloadFile(dataUrl);
  await sendMessageToPopup('downloadSuccess');
};

const downloadMidi = async (scoreId) => {
  await sendMessageToPopup('urlRequest');
  const dataUrl = await fetchApiUrl(scoreId, 'midi');

  await sendMessageToPopup('downloadingUrl');
  downloadFile(dataUrl);
  await sendMessageToPopup('downloadSuccess');
};

const getMetadata = () => {
  const composer = document.querySelector('meta[property="musescore:composer"]')?.content;
  const title = document.querySelector('meta[property="og:title"]')?.content;
  const matchPagesNumber = document.querySelector('body').outerHTML.match(/1 of (\d+) pages/);

  return {composer, title, pagesNumber: matchPagesNumber ? matchPagesNumber[1] : -1};
};

const sendMessageToPopup = async type => {
  await browser.runtime.sendMessage(type).catch(() => null);
};

const downloadSheetPages = async (scoreId, pagesNumber, round = 1) => {
  const images = [];
  let unknownPagesNumber = pagesNumber < 1;

  if (unknownPagesNumber)
    pagesNumber = 100;

  for (let i = 0; i < pagesNumber; i++) {
    const url = await fetchApiUrl(scoreId, 'img', i);

    if (!url) {
      if (i === 0 && round < 2) {
        loadIframe();
        await findTokensInJSFile();
        return downloadSheetPages(scoreId, pagesNumber, 2);
      }

      await sendMessageToPopup('downloadError');
      return;
    }

    let image = await fetchImageUrl(url);
    
    if (!image) {
      if (unknownPagesNumber) {
        break;
      } else {
        await sendMessageToPopup('downloadError');
        return;
      }
    }

    images.push(image);
  }

  return images;
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
    return new Promise (resolve => {
      let i = new Image();
      i.onload = () => resolve({width: i.width, height: i.height});
      i.src = image;
    });
  }
};

const loadIframe = () => {
  const ifr = document.createElement('iframe');

  ifr.src = window.location.href + '/piano-tutorial';
  ifr.style.width = '1000px';
  ifr.style.height = '9000px';
  ifr.style.position = 'fixed';
  document.body.appendChild(ifr);
};

const downloadFile = url => {
  //window.open(url);
  window.location.assign(url);
};

checkTokens().catch();
