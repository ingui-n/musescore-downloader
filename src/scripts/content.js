!async function () {
    'use strict';

    /** Resolve Listener */
    function ListenerHandler(message) {
        if (typeof message === 'object' && message.MDMain) {
            let mess = message.MDMain;

            switch (mess.Type) {
                case 'Audio':
                    return ScanAudio(mess.Trigger);
                case 'Sheet' :
                    return ScanSheet(mess.Trigger);
                case 'Midi' :
                    return ScanMidi(mess.Trigger);
                case 'HTMLTest' :
                    return TestHTML();
            }
        }
    }

    function GetScoreName() {
        return TrimSheetName(document.querySelector('meta[property="og:title"]').content.toLowerCase());
    }

    function GetScoreUrl() {
        return document.querySelector('link[rel="canonical"]').href;
    }

    /** Scans web for sheet pages */
    function ScanSheet(TriggerType) {
        function ShowAllPages() {
            let SuperDiv = doc.querySelector('.react-container').firstChild;

            if (!SuperDiv) {
                CallMain('Error', 'Sorry, cannot find some important data.');
                return false;
            }

            SuperDiv.style.height = '1000000px';

            setTimeout(() => SuperDiv.style.height = '', 500);

            return true;
        }

        function CreateIframe() {
            if (document.querySelector('.MD_IF')) return;

            const ifr = document.createElement('iframe');

            ifr.src = GetScoreUrl();
            ifr.className = 'MD_IF';
            ifr.style.width = '990px';
            ifr.style.height = '8150px';
            ifr.style.position = 'fixed';
            document.body.appendChild(ifr);

            return ifr;
        }


        let doc = document;

        if (window.innerWidth < 965) {
            let ifr = CreateIframe();

            ifr.addEventListener('load', () => {
                doc = document.querySelector('.MD_IF').contentWindow.document;

                if (ShowAllPages())
                    setTimeout(() => CallBack('sheet', TriggerType), 800);
            });
        } else {
            if (ShowAllPages())
                setTimeout(() => CallBack('sheet', TriggerType), 800);
        }
    }

    /** Gets audio from website */
    function ScanAudio(TriggerType) {
        function FindAudio() {
            Audios = document.querySelectorAll('audio');

            for (const audio of Audios) {
                IsAudio = /^https:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata/.exec(audio.src) !== null;

                if (IsAudio)
                    return CallBack('audio', TriggerType);
            }

            YouTubeScript = document.querySelectorAll('script[id="www-widgetapi-script"]');

            if (YouTubeScript.length > 0) {
                return CallMain('Error', 'Sorry, I can not download YouTube content.');
            }

            MaxTries--;

            if (MaxTries > 0)
                return setTimeout(FindAudio, 100);

            CallMain('Error', 'Downloading audio timed out :\\');
            return false;
        }

        let YouTubeScript = document.querySelectorAll('script[id="www-widgetapi-script"]');
        const PlayBtn = document.querySelector('button[title="Toggle Play"]');
        let Audios = document.querySelectorAll('audio');

        if (YouTubeScript.length > 0) {
            return CallMain('Error', 'Sorry, I can not download YouTube content.');
        }

        if (!PlayBtn)
            return CallMain('Error', 'Can not find the audio play button.');

        PlayBtn.click();
        PlayBtn.click();

        let IsAudio = false,
            MaxTries = 150;

        FindAudio();
    }

    /** Trims bad characters for Windows users */
    function TrimSheetName(SheetName) {
        const Find = ['<', '>', '"', "'", '“', '”', '?', ':', '/', '\\', '|', '*' , ',', '-'];

        for (let i = 0; i < Find.length; i++) {
            SheetName = SheetName.replace(Find[i], '');
        }

        SheetName = SheetName.replaceAll(' ', '_');

        return SheetName.trim() === '' ? 'Noname' : SheetName.trim();
    }

    /** Returns message to main.js */
    function CallMain(Type, Mess) {
        let Message;

        if (Type === 'Error') {
            Message = {
                MDContent: {
                    Type: 'Error',
                    Message: Mess
                }
            };
        } else if (Type === 'HTMLTest') {
            Message = {
                MDContent: {
                    Type: Type,
                    isHTMLValid: Mess
                }
            };
        }

        if (Message)
            browser.runtime.sendMessage(Message);
    }

    function CallBack(Type, Trigger) {
        let Message = {
            MDBack: {
                Type: Type,
                Name: GetScoreName(),
                ScoreUrl: GetScoreUrl(),
                Trigger: Trigger
            }
        };

        browser.runtime.sendMessage(Message);
    }

    function TestHTML() {
        let MType = document.querySelector('meta[property="og:type"]').content === 'musescore:score';
        let MSite = document.querySelector('meta[property="og:site_name"]').content === 'Musescore.com';
        let MTitle = document.querySelector('meta[property="og:title"]').content !== undefined;
        let MUrl = document.querySelector('meta[property="og:url"]').content !== undefined;
        let MDescription = document.querySelector('meta[property="og:description"]').content !== undefined;
        let MImage = document.querySelector('meta[property="og:image"]').content !== undefined;

        let IsAllValid = MType && MSite && MTitle && MUrl && MDescription && MImage;

        setTimeout(() => CallMain('HTMLTest', IsAllValid), 50);
    }

    function ScanMidi(Trigger) {
        let FullScreenBtn = document.querySelector('button[title="Toggle Fullscreen"]');
        let WasPianoOpened = window.location.href.endsWith('/piano-tutorial');
        let btn;

        if (FullScreenBtn) {
            try {
                btn = FullScreenBtn.parentElement.parentElement.firstChild.firstChild;
                btn.click();

                if (WasPianoOpened)
                    btn.click();

                let i = 0;

                let Interval = setInterval(() => {
                    if (window.location.href.endsWith('/piano-tutorial')) {
                        btn.click();
                        clearInterval(Interval);

                        return CallBack('midi', Trigger);
                    } else if (i > 50) {
                        clearInterval(Interval);

                        return CallMain('Error', 'Downloading time out.');
                    }
                    i++
                }, 500);
            } catch (e) {
                return CallMain('Error', 'Can not find the play button.');
            }
        }
    }

    browser.runtime.onMessage.addListener(ListenerHandler);
}();
