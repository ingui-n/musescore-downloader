!async function () {
    'use strict';

    /** Resolve Listener */
    function ListenerHandler(message) {
        if (typeof message === 'object' && message.MDMain) {
            if (message.MDMain.Type === 'Audio') {
                ScanDivs('Audio') ? ScanAudio(message.MDMain.Trigger) : CallMain('-');
            } else if (message.MDMain.Type === 'Sheet') {
                ScanDivs('Sheet') ? ScanSheet(message.MDMain.Trigger) : CallMain('-');
            }
        }
    }

    /** Test if is on website all needed elements */
    function ScanDivs(Type) {
        let ClassList;

        if (Type === 'Sheet') {
            ClassList = ['_2_Ppp', 'vAVs3', 'NEej-', '_5tn-M', 'JQKO_'];
        } else if (Type === 'Audio') {
            ClassList = ['NEej-'];
        }

        for (let i = 0; i < ClassList.length; i++) {
            const Element = document.querySelector(`.${ClassList[i]}`);

            if (!Element) return false;
        }
        return true;
    }

    /** Scans web for sheet pages */
    function ScanSheet(TriggerType) {
        let StartTime = Date.now();

        /** Allows to see all pages without !rendering */
        function GetPages() {
            SuperDiv.style.height = '1000000px';
            const PagesDiv = document.querySelectorAll('._2_Ppp');

            let Urls = [];
            for (let i = 0; i < PagesDiv.length; i++) {
                if (typeof PagesDiv[i].src !== 'string') {
                    return false;
                }
                Urls.push(PagesDiv[i].src);

            }
            return Urls.filter(Boolean);
        }

        /** Calls function that gets url of the element */
        function TriggerGetPages() {
            function KillScan() {
                SuperDiv.style.height = '';
                clearInterval(interval);
            }

            const PagesDivs = document.querySelectorAll('.vAVs3');

            if (Pages.length !== PagesDivs.length) {
                if (Date.now() - StartTime > 100000) {
                    KillScan();
                    CallMain('-');
                    return;
                }

                Pages = GetPages();
            } else {
                KillScan();

                const SheetName = document.querySelector('.NEej-').textContent;

                CallMain('Sheet', SheetName, Pages, TriggerType);
            }
        }

        let SuperDiv = document.querySelector('._5tn-M');
        let targetDiv = document.querySelector('.JQKO_');
        let Pages = [];

        targetDiv.scrollTo(0, 0);

        let interval = setInterval(TriggerGetPages, 100);
    }

    /** Gets audio from website */
    function ScanAudio(TriggerType) {

        /** Test is is link on website */
        function ScanAudioDiv() {
            const SheetName = document.querySelector('.NEej-').textContent;
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

            return false;
        }

        let PlayBtn, Counter = 250, ScanInterval;

        if (ScanAudioDiv()) return;

        const SuperBtnClassList = ['_3aSWK', '_3RNhl', '_39f0R', '_1ub-x', '_2rQms', '_1W_LO', '_3GQmO', '_2wqMT'];

        for (let i = 0; i < SuperBtnClassList.length; i++) {
            PlayBtn = document.querySelectorAll(`.${SuperBtnClassList[i]}`)[1];

            if (PlayBtn && PlayBtn.type === 'button') break;
        }

        if (!PlayBtn)
            CallMain('-');

        PlayBtn.click();
        PlayBtn.click();

        ScanInterval = setInterval(ScanAudioDiv, 200);
    }

    /** Trims bad characters for Windows users */
    function TrimSheetName(SheetName) {
        const find = ['<', '>', '"', "'", '?', ':', '/', '\\', '|', '*'];

        for (let i = 0; i < find.length; i++) {
            SheetName = SheetName.replace(find[i], '');
        }
        return SheetName.trim();
    }

    /** Returns message to main.js */
    function CallMain(Type, SheetName, Links, TriggerType) {
        let Message;

        if (Type === '-') {
            Message = {
                'MDContent': '-'
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
