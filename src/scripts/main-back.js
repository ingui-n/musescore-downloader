!async function () {
    'use strict';

    /** Scans web for sheet pages */
    function ScanSheet() {
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

                CallMain(SheetName, Pages);
            }
        }

        let SuperDiv = document.querySelector('._5tn-M');
        let targetDiv = document.querySelector('.JQKO_');
        let Pages = [];

        targetDiv.scrollTo(0, 0);

        let interval = setInterval(TriggerGetPages, 100);
    }

    /** Returns message to main.js */
    function CallMain(SheetName, Pages) {
        chrome.runtime.sendMessage({'Sheet': [SheetName, Pages]});
    }

    /** Resolve Listener */
    function ListenerHandler(message) {
        if (typeof message === 'object' && message.ResolveMainBack) {
            chrome.runtime.onMessage.removeListener(ListenerHandler);
            if (message.ResolveMainBack === 'ScanSheet') {
                ScanSheet();
            }
        }
    }

    chrome.runtime.onMessage.addListener(ListenerHandler);
}();
