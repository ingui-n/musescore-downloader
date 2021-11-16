!function () {
    'use strict';

    /** Resolves listener from content.js */
    async function ResolveListener(Message) {
        if (typeof Message === 'object' && Message.MDBack) {
            let Mess = Message.MDBack;

            if (Mess.ScoreUrl) {
                let SheetUrl = ExtractSheetURL(Mess.ScoreUrl);

                switch (Mess.Type) {
                    case 'audio':
                        return HandleAudio(Mess.Name, SheetUrl, Mess.Trigger);
                    case 'midi':
                        return HandleMidi(Mess.Name, SheetUrl, Mess.Trigger);
                    case 'sheet':
                        return MakePDF(Mess.Name, SheetUrl, Mess.Trigger);
                }
            }
        }
    }

    /** Downloads extracted media */
    function DownloadMedia(Name, Url, Ext) {
        const a = document.createElement('a');
        a.download = `${Name}.${Ext}`;
        a.href = Url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        browser.runtime.sendMessage('MDFinished');
    }

    /** Handle audio extension */
    function HandleAudio(Name, SheetUrl, Trigger) {
        let Url = Log[SheetUrl].audio;

        const Ext = Url.match(/^https:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata\/g\/\w+\/score\.(\w+)\?/);

        if (Trigger === 'Download')
            DownloadMedia(Name, Url, Ext ? Ext[1] : 'mp3');
    }

    /** Makes PDF */
    async function MakePDF(SheetName, SheetUrl, TriggerType) {
        /** Resolve fetched images */
        async function GetPage(url, res, i) {
            const match = /\/score_\d+.(\w+)/.exec(url);
            const FileType = match[1];

            let DataType;

            if (FileType.toUpperCase() === 'PNG') {
                DataType = await res.arrayBuffer();
            } else if (FileType.toUpperCase() === 'SVG') {
                DataType = await res.text();
            }

            FetchedPages.push({[i]: [FileType, DataType]});

            if (FetchedPages.length === Pages.length)
                CreatePDF();
        }

        /** Creates the PDF */
        function CreatePDF() {
            const doc = new PDFDocument({
                size: [595, 842]
            });

            const stream = doc.pipe(blobStream());

            for (let i = 0; i < FetchedPages.length; i++) {
                for (let a = 0; a < FetchedPages.length; a++) {
                    if (FetchedPages[a][i]) {

                        if (FetchedPages[a][i][0].toUpperCase() === 'PNG') {
                            doc.image(FetchedPages[a][i][1], 0, 0, {fit: [595, 842]});
                        } else if (FetchedPages[a][i][0].toUpperCase() === 'SVG') {
                            SVGtoPDF(doc, FetchedPages[a][i][1], 0, 0, {preserveAspectRatio: "16:9"});
                        }

                        if (i === FetchedPages.length - 1) {
                            doc.info['Title'] = SheetName;

                            doc.end();
                            if (TriggerType === 'Download') {
                                stream.on("finish", () => {
                                    const Url = stream.toBlobURL("application/pdf");

                                    DownloadMedia(SheetName, Url, 'pdf');
                                });
                            } else if (TriggerType === 'Open') {
                                stream.on("finish", () => {
                                    browser.tabs.create({url: stream.toBlobURL("application/pdf")});
                                });
                            }
                        } else {
                            doc.addPage();
                        }
                    }
                }
            }
        }

        let Pages = Log[SheetUrl].sheet;
        let FetchedPages = [];

        if (Pages.length === 0) return;

        let FirstSite = GetFirstSite(Pages[0]);

        if (FirstSite) {
            if (!Pages.find(el => el === FirstSite))
                Pages.push(FirstSite);
        }

        Pages.sort();

        for (let i = 0; i < Pages.length; i++) {
            fetch(Pages[i])
                .then(res => {
                    return res.ok ? res.blob() : undefined;
                })
                .then(res => GetPage(Pages[i], res, i))
                .catch(e => console.error(e));
        }
    }

    function HandleMidi(Name, SheetUrl, Trigger) {
        let Url = Log[SheetUrl].midi;

        const Ext = Url.match(/^https:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata\/g\/\w+\/score\.(\w+)\?/);

        if (Trigger === 'Download')
            DownloadMedia(Name, Url, Ext ? Ext[1] : 'mid');
    }

    function ExtractSheetURL(Url) {
        let Match = /^https?:\/\/musescore\.com((\/[\w_-]+){1,7})$/.exec(Url);

        return Match !== null ? Match[1] : undefined;
    }

    function SetURLToLog(details) {
        if (details.type !== 'main_frame')
            return;

        let SheetURL = ExtractSheetURL(details.url);

        if (SheetURL)
            Log[SheetURL] = {
                audio: '',
                midi: '',
                sheet: []
            };
    }

    async function SetScoreId(Url) {
        let ScoreId = /^https?:\/\/musescore\.com\/static\/musescore\/scoredata\/g\/(\w+)\/space\.jsonp\?revision=\d+&no-cache=\d+$/.exec(Url);

        if (ScoreId !== null) {
            const Tab = await GetTab();

            let SheetURL = ExtractSheetURL(Tab.url);

            if (SheetURL)
                Log[SheetURL].id = ScoreId[1];
        }
    }

    async function GetTab() {
        const Query = {active: true, currentWindow: true};
        let Tab = await browser.tabs.query(Query);

        return Tab[0];
    }

    function SetScoreElements(Url) {
        let ScoreId = Url.match(/^https?:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata\/g\/(\w+)\/score(?:(?<sheet>_\d+)|(?<midi>\.midi?)|(?<audio>\.mp3|\.wav|\.ogg|\.flac))/);

        if (ScoreId !== null) {
            for (const Score of Object.values(Log)) {
                if (Score.id === ScoreId[1]) {
                    let Groups = ScoreId.groups;

                    let Type = Groups.audio ? 'audio' : Groups.midi ? 'midi' : Groups.sheet ? 'sheet' : undefined;

                    switch (Type) {
                        case 'audio':
                            return Score.audio = Url;
                        case 'midi':
                            return Score.midi = Url;
                        case 'sheet':
                            let ReducedSites = Score.sheet.filter(el => el.substr(0, 170) !== Url.substr(0, 170));
                            ReducedSites.push(Url);

                            return Score.sheet = ReducedSites;
                    }
                }
            }
        }
    }

    function GetFirstSite(Site) {
        let FSite = Site.match(/^(https?:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata\/g\/\w+\/score_)\d+(\.(png|svg))/);

        return FSite !== null ? `${FSite[1]}0${FSite[2]}` : undefined;
    }

    async function LogScores(details) {
        SetURLToLog(details);
        await SetScoreId(details.url);
        SetScoreElements(details.url);
    }

    let Log = {};

    browser.runtime.onMessage.addListener(ResolveListener);
    browser.webRequest.onBeforeRequest.addListener(LogScores, {urls: ['https://s3.ultimate-guitar.com/musescore.scoredata/g/*/score*', 'https://musescore.com/*']});
}();
