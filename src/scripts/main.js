!async function () {
    'use strict';

    /** Gets current tab, process until Tab status is complete */
    async function GetTab() {
        const query = {active: true, currentWindow: true};

        let Tab = await new Promise((resolve, reject) => {

            try {
                chrome.tabs.query(query, async tabs => {
                    resolve(tabs[0]);
                });
            } catch (e) {
                reject(e);
            }
        });

        if (Tab.status !== 'complete')
            Tab = await GetTab();

        return Tab;
    }

    /** Check URL if is MOODLE */
    function TestUrl(Tab) {
        const url = /^https:\/\/musescore\.com(\/[a-zA-Z0-9-_]+){2,4}$/.exec(Tab.url);
        const title = /\) \| Musescore\.com$/.exec(Tab.title);
        const titleIncludes = /Sheet music for /.exec(Tab.title);

        return url && title && titleIncludes;
    }

    /** Resets background color animation */
    function ResetBackgroundColorAnimation() {
        const html = document.querySelector('html');

        html.style.setProperty('--color-animation', 'null');
        setTimeout(() => {
            html.style.setProperty('--color-animation', 'background-migration 3s ease alternate infinite');
        }, 10);
    }

    /** Prints website message */
    function PrintToPopup(PrintSolver, Message, MessageLen) {
        const html = document.querySelector('html');
        const body = document.querySelector('body');
        const dContent = document.querySelector('.content');
        const pMessage = document.querySelector('.message');

        pMessage.classList.forEach(value => {
            if (value !== 'message')
                pMessage.classList.remove(value);
        });

        if (PrintSolver) {
            html.style.setProperty('--html-height', '246px');
            body.appendChild(SolverContent);

            ResetBackgroundColorAnimation();

            pMessage.textContent = '';
        } else {
            if (dContent)
                body.removeChild(dContent);

            pMessage.classList.add(`message-${MessageLen}-line`);
            pMessage.textContent = Message;
        }
    }

    /** Returns content div */
    function GetContent() {
        return document.querySelector('.content').cloneNode(true);
    }

    /** Returns variable SiteCache */
    async function GetSiteCache(TabUrl) {
        const target = await new Promise(res => chrome.storage.local.get('SiteCache', res));
        return target['SiteCache'][TabUrl];
    }

    /** Calls main-background script */
    function CallMainBack(Parameters) {
        chrome.tabs.executeScript(Tab.id, {file: `/src/scripts/main-back.js`}, () => {
            chrome.tabs.sendMessage(Tab.id, Parameters);
        });
    }

    /** Returns number of sheet pages */
    async function GetNumberOfPages(Url) {
        async function ResolveContent(res) {
            if (res.ok) {
                const match = /pages&quot;:(\d+)/.exec(await res.text());

                return match ? match[1] : null;
            }
            return null;
        }

        return fetch(Url)
            .then(ResolveContent)
            .catch(() => null)
    }

    /** Checks if is there all pages */
    async function CheckPages(TabCache, SheetPagesNum) {
        for (let i = 0; i < SheetPagesNum; i++) {
            if (TabCache[`sheet${i}`] === undefined)
                return false;
        }
        return true;
    }

    const SolverContent = GetContent();
    PrintToPopup(false, 'Initializing...', 1);

    const Tab = await GetTab();
    const IsUrlValid = TestUrl(Tab);


    if (!IsUrlValid) {
        PrintToPopup(false, 'You have to open Musescore sheet!', 2);
        return;
    }

    const TabCache = await GetSiteCache(Tab.url);
    const SheetPagesNum = await GetNumberOfPages(Tab.url);
    const IsPagesAll = await CheckPages(TabCache, SheetPagesNum);
    CallMainBack({'ResolveMainBack': ['ScanSheet', SheetPagesNum]});


    if (TabCache === undefined || !IsPagesAll) {
        CallMainBack({'ResolveMainBack': ['ScanSheet', SheetPagesNum]});
//        CallMainBack({'ResolveMainBack': 'Reload'});

        //todo reload message
        //todo reload window && popup
    }


    if (!IsPagesAll) {
        CallMainBack({'ResolveMainBack': 'ScanSheet'});
        //todo scan sheet
        return;
    }


}();
