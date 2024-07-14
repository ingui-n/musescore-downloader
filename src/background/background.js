import browser from 'webextension-polyfill';
import {updateCurrentTab} from "../modules/utils";

browser.webRequest.onSendHeaders.addListener(
  async ({url, requestHeaders}) => {
    const search = new URL(url).searchParams;

    const id = search.get('id');
    const index = search.get('index');
    const type = search.get('type');

    if (!id || !index || !type)
      return;

    const token = requestHeaders.find(e => e.name === 'Authorization')?.value;

    if (!token)
      return;

    const tab = await updateCurrentTab();

    if (tab?.id) {
      await browser.tabs.sendMessage(tab.id, {
        scoreData: [`${id}_${type}_${index}`, token]
      });
    }
  },
  {
    urls: ['https://musescore.com/api/jmuse*']
  }, ['requestHeaders']
);
