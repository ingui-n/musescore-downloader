!async function () {
    'use strict';

    /** Gets current tab, process until Tab status is complete */
    async function GetTab() {
        const query = {active: true, currentWindow: true};

        let Tab = await browser.tabs.query(query);

        while (Tab[0].status !== 'complete') {
            Tab = await browser.tabs.query(query);
        }

        return Tab[0];
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
            html.style.setProperty('--html-height', '165px');
            body.appendChild(SolverContent);

            pMessage.textContent = '';
        } else {
            if (dContent)
                body.removeChild(dContent);

            pMessage.classList.add(`message-${MessageLen}-line`);
            pMessage.textContent = Message;
        }
        ResetBackgroundColorAnimation();
    }

    /** Returns content div */
    function GetContentDiv() {
        return document.querySelector('.content').cloneNode(true);
    }

    /** Calls main-background script */
    async function CallContent(Type, TriggerType) {
        let Message = {
            'MDMain': {
                'Type': Type,
                'Trigger': TriggerType
            }
        };

        chrome.tabs.sendMessage(Tab.id, Message);
        browser.runtime.onMessage.addListener(ResolveContentListener);
    }

    /** Catches Errors */
    async function ResolveContentListener(message) {
        if (typeof message === 'object' && message.MDContent) {
            if (message.MDContent === '-') {
                PrintToPopup(false, 'Something went wrong :( Try it again', 2);
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

    const SheetOpenB = document.querySelector('.sheet__open');
    const SheetDownloadB = document.querySelector('.sheet__download');
    const AudioDownloadB = document.querySelector('.audio__download');

    SheetOpenB.addEventListener('click', () => {
        CallContent('Sheet', 'Open');
    });

    SheetDownloadB.addEventListener('click', () => {
        CallContent('Sheet', 'Download');
    });

    AudioDownloadB.addEventListener('click', () => {
        CallContent('Audio', 'Download');
    });
}();
