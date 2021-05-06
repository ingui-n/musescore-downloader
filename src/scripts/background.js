!function () {
    'use strict';

    /** Handle web request */
    function GetRequest(details) {
        if (details.tabId > 0) {
            chrome.tabs.get(details.tabId, async tab => {
                await SetDefaultSiteStorageVariable();
                await CheckSiteActuality(tab.url, details.url);

                console.log(details);
            });
        }
    }

    /** Returns variable SiteCache */
    async function GetSiteCache() {
        const target = await new Promise(res => chrome.storage.local.get('SiteCache', res));
        return target['SiteCache'];
    }

    /** Sets default storage variable "SiteCache" - if is not defined */
    async function SetDefaultSiteStorageVariable() {
        const tabs = await GetSiteCache();

        if (typeof tabs !== 'object')
            chrome.storage.local.set({'SiteCache': {}});
    }

    /** Check if is sheet still up to date */
    async function CheckSiteActuality(TabUrl, SheetUrl) {
        const TabsCache = await GetSiteCache();

        for (const [key, value] of Object.entries(TabsCache)) {
            if (value.changed + 300000 < Date.now())
                delete TabsCache[key];
        }

        await SetSheet(TabUrl, SheetUrl, TabsCache);
    }

    /** Sets part of the sheet to storage */
    function SetSheet(TabUrl, SheetUrl, TabsCache) {
        const Type = GetSheetType(SheetUrl);

        if (!Type) return;

        if (!TabsCache[TabUrl])
            TabsCache[TabUrl] = {};

        if (Type.startsWith('sheet') && TabsCache[TabUrl]['sheet0'] === undefined)
            TabsCache[TabUrl]['sheet0'] = GetFirstPage(SheetUrl);

        TabsCache[TabUrl][Type] = SheetUrl;
        TabsCache[TabUrl].changed = Date.now();

        chrome.storage.local.set({'SiteCache': TabsCache});
    }

    /** Return sheet type */
    function GetSheetType(SheetUrl) {
        const match = /^https:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata\/g\/\w+\/score(_(?<sheet>\d+))?\.\w+/.exec(SheetUrl);

        return match ? match.groups.sheet ? `sheet${match.groups.sheet}` : 'audio' : null;
    }

    /** Returns URL for first page of the sheet */
    function GetFirstPage(SheetUrl) {
        const match = /^(https:\/\/s3.ultimate-guitar\.com\/musescore\.scoredata\/g\/\w+\/score_)(\d+)(\.\w+)/.exec(SheetUrl);

        return match ? match[1] + 0 + match[3] : null;
    }

    chrome.webRequest.onBeforeRequest.addListener(
        GetRequest,
        {urls: ['https://s3.ultimate-guitar.com/musescore.scoredata/g/*']}
    );

    chrome.runtime.onStartup.addListener(SetDefaultSiteStorageVariable);
}();
