!async function () {
    'use strict';

    /** Scans web for sheet pages */
    async function ScanSheet(PagesNum) {
        let targetDiv = document.querySelector('.JQKO_');

        document.querySelector('._1ucZr').innerHTML = PagesNum;

        function ScrollDiv(Top) {
            targetDiv.scrollTo({
                top: Top,
                behavior: 'smooth'
            });
            ScrollTopNum += 900;
        }

        function PreScroll() {
            if (PagesNum === 0)
                clearInterval(PreScroll);
            document.querySelector('._1ucZr').innerHTML = PagesNum;
            PagesNum--;
            ScrollDiv(ScrollTopNum);//todo stop this now
        }

        let ScrollTopNum = 0;

        setInterval(PreScroll, 900);

        /*function ScrollToTop() {
            targetDiv.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

        function ScrollToBottom() {
            targetDiv.scrollTo({
                top: 50000000,
                behavior: 'smooth'
            });
        }

        ScrollToBottom();
        setTimeout(ScrollToTop, 1000);*/
    }

    /** Reloads host */
    function ReloadHost() {
        location.reload();
    }

    /** Resolve Listener */
    function ListenerHandler(message) {
        if (typeof message === 'object' && message.ResolveMainBack) {
            if (message.ResolveMainBack[0] === 'ScanSheet') {
                chrome.runtime.onMessage.removeListener(ListenerHandler);
                ScanSheet(message.ResolveMainBack[1]);
            } else if (message.ResolveMainBack === 'Reload') {
                chrome.runtime.onMessage.removeListener(ListenerHandler);
                ReloadHost();
            }
        }
    }

    chrome.runtime.onMessage.addListener(ListenerHandler);
}();


/** Scrolls to the end of the site */
async function ScrollToTheEnd() {

    //900

    /*const syncWait = ms => {
        const end = Date.now() + ms
        while (Date.now() < end) {}
    }

    let targetDiv = document.querySelector('.JQKO_');
    const pagesLength = parseInt(document.querySelectorAll('.GgVyz')[1].textContent);

    let pageHeight = 900;
    let pagesList = [];

    for (let i = 0; i < pagesLength; i++) {
        pagesList.push(document.querySelectorAll('._2_Ppp')[1].src);

        const end = Date.now() + 1000;
        while (Date.now() < end) {}

        Scroll(targetDiv, pageHeight);
        pageHeight += 900;

    }
    document.querySelector('._1ucZr').innerHTML = pagesList.toString();*/


    /*pagesLength.forEach(value => {
        //setTimeout(() => {
            Scroll(targetDiv, pageHeight);
        //}, 1000);

        pageHeight += 900;
    });*/

    /*if (typeof targetDiv === 'undefined')
        targetDiv = document.querySelector('.Nj4E6');

    Scroll(targetDiv, targetDiv.scrollHeight, 50000000);
    setTimeout(() => Scroll(targetDiv, 0, 0), 1000);*/
}

function Scroll(target, top) {
    /*let start = Date.now(),
        now = start;

    while (now - start < 500) {*/
    target.scrollTo({
        top: top,
        behavior: 'smooth'
    });
    /*now = Date.now();
}*/
}

//ScrollToTheEnd();

//document.querySelector('._1ucZr').innerHTML = document.querySelectorAll('._2_Ppp').length.toString();
