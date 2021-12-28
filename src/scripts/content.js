!async function () {
    'use strict';

    /** Resolve Listener */
    const listenerHandler = message => {
        if (typeof message === 'object' && message.MDContent) {
            let mess = message.MDContent;

            switch (mess.type) {
                case 'audio':
                    return scanAudio(mess.trigger);
                case 'sheet' :
                    return scanSheet(mess.trigger);
                case 'midi' :
                    return scanMidi(mess.trigger);
            }
        }
    };

    const getScoreName = () => {
        return trimSheetName(document.querySelector('meta[property="og:title"]').content.toLowerCase());
    };

    const getScoreUrl = () => {
        return document.querySelector('link[rel="canonical"]').href;
    };

    /** Scans web for sheet pages */
    const scanSheet = triggerType => {
        const showAllPages = () => {
            let superDiv = doc.querySelector('.react-container').firstChild;

            if (!superDiv) {
                callMain('error', 'Sorry, cannot find some important data.');
                return false;
            }

            superDiv.style.height = '1000000px';

            setTimeout(() => superDiv.style.height = '', 500);

            return true;
        };

        const createIframe = () => {
            if (document.querySelector('.MD_IF')) return;

            const ifr = document.createElement('iframe');

            ifr.src = getScoreUrl();
            ifr.className = 'MD_IF';
            ifr.style.width = '990px';
            ifr.style.height = '8150px';
            ifr.style.position = 'fixed';
            document.body.appendChild(ifr);

            return ifr;
        };


        let doc = document;

        if (window.innerWidth < 965) {
            let ifr = createIframe();

            ifr.addEventListener('load', () => {
                doc = document.querySelector('.MD_IF').contentWindow.document;

                if (showAllPages())
                    setTimeout(() => callBack('sheet', triggerType), 800);
            });
        } else {
            if (showAllPages())
                setTimeout(() => callBack('sheet', triggerType), 800);
        }
    };

    /** Gets audio from website */
    const scanAudio = triggerType => {
        const findAudio = () => {
            audios = document.querySelectorAll('audio');

            for (const audio of audios) {
                isAudio = /^https:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata/.exec(audio.src) !== null;

                if (isAudio)
                    return callBack('audio', triggerType);
            }

            youTubeScript = document.querySelectorAll('script[id="www-widgetapi-script"]');

            if (youTubeScript.length > 0) {
                return callMain('error', 'Sorry, I can not download YouTube content.');
            }

            maxTries--;

            if (maxTries > 0)
                return setTimeout(findAudio, 100);

            callMain('error', 'Downloading audio timed out :\\');
        };

        let youTubeScript = document.querySelectorAll('script[id="www-widgetapi-script"]');
        let playBtn = document.querySelector('button[title="Toggle Play"]');
        let audios = document.querySelectorAll('audio');

        if (youTubeScript.length > 0) {
            return callMain('error', 'Sorry, I can not download YouTube content.');
        }

        if (!playBtn)
            return callMain('error', 'Can not find the audio play button.');

        playBtn.click();
        playBtn.click();

        let isAudio = false,
            maxTries = 150;

        findAudio();
    };

    /** Trims bad characters for Windows users */
    const trimSheetName = sheetName => {
        const find = ['<', '>', '"', "'", '“', '”', '?', ':', '/', '\\', '|', '*', ',', '-'];

        for (let i = 0; i < find.length; i++) {
            sheetName = sheetName.replace(find[i], '');
        }

        sheetName = sheetName.replaceAll(' ', '_');

        return sheetName.trim() === '' ? 'Noname' : sheetName.trim();
    };

    /** Returns message to main.js */
    const callMain = (type, mess) => {
        let message = {
            MDMain: {
                type: type,
                message: mess
            }
        };

        browser.runtime.sendMessage(message);
    };

    const callBack = (type, trigger) => {
        let message = {
            MDBack: {
                scanType: 'legacy',
                type: type,
                name: getScoreName(),
                scoreUrl: getScoreUrl(),
                trigger: trigger
            }
        };

        browser.runtime.sendMessage(message);
    };

    const scanMidi = Trigger => {
        let fullScreenBtn = document.querySelector('button[title="Toggle Fullscreen"]');
        let wasPianoOpened = window.location.href.endsWith('/piano-tutorial');
        let btn;

        if (fullScreenBtn) {
            try {
                btn = fullScreenBtn.parentElement.parentElement.firstChild.firstChild;
                btn.click();

                if (wasPianoOpened)
                    btn.click();

                let i = 0;

                let interval = setInterval(() => {
                    if (window.location.href.endsWith('/piano-tutorial')) {
                        btn.click();
                        clearInterval(interval);

                        return callBack('midi', Trigger);
                    } else if (i > 50) {
                        clearInterval(interval);

                        return callMain('error', 'Downloading time out.');
                    }
                    i++
                }, 500);
            } catch (e) {
                return callMain('error', 'Can not find the play button.');
            }
        }
    };

    browser.runtime.onMessage.addListener(listenerHandler);
}();
