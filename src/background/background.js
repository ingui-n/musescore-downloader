import browser from 'webextension-polyfill';
import {updateCurrentTab} from "../modules/utils";

browser.webRequest.onSendHeaders.addListener(
  async ({url, requestHeaders}) => {
    const matchMedia = url.match(/^https:\/\/musescore\.com\/api\/jmuse\?id=(\d+)&index=(\d+)&type=(\w+)$/);

    if (matchMedia) {
      const authHeader = requestHeaders.find(e => e.name === 'Authorization');

      const id = matchMedia[1];
      const index = matchMedia[2];
      console.log(index)
      const type = matchMedia[3];

      if (authHeader) {
        const token = authHeader.value;

        const tab = await updateCurrentTab();
        await browser.tabs.sendMessage(tab.id, {scoreData: [`${id}_${type}_${index}`, token]});
      }
    }
  },
  {
    urls: ['https://musescore.com/api/jmuse?id=*&index=*&type=*']//todo test url by params
  }, ['requestHeaders']
);

browser.webRequest.onSendHeaders.addListener(
  async ({url}) => {
    const matchMedia = url.match(/^https:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata\/g\/\w+\/score_?(\d+)?\.(\w{3})/);

    if (matchMedia) {
      const urlParams = new URLSearchParams(new URL(url).search);
      const date = new Date();
      const expires = urlParams.get('X-Amz-Expires');

      date.setSeconds(date.getSeconds() + Number(expires));

      const index = matchMedia[1] || 0;
      const type = matchMedia[2] === 'png' || 'svg' ? 'img' : matchMedia[2];

      const tab = await updateCurrentTab();
      await browser.tabs.sendMessage(tab.id, {scoreDataUrl: [`${type}_${index}`, {url, expiration: date.toISOString()}]});
    }
  },
  {
    urls: ['https://s3.ultimate-guitar.com/musescore.scoredata/g/*/score*']
  }
);
