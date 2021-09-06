!async function () {
    'use strict';

    /** Resolve Listener */
    function ListenerHandler(message) {
        if (typeof message === 'object' && message.MDMain) {
            if (message.MDMain.Type === 'Audio') {
                ScanAudio(message.MDMain.Trigger);
            } else if (message.MDMain.Type === 'Sheet') {
                ScanSheet(message.MDMain.Trigger);
            }
        }
    }

    /** Scans web for sheet pages */
    function ScanSheet(TriggerType) {
        let StartTime = Date.now();

        /** Allows to see all pages without !rendering */
        function GetPages() {
            const images = document.querySelectorAll('img');
            let Urls = [];

            for (let i = 0; i < images.length; i++) {
                if (images[i].src !== undefined && images[i].src.startsWith('https://s3.ultimate-guitar.com/musescore.scoredata/g/') || images[i].src.startsWith('https://musescore.com/static/musescore/scoredata/g/')) {
                    Urls.push(images[i].src);
                }
            }

            return Urls.filter(Boolean);
        }

        /** Calls function that gets url of the element */
        function TriggerGetPages() {
            function KillScan() {
                SuperDiv.style.height = '';
                clearInterval(interval);
            }

            let Pages = GetPages();

            if (Pages.length.toString() === PagesCount.toString()) {
                KillScan();
                CallMain('Sheet', SheetName, Pages, TriggerType);
            } else {
                if (Date.now() - StartTime > 100000) {
                    KillScan();
                    CallMain('Error', 'Cannot find any pages');
                }
            }
        }

        let SuperDiv = document.querySelector('.react-container').firstChild;
        SuperDiv.style.height = '1000000px';

        const SheetName = document.querySelector('meta[property="og:title"]').content.toLowerCase();
        const images = document.querySelectorAll('img');
        let PagesCount = 0;

        for (let i = 0; i < images.length; i++) {
            if (images[i].src !== undefined && images[i].src.startsWith('https://s3.ultimate-guitar.com/musescore.scoredata/g/') || images[i].src.startsWith('https://musescore.com/static/musescore/scoredata/g/')) {
                PagesCount = images[i].alt.match(/(\d+) pages$/)[1];
                break;
            }
        }
        let interval = setInterval(TriggerGetPages, 100);
    }

    /** Gets audio from website */
    function ScanAudio(TriggerType) {

        /** Test is is link on website */
        function ScanAudioDiv() {
            const SheetName = document.querySelector('meta[property="og:title"]').content;
            let Audios = document.querySelectorAll('audio');

            for (let i = 0; i < Audios.length; i++) {
                const IsAudio = /^https:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata\/g\/\w+\/score\.\w+\?/.exec(Audios[i].src);

                if (IsAudio) {
                    clearInterval(ScanInterval);
                    CallMain('Audio', SheetName, Audios[i].src, TriggerType);
                    return true;
                }
            }
            Counter--;

            if (Counter < 0)
                clearInterval(ScanInterval);

            CallMain('Error', 'Cannot find any audio');
            return false;
        }

        let Counter = 250, ScanInterval;

        if (ScanAudioDiv()) return;

        const PlayBtn = document.querySelector('button[title="Toggle Play"]');

        PlayBtn.click();
        PlayBtn.click();

        if (!PlayBtn) {
            CallMain('Error', 'Cannot find any audio');
        }

        ScanInterval = setInterval(ScanAudioDiv, 200);
    }

    /** Trims bad characters for Windows users */
    function TrimSheetName(SheetName) {
        const find = ['<', '>', '"', "'", '?', ':', '/', '\\', '|', '*'];

        for (let i = 0; i < find.length; i++) {
            SheetName = SheetName.replace(find[i], '');
        }
        return SheetName.trim() === '' ? 'Noname' : SheetName.trim();
    }

    /** Returns message to main.js */
    function CallMain(Type, SheetName, Links, TriggerType) {
        let Message;

        if (Type === 'Error') {
            Message = {
                'MDContent': {
                    'Type': 'Error',
                    'Message': SheetName
                }
            };
        } else if (Type === 'Sheet' || Type === 'Audio') {
            SheetName = TrimSheetName(SheetName);
            Message = {
                'MDContent': {
                    'Type': Type,
                    'Name': SheetName,
                    'Urls': Links,
                    'Trigger': TriggerType
                }
            };
        }

        browser.runtime.sendMessage(Message);
    }

    browser.runtime.onMessage.addListener(ListenerHandler);
}();
