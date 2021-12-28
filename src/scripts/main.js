!async function () {
    'use strict';

    const getTab = async () => {
        const query = {active: true, currentWindow: true};

        let tab = await browser.tabs.query(query);

        while (tab[0].status !== 'complete') {
            tab = await browser.tabs.query(query);
        }

        return tab[0];
    };

    const resetBackgroundColorAnimation = () => {
        const html = document.querySelector('html');

        html.style.setProperty('--color-animation', 'null');
        setTimeout(() => {
            html.style.setProperty('--color-animation', 'background-migration 3s ease alternate infinite');
        }, 10);
    };

    const printToPopup = (printSolver, message) => {
        const html = document.querySelector('html');
        const body = document.querySelector('.content');
        const dContent = document.querySelector('.fun__content');
        const pMessage = document.querySelector('.message__text');

        pMessage.classList.forEach(value => {
            if (value !== 'message__text')
                pMessage.classList.remove(value);
        });

        if (printSolver) {
            html.style.setProperty('--html-height', '165px');
            body.appendChild(solverContent);

            pMessage.textContent = '';
        } else {
            if (dContent)
                body.removeChild(dContent);

            pMessage.classList.add(`message-block`);
            pMessage.textContent = message;
        }
        resetBackgroundColorAnimation();
    };

    const printRefreshButton = () => {
        const div = document.createElement('div');

        div.className = 'fun__content';

        const btn = document.createElement('button');

        btn.className = 'btn__fun btn__refresh';
        btn.textContent = 'Refresh';

        btn.addEventListener('click', () => {
            browser.tabs.reload();
            location.reload();
        });

        document.querySelector('.message__text').classList.add('no-margin');

        div.appendChild(btn);
        document.querySelector('.message__div').appendChild(div);
    };

    const getContentDiv = () => {
        return document.querySelector('.fun__content').cloneNode(true);
    };

    const setPseudoLoading = message => {
        printToPopup(false, message);

        const pre = document.querySelector('.message__loading');

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
    };

    const stopPseudoLoading = () => {
        clearInterval(loadingInterval);
        document.querySelector('.message__loading').textContent = '';
    };

    const isSheetOnPage = async () => {
        return (await fetch(`${tab.url}/embed`)).ok;
    };

    const callContent = async () => {
        if (await isSheetOnPage()) {
            try {
                await browser.tabs.sendMessage(tab.id, '');

                return true;
            } catch (e) {
                stopPseudoLoading();

                printToPopup(false, `Please refresh the page.`);
                printRefreshButton();
            }
        } else {
            stopPseudoLoading();

            printToPopup(false, `Please open a Musescore sheet.`);
        }

        return false;
    };

    const callBack = (type, triggerType) => {
        let message = {
            MDBack: {
                type: type,
                trigger: triggerType,
                scanType: 'alpha',
                url: tab
            }
        }

        setPseudoLoading('Please wait');

        browser.runtime.sendMessage(message);
    };

    const startPopup = () => {
        stopPseudoLoading();
        printToPopup(true);

        const sheetOpenB = document.querySelector('.sheet__open');
        const sheetDownloadB = document.querySelector('.sheet__download');
        const audioDownloadB = document.querySelector('.audio__download');
        const midiDownloadB = document.querySelector('.midi__download');

        sheetOpenB.addEventListener('click', () => {
            callBack('sheet', 'open');
        });

        sheetDownloadB.addEventListener('click', () => {
            callBack('sheet', 'download');
        });

        audioDownloadB.addEventListener('click', () => {
            callBack('audio', 'download');
        });

        midiDownloadB.addEventListener('click', () => {
            callBack('midi', 'download');
        });
    }

    const resolveListeners = message => {
        if (typeof message === 'object' && message.MDMain) {
            if (message.MDMain.type === 'error') {
                stopPseudoLoading();
                printToPopup(false, message.MDMain.message);
            } else if (message.MDMain.type === 'success') {
                stopPseudoLoading();
                printToPopup(true);
            }
        }
    };

    let loadingInterval;
    const solverContent = getContentDiv();

    setPseudoLoading('Initializing');

    const tab = await getTab();

    if (tab.url === undefined) {
        stopPseudoLoading();
        printToPopup(false, `Please open a Musescore sheet.`);
    } else if (await callContent()) {
        startPopup();
    }

    browser.runtime.onMessage.addListener(resolveListeners);
}();
