import browser from 'webextension-polyfill';
import SparkMD5 from 'spark-md5';
import {fetchApiUrl} from '../modules/utils';

export let isTokenAlgorithmAvailable = false;

const BUILD_URL_RE = /^https:\/\/musescore\.com\/static\/public\/build\/[\w\/]+\/\d+\/\d+\.\w+\.js(?:\?.*)?$/;
const SECRET_RE = /\w\+\w\+\w\+"([^"\\]{1,64})"\)\.substr\(0, *4\)/;
const MD5_INIT_CONSTANTS = ['1732584193', '-271733879', '-1732584194', '271733878'];

let secret = null;

const getBuildScriptUrls = () => {
  const urls = [...document.querySelectorAll('link')]
    .map(link => link.href)
    .filter(href => BUILD_URL_RE.test(href));

  return [...new Set(urls)];
};

const getTokenSecretFromCache = async () => {
  return (await browser.storage.local.get('tokenSecret')).tokenSecret;
};

const setTokenSecretToCache = async data => {
  await browser.storage.local.set({tokenSecret: data});
};

const extractSecret = text => {
  if (!MD5_INIT_CONSTANTS.every(constant => text.includes(constant)))
    return null;

  return text.match(SECRET_RE)?.[1] ?? null;
};

const loadSecret = async () => {
  if (secret) return secret;
  const urls = getBuildScriptUrls();
  const cached = await getTokenSecretFromCache();

  if (cached?.secret && urls.includes(cached.url)) {
    secret = cached.secret;
    return secret;
  }

  for (const url of urls) {
    try {
      const found = extractSecret(await (await fetch(url)).text());
      if (found) {
        await setTokenSecretToCache({url, secret: found});
        secret = found;
        return secret;
      }
    } catch (e) {
      console.error(e);
    }
  }

  isTokenAlgorithmAvailable = false;
  return null;
};

const init = async () => {
  secret = await loadSecret();
  isTokenAlgorithmAvailable = !!secret;
};

export const generateToken = (id, type, index = 0) =>
  SparkMD5.hash(`${id}${type}${index}${secret}`).substring(0, 4);

export const getMediaUrlWithAlgorithm = async (scoreId, type, index = 0) => {
  await init();

  if (!isTokenAlgorithmAvailable)
    return;

  return await fetchApiUrl(scoreId, generateToken(scoreId, type, index), type, index);
};

// self-check against tokens by musescore
browser.runtime.onMessage.addListener(req => {
  if (typeof req !== 'object' || !req?.scoreData || !secret)
    return;

  const [key, observedToken] = req.scoreData;
  const [id, type, index] = key.split('_');

  if (generateToken(id, type, index) !== observedToken) {
    console.warn('[msd] local token differs from the one used by musescore.com, using scrape fallback');
    isTokenAlgorithmAvailable = false;
  }
});

if (window)
  window.addEventListener('load', init);