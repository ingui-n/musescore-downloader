!async function () {
    'use strict';

    /** Scans web for sheet pages */
    function ScanSheet() {
        let StartTime = Date.now();

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
                CallMain(Pages);
            }
        }

        let SuperDiv = document.querySelector('._5tn-M');
        let targetDiv = document.querySelector('.JQKO_');
        let Pages = [];

        targetDiv.scrollTo(0, 0);

        let interval = setInterval(TriggerGetPages, 100);
    }

    /** Reloads host */
    function ReloadHost() {
        location.reload();
    }
    
    function CallMain(Pages) {
        chrome.runtime.sendMessage({'Pages': Pages});
    }

    /** Resolve Listener */
    function ListenerHandler(message) {
        if (typeof message === 'object' && message.ResolveMainBack) {
            if (message.ResolveMainBack[0] === 'ScanSheet') {
                ScanSheet();
                chrome.runtime.onMessage.removeListener(ListenerHandler);
            } else if (message.ResolveMainBack === 'Reload') {
                chrome.runtime.onMessage.removeListener(ListenerHandler);
                ReloadHost();
            }
        }
    }

    chrome.runtime.onMessage.addListener(ListenerHandler);
}();
