import browser from 'webextension-polyfill';
import {getTokens, resetPageStorage, setTokens} from '../modules/utils';

browser.runtime.onInstalled.addListener(async () => {
  await resetPageStorage('tokens', {img: '', mp3: '', midi: ''});
});

/** store tokens */
browser.webRequest.onSendHeaders.addListener(
  async ({url, requestHeaders}) => {
    const matchMediaType = url.match(/^https:\/\/musescore\.com\/api\/jmuse\?id=\d+&index=[01]&type=(\w+)&v2=1$/);

    if (matchMediaType) {
      const authHeader = requestHeaders.find(e => e.name === 'Authorization');

      if (authHeader) {
        const token = authHeader.value;
        const tokens = await getTokens();

        if (tokens[matchMediaType[1]] !== token) {
          tokens[matchMediaType[1]] = token;
          await setTokens(tokens);
        }
      }
    }
  },
  {urls: ['https://musescore.com/api/jmuse?id=*&index=*&type=*&v2=1']}, ['requestHeaders']
);
