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
  const extensionVersion = browser.runtime.getManifest().manifest_version;
  const urls = [
    "https://*.musescore.com/*scoredata*",
    "https://s3.ultimate-guitar.com/musescore.scoredata/g/*",
    "https://cdn.ustatik.com/*scoredata*",
    "https://*.wasabisys.com/*scoredata*"
  ];

  // manifest v3
  if (extensionVersion === 3) {
    try {
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [...(urls.map((_, i) => i + 1))],
        addRules: [
          ...(urls.map((url, i) => ({
            id: i + 1,
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
              urlFilter: url,
              resourceTypes: ["xmlhttprequest", "image", "other"]
            }
          })))
        ]
      });
      return;
    } catch (err) {
      console.error(err);
    }
  }

  // manifest v2
  if (extensionVersion === 2) {
    browser.webRequest.onHeadersReceived.addListener(details => {
        let headers = details.responseHeaders.filter(h => {
          const name = h.name.toLowerCase();
          return name !== 'x-frame-options' && name !== 'access-control-allow-origin';
        });

        const requestOrigin = details.initiator || (details.originUrl && new URL(details.originUrl).origin);

        if (requestOrigin !== "https://musescore.com")
          return {};

        headers.push({name: "Access-Control-Allow-Origin", value: requestOrigin});
        headers.push({name: "Access-Control-Allow-Credentials", value: "true"});

        return {responseHeaders: headers};
      },
      {urls},
      ["blocking", "responseHeaders", "extraHeaders"]
    );
  }
}

browser.runtime.onInstalled.addListener(setupRules);
