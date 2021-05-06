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
    function GetContentDiv() {
        return document.querySelector('.content').cloneNode(true);
    }

    /** Calls main-background script */
    function CallMainBack(Parameters) {
        chrome.tabs.executeScript(Tab.id, {file: `/src/scripts/main-back.js`}, () => {
            chrome.tabs.sendMessage(Tab.id, Parameters);
        });
    }

    async function ResolveMainBackListener(message) {
        if (typeof message === 'object' && message.Sheet) {
            if (message.Sheet === '-') {
                PrintToPopup(false, 'Something went wrong :( Try it again', 2);
            } else if (typeof message.Sheet === 'object') {
                chrome.runtime.sendMessage({'ResolveSheetBackground': [message.Sheet[0], TriggerType, message.Sheet[1]]});
            }
        }
    }

    const SolverContent = GetContentDiv();
    PrintToPopup(false, 'Initializing...', 1);

    const Tab = await GetTab();
    const IsUrlValid = TestUrl(Tab);

    if (!IsUrlValid) {
        PrintToPopup(false, 'You have to open Musescore sheet!', 2);
        return;
    }

    PrintToPopup(true);
    let TriggerType;

    const SheetOpenB = document.querySelector('.sheet__open');
    const SheetDownloadB = document.querySelector('.sheet__download');
    const AudioDownloadB = document.querySelector('.audio__download');

    SheetOpenB.addEventListener('click', () => {
        TriggerType = 'Open';
        CallMainBack({'ResolveMainBack': 'ScanSheet'});
    });

    SheetDownloadB.addEventListener('click', () => {
        TriggerType = 'Download';
        CallMainBack({'ResolveMainBack': 'ScanSheet'});
    });

    AudioDownloadB.addEventListener('click', () => {
        TriggerType = 'Download';//todo watch out for the audio
        CallMainBack({'ResolveMainBack': 'ScanSheet'});
    });

    chrome.runtime.onMessage.addListener(ResolveMainBackListener);
}();
