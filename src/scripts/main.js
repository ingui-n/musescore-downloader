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
        const body = document.querySelector('.content');
        const dContent = document.querySelector('.fun__content');
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
        return document.querySelector('.fun__content').cloneNode(true);
    }

    function SetPseudoLoading(message) {
        PrintToPopup(false, message, 1);

        const pre = document.querySelector('.message-loading');

        let direction = false;
        let i = 0;

        loadingInterval = setInterval(() => {
            let dotsCount = i % 8;
            let spacesCount = 7 - dotsCount;

            let dotsString = '.'.repeat(dotsCount);
            let spacesString = ' '.repeat(spacesCount);

            pre.textContent = direction ? dotsString + spacesString : spacesString + dotsString;

            if (i === 7 || i === 0) {
                direction = !direction;
                i = direction ? 0 : 7;
            }

            direction ? i++ : i--;
        }, 85);
    }

    function StopPseudoLoading() {
        clearInterval(loadingInterval);
        document.querySelector('.message-loading').textContent = '';
    }

    /** Calls main-background script */
    async function CallContent(Type, TriggerType) {
        let Message = {
            'MDMain': {
                'Type': Type,
                'Trigger': TriggerType
            }
        };

        SetPseudoLoading('Please wait');

        try {
            await browser.tabs.sendMessage(Tab.id, Message);
            browser.runtime.onMessage.addListener(ResolveContentListener);
        } catch (e) {
            PrintToPopup(false, 'Please refresh window with the music sheet', 2);
        }
    }

    /** Catches Errors */
    function ResolveContentListener(message) {
        if (message === 'MDFinished') {
            StopPseudoLoading();
            PrintToPopup(true);
            return;
        }

        if (typeof message === 'object' && message.MDContent) {
            if (message.MDContent.Type === 'Error') {
                StopPseudoLoading();
                PrintToPopup(false, message.MDContent.Message, 1);
            }
        }
    }

    let loadingInterval;
    const SolverContent = GetContentDiv();

    SetPseudoLoading('Initializing');

    const Tab = await GetTab();
    const IsUrlValid = TestUrl(Tab);

    StopPseudoLoading();

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
