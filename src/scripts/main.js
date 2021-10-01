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
        return /^https?:\/\/musescore\.com\/(user\/\d+\/scores\/\w+|\w+\/[\w-]+)$/.exec(Tab.url) !== null;
    }

    async function TestHTML() {
        await CallContent('HTMLTest', null, false);

        function timeout() {
            if (IsHTMLContentValid === undefined) {
                setTimeout(timeout, 500);
            } else {
                startPopup();
            }
        }

        timeout();
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
    async function CallContent(Type, TriggerType = null, setLoading = true) {
        let Message = {
            'MDMain': {
                'Type': Type,
                'Trigger': TriggerType
            }
        };

        if (setLoading)
            SetPseudoLoading('Please wait');

        try {
            await browser.tabs.sendMessage(Tab.id, '');
        } catch (e) {
            StopPseudoLoading();
            return PrintToPopup(false, `Please refresh the page.`, 1);
        }

        try {
            await browser.tabs.sendMessage(Tab.id, Message);
            browser.runtime.onMessage.addListener(ResolveContentListener);
        } catch (e) {
            StopPseudoLoading();
            PrintToPopup(false, `Please open a music sheet.`, 1);
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
            } else if (message.MDContent.Type === 'HTMLTest') {
                IsHTMLContentValid = message.MDContent.isHTMLValid ?? false;
            }
        }
    }

    let loadingInterval,
        IsHTMLContentValid,
        StartedPopupAlready = false;

    const SolverContent = GetContentDiv();

    SetPseudoLoading('Initializing');

    const Tab = await GetTab();
    const IsUrlValid = TestUrl(Tab);

    if (IsUrlValid) {
        await TestHTML();
    } else {
        StopPseudoLoading();
        return PrintToPopup(false, 'You need to open a Musescore sheet.', 2);
    }

    function startPopup() {
        if (!StartedPopupAlready)
            StartedPopupAlready = true;
        else
            return;

        StopPseudoLoading();

        if (!IsUrlValid || !IsHTMLContentValid) {
            return PrintToPopup(false, 'You need to open a Musescore sheet.', 2);
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
    }
}();
