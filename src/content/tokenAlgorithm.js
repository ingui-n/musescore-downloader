import browser from 'webextension-polyfill';
import {fetchApiUrl} from "../modules/utils";

export let isTokenAlgorithmAvailable = false;
let script, sandbox;

const checkTokenAlgorithm = async () => {
  const scriptUrlFromDocument = getScriptUrlFromDocument();

  if (!scriptUrlFromDocument)
    return false;

  const scriptFromStorage = await getScriptFromStorage();

  if (scriptUrlFromDocument === scriptFromStorage)
    return true;

  return await updateTokenAlgorithm(scriptUrlFromDocument);
};

const executeAlgorithm = async () => {
  await sandbox.contentWindow.postMessage({executeScript: script}, '*');

  return await new Promise(resolve => {
    const processMessage = e => {
      if (!/^https?:\/\/musescore\.com/.test(e.origin) && typeof e.data === 'object' && e.data.msdExecuteScript) {
        window.removeEventListener('message', processMessage);
        resolve(e.data.msdExecuteScript);
      }
    };

    window.addEventListener('message', processMessage);
  });
};

const getScriptStart = functionNumber => {
  return `(function (modules) {
  var installedModules = {};

  function __webpack_require__(moduleId) {
    if (installedModules[moduleId]) {
      return installedModules[moduleId].exports;
    }
    var module = installedModules[moduleId] = {
      i: moduleId,
      l: false,
      exports: {}
    };
    modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
    module.l = true;
    return module.exports;
  }

  __webpack_require__.m = modules;
  __webpack_require__.c = installedModules;
  return __webpack_require__(__webpack_require__.s = ${functionNumber});
})(`
};

const getScriptUrlFromDocument = () => {
  const links = document.querySelectorAll('link');

  for (const link of links) {
    if (/https:\/\/musescore\.com\/static\/public\/build\/[\w\/]+\/\d+\/\d+\.\w+.js/.test(link.href)) {
      return link.href;
    }
  }
};

const fetchScript = async url => {
  return await fetch(url)
    .then(response => response.text())
    .catch(e => {
      console.error(e);
    });
}

const updateTokenAlgorithm = async url => {
  let script = await fetchScript(url);

  if (!script)
    return false;

  const randomToken = script.match(/"([\W\w]{1,50})"\)\.substr\(0, *4\)/)?.[1];

  if (!randomToken)
    return false;

  let scriptParts = script.split(/, *(\d+): *(?:function)*\([\w,]{1,8}\)(?: *=> *|)\{/);
  let functionNumber;

  for (let i = 0; i < scriptParts.length; i++) {
    if (scriptParts[i].includes('_digestsize') && scriptParts[i].includes('_blocksize')) {
      functionNumber = scriptParts[i - 1];
      break;
    }
  }

  if (!functionNumber)
    return false;

  script = script.replace(/\(self\.[^,]*,/, getScriptStart(functionNumber));
  script = script.replace(/}}]\)/, '}})');
  script = script.replace(
    /_digestsize=(\d+),\w+\.exports=function\(/,
    (match, a) => `_digestsize=${a},window.generateToken=function\(`
  );

  await setScriptToStorage({url, script, randomToken});

  return true;
};

export const getScriptFromStorage = async () => {
  return (await browser.storage.local.get('tokenAlgorithm')).tokenAlgorithm;
};

const setScriptToStorage = async (data) => {
  await browser.storage.local.set({tokenAlgorithm: data});
};

const generateTokenInSandbox = async (id, type, index = 0) => {
  await prepareSandboxConnection();

  if (!isTokenAlgorithmAvailable)
    return false;

  await sandbox.contentWindow.postMessage({generateToken: {id, type, index}}, '*');

  return await new Promise(resolve => {
    const processMessage = e => {
      if (typeof e.data === 'object' && e.data.msdGenerateToken) {
        window.removeEventListener('message', processMessage);
        resolve(e.data.msdGenerateToken);
      }
    };

    window.addEventListener('message', processMessage);
  });
};

export const getMediaUrlWithAlgorithm = async (scoreId, type, index) => {
  if (!isTokenAlgorithmAvailable)
    return;

  const token = await generateTokenInSandbox(scoreId, type, index);

  if (!token)
    return;

  return await fetchApiUrl(scoreId, token, type, index);
};

const prepareSandbox = async () => {
  const iframe = document.createElement('iframe');

  iframe.src = browser.runtime.getURL("sandbox.html");
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  sandbox = iframe;

  await new Promise(resolve => {
    iframe.onload = resolve;
  });
};

const prepareSandboxConnection = async () => {
  try {
    await sandbox.contentWindow.postMessage('', '*');
  } catch (e) {
    await initTokenAlgorithm();
  }
};

const initTokenAlgorithm = async () => {
  const isAvailable = await checkTokenAlgorithm();

  if (isAvailable) {
    script = await getScriptFromStorage();
    await prepareSandbox();
    isTokenAlgorithmAvailable = await executeAlgorithm();
  }
};

if (window)
  window.addEventListener('load', initTokenAlgorithm);
