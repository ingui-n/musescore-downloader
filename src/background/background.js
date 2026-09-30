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

async function setupRules() {
  // manifest v3
  if (browser.declarativeNetRequest) {
    try {
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1],
        addRules: [
          {
            id: 1,
            priority: 1,
            action: {
              type: "modifyHeaders",
              responseHeaders: [
                {header: "x-frame-options", operation: "remove"},
                {header: "access-control-allow-origin", operation: "set", value: "https://musescore.com"},
                {header: "access-control-allow-credentials", operation: "set", value: "true"}
              ]
            },
            condition: {
              urlFilter: "*scoredata*",
              resourceTypes: ["xmlhttprequest", "image", "other"]
            }
          }
        ]
      });
      return;
    } catch (err) {
      console.error(err);
    }
  }

  // manifest v2
  if (browser.webRequest && browser.webRequest.onHeadersReceived) {
    browser.webRequest.onHeadersReceived.addListener(details => {
        let headers = details.responseHeaders.filter(h => {
          const name = h.name.toLowerCase();
          return name !== 'x-frame-options' && name !== 'access-control-allow-origin';
        });

        const requestOrigin = details.initiator || "https://musescore.com";

        headers.push({name: "Access-Control-Allow-Origin", value: requestOrigin});
        headers.push({name: "Access-Control-Allow-Credentials", value: "true"});

        return {responseHeaders: headers};
      },
      {urls: ["https://*/*scoredata*"]},
      ["blocking", "responseHeaders", "extraHeaders"]
    );
  }
}

browser.runtime.onInstalled.addListener(setupRules);
