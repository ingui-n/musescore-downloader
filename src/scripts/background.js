!function () {
    'use strict';

    /** Resolves listener from content.js */
    async function ResolveListener(message) {
        if (typeof message === 'object' && message.MDContent) {
            if (message.MDContent.Type === 'Audio') {
                HandleAudio(message.MDContent.Name, message.MDContent.Urls, message.MDContent.Trigger);
            } else if (message.MDContent.Type === 'Sheet') {
                await MakePDF(message.MDContent.Name, message.MDContent.Urls, message.MDContent.Trigger);
            }
        }
    }

    /** Downloads extracted media */
    function DownloadMedia(Name, Url, Ext) {
        browser.downloads.download({
            filename: `${Name}.${Ext}`,
            url: Url,
            saveAs: true
        });
    }

    /** Handle audio extension */
    function HandleAudio(Name, Url, Trigger) {
        const Ext = Url.match(/^https:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata\/g\/\w+\/score\.(\w+)\?/);

        if (Trigger === 'Download')
            DownloadMedia(Name, Url, Ext ? Ext[1] : null);
    }

    /** Makes PDF */
    async function MakePDF(SheetName, Pages, TriggerType) {

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

        let FetchedPages = [];

        for (let i = 0; i < Pages.length; i++) {
            fetch(Pages[i])
                .then(res => {
                    return res.ok ? res.blob() : undefined;
                })
                .then(res => GetPage(Pages[i], res, i))
                .catch(e => console.error(e));
        }
    }

    browser.runtime.onMessage.addListener(ResolveListener);
}();
