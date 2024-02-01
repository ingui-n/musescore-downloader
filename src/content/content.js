import browser from 'webextension-polyfill';
import Printer from "pdfmake";

const allTokens = {};

const getFirstImgUrl = () => {
  const pngHref = document.querySelector('link[type="image/png"]')?.href;
  const svgHref = document.querySelector('link[type="image/svg+xml"]')?.href;

  return pngHref || svgHref;
};

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (typeof request === 'object' && request.scoreData) {
    allTokens[request.scoreData[0]] = request.scoreData[1];
    return;
  }

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

  imgUrls.unshift(getFirstImgUrl());

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

const loadIframe = () => {
  const ifr = document.createElement('iframe');

  ifr.src = window.location.href + '/piano-tutorial';
  ifr.style.width = '1000px';
  ifr.style.height = '200000px';
  ifr.style.position = 'fixed';
  document.body.appendChild(ifr);
};

loadIframe();
