import browser from 'webextension-polyfill';
import {updateCurrentTab} from "../modules/utils";

browser.webRequest.onSendHeaders.addListener(
  async ({url, requestHeaders}) => {
    const matchMedia = url.match(/^https:\/\/musescore\.com\/api\/jmuse\?id=(\d+)&index=(\d+)&type=(\w+)$/);

    if (matchMedia) {
      const authHeader = requestHeaders.find(e => e.name === 'Authorization');

      const id = matchMedia[1];
      const index = matchMedia[2];
      const type = matchMedia[3];

      if (authHeader) {
        const token = authHeader.value;

        const tab = await updateCurrentTab();
        try {
          await browser.tabs.sendMessage(tab.id, {scoreData: [`${id}_${type}_${index}`, token]}).catch(() => null);
        } catch (e) {}
      }
    }
  },
  {
    urls: ['https://musescore.com/api/jmuse?id=*&index=*&type=*']
  }, ['requestHeaders']
);
